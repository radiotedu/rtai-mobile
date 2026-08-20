import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const layout = JSON.parse(await readFile(join(root, 'src/rooms/data/library-seat-layout.json'), 'utf8'))
const roomPath = join(root, 'public/assets/rooms/library-wide.png')
const assetRoot = join(root, 'public/assets/study-gear/desk-01')
const outputRoot = join(assetRoot, 'generated')

await mkdir(outputRoot, { recursive: true })

const alphaTemplate = async (side, width, height) => {
  const file = side === 'far' ? 'far-01-front.png' : 'near-04-front.png'
  return sharp(join(assetRoot, file))
    .ensureAlpha()
    .extractChannel('alpha')
    .resize(width, height, { fit: 'fill' })
    .raw()
    .toBuffer()
}

for (const seat of layout) {
  const [x1, y1, x2, y2] = seat.hit
  const centerX = (x1 + x2) / 2
  const source = seat.side === 'far'
    ? { left: Math.round(centerX - 44), top: y2 - 4, width: 88, height: 50 }
    : { left: x1 - 8, top: y1 - 6, width: (x2 - x1) + 16, height: (y2 - y1) + 24 }
  const [rgb, alpha] = await Promise.all([
    sharp(roomPath)
    .extract(source)
    .removeAlpha()
    .raw()
    .toBuffer(),
    alphaTemplate(seat.side, source.width, source.height),
  ])
  const rgba = Buffer.alloc(source.width * source.height * 4)
  for (let pixel = 0; pixel < source.width * source.height; pixel += 1) {
    rgba[(pixel * 4)] = rgb[(pixel * 3)]
    rgba[(pixel * 4) + 1] = rgb[(pixel * 3) + 1]
    rgba[(pixel * 4) + 2] = rgb[(pixel * 3) + 2]
    rgba[(pixel * 4) + 3] = alpha[pixel]
  }
  await sharp(rgba, { raw: { width: source.width, height: source.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(join(outputRoot, `${seat.id}-front.png`))
}

console.log(`Generated ${layout.length} Library seat foreground layers.`)
