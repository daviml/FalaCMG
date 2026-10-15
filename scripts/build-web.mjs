// Monta o site completo em web-dist/: landing (/), página de convite (/convite/) e app web (/app/).
// Variáveis opcionais:
//   FALACMG_DOWNLOAD_URL  link do download para Windows (ex.: página de Releases do GitHub)
//   VITE_PUBLIC_URL       endereço do site, usado nos convites do app
import { build } from 'vite'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = join(root, 'web-dist')

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// No Vercel, o endereço de produção vem pronto
if (!process.env.VITE_PUBLIC_URL && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  process.env.VITE_PUBLIC_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
}

await build({ configFile: join(root, 'vite.web.config.mts'), logLevel: 'warn' })

cpSync(join(root, 'site'), out, { recursive: true })
cpSync(join(root, 'resources/icon.png'), join(out, 'icon.png'))
mkdirSync(join(out, 'fonts'), { recursive: true })
cpSync(
  join(root, 'node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2'),
  join(out, 'fonts/manrope.woff2')
)

const config = { downloadUrl: process.env.FALACMG_DOWNLOAD_URL || '' }
writeFileSync(join(out, 'config.js'), `window.FALACMG = ${JSON.stringify(config)}\n`)

console.log('web-dist pronto', process.env.VITE_PUBLIC_URL ? `(convites: ${process.env.VITE_PUBLIC_URL})` : '')
