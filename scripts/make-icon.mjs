// Gera resources/icon.png (256x256): quadrado arredondado escuro com balão verde-limão. Sem dependências.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const S = 256
const px = Buffer.alloc(S * S * 4)

// Quadrado arredondado (fundo)
function inTile(x, y) {
  const r = 56, m = 8
  const cx = Math.min(Math.max(x, m + r), S - m - r), cy = Math.min(Math.max(y, m + r), S - m - r)
  return x >= m && x < S - m && y >= m && y < S - m && (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2
}

// Balão de fala com rabicho embaixo à esquerda
function inBubble(x, y) {
  const cx = 128, cy = 118, rx = 78, ry = 60
  const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
  const tail = y >= 160 && y <= 204 && x >= 76 && x <= 112 && x - 76 <= (204 - y) * 0.8
  return e || tail
}

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4
    if (!inTile(x, y)) continue
    let rgb = [23, 24, 30]
    if (inBubble(x, y)) {
      const dot = [96, 128, 160].some((dx) => (x - dx) ** 2 + (y - 118) ** 2 <= 11 ** 2)
      rgb = dot ? [23, 24, 30] : [184, 243, 92]
    }
    px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = 255
  }
}

const raw = Buffer.alloc((S * 4 + 1) * S)
for (let y = 0; y < S; y++) px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4)

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8; ihdr[9] = 6 // 8 bits, RGBA

writeFileSync(new URL('../resources/icon.png', import.meta.url), Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0))
]))
console.log('resources/icon.png gerado')
