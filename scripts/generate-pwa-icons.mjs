import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const source = await readFile(new URL('../public/favicon.svg', import.meta.url))

async function makeIcon(file, size, scale = 0.78, background = '#ffffff') {
  const innerSize = Math.round(size * scale)
  const mark = await sharp(source, { density: 512 })
    .resize(innerSize, innerSize, { fit: 'contain' })
    .png()
    .toBuffer()
  const offset = Math.round((size - innerSize) / 2)
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toFile(fileURLToPath(new URL(`../public/${file}`, import.meta.url)))
}

await Promise.all([
  makeIcon('icon-192.png', 192),
  makeIcon('icon-512.png', 512),
  makeIcon('icon-maskable-512.png', 512, 0.62, '#f3fbf6'),
  makeIcon('apple-touch-icon.png', 180),
  makeIcon('favicon-32.png', 32, 0.86),
])

console.log('Generated CareNest PWA icons.')
