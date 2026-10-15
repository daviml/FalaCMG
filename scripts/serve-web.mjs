// Servidor local para testar web-dist/ como no Vercel: `npm run preview:web` → http://localhost:4173
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../web-dist', import.meta.url))
const port = Number(process.env.PORT) || 4173
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.json': 'application/json'
}

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\/])+/, '')
  let file = join(dir, path)
  if (!file.startsWith(dir)) return res.writeHead(403).end()
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
  } catch {
    // /convite → /convite.html (como cleanUrls do Vercel)
    file = file + '.html'
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(body)
  } catch {
    res.writeHead(404).end('404')
  }
}).listen(port, () => console.log(`FalaCMG web: http://localhost:${port}`))
