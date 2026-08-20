import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'public/assets/study-gear/items')

await mkdir(output, { recursive: true })

for (const cat of ['tarcin', 'benek', 'komur']) {
  await sharp(resolve(root, `public/assets/npcs/campus-cat-${cat}-walk.png`))
    .extract({ left: 0, top: 0, width: 256, height: 192 })
    .resize({ width: 128, height: 96, fit: 'contain' })
    .png({ compressionLevel: 9, palette: true })
    .toFile(resolve(output, `pet-${cat}.png`))
}
