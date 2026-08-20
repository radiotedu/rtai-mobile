import { readdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import sharp from 'sharp'

const evidenceRoot = resolve(process.argv[2] ?? 'release-evidence/chim-alan-final-2026-08-09')
const seatFiles = [
  'a1-route-live-00.png',
  'amfi-a2.png',
  'amfi-a3.png',
  'amfi-b1.png',
  'amfi-b2-occupied.png',
  'amfi-b3.png',
  'amfi-c1.png',
  'amfi-c2.png',
  'amfi-c3.png',
]
const labels = [
  'A1 · lower left',
  'A2 · lower centre',
  'A3 · lower right',
  'B1 · middle left',
  'B2 · occupied by Deniz',
  'B3 · middle right',
  'C1 · upper left',
  'C2 · upper centre',
  'C3 · upper right',
]

const tileWidth = 426
const tileHeight = 240
const labelHeight = 32
const columns = 3

async function makeSeatContactSheet() {
  const composites = []
  for (const [index, file] of seatFiles.entries()) {
    const crop = await sharp(join(evidenceRoot, file))
      .extract({ left: 360, top: 145, width: 720, height: 405 })
      .resize(tileWidth, tileHeight, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer()
    const left = (index % columns) * tileWidth
    const top = Math.floor(index / columns) * (tileHeight + labelHeight)
    composites.push({ input: crop, left, top })
    composites.push({
      input: Buffer.from(`<svg width="${tileWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#061922"/><text x="12" y="22" fill="#e7fff7" font-family="Arial" font-size="17">${labels[index]}</text></svg>`),
      left,
      top: top + tileHeight,
    })
  }
  await sharp({
    create: {
      width: columns * tileWidth,
      height: 3 * (tileHeight + labelHeight),
      channels: 3,
      background: '#061922',
    },
  }).composite(composites).png().toFile(join(evidenceRoot, 'all-9-amphitheatre-seats.png'))
}

async function makeRouteContactSheet() {
  const routeRoot = join(evidenceRoot, 'route-c3-frames')
  const frames = (await readdir(routeRoot)).filter((file) => /^frame-\d+\.png$/.test(file)).sort()
  const routeTileWidth = 320
  const routeTileHeight = 180
  const routeLabelHeight = 28
  const routeColumns = 4
  const composites = []
  for (const [index, file] of frames.entries()) {
    const frame = await sharp(join(routeRoot, file)).resize(routeTileWidth, routeTileHeight).png().toBuffer()
    const left = (index % routeColumns) * routeTileWidth
    const top = Math.floor(index / routeColumns) * (routeTileHeight + routeLabelHeight)
    composites.push({ input: frame, left, top })
    composites.push({
      input: Buffer.from(`<svg width="${routeTileWidth}" height="${routeLabelHeight}"><rect width="100%" height="100%" fill="#061922"/><text x="10" y="20" fill="#e7fff7" font-family="Arial" font-size="15">${basename(file, '.png')}</text></svg>`),
      left,
      top: top + routeTileHeight,
    })
  }
  const rows = Math.ceil(frames.length / routeColumns)
  await sharp({
    create: {
      width: routeColumns * routeTileWidth,
      height: rows * (routeTileHeight + routeLabelHeight),
      channels: 3,
      background: '#061922',
    },
  }).composite(composites).png().toFile(join(evidenceRoot, 'c3-walk-frame-contact.png'))
}

await Promise.all([makeSeatContactSheet(), makeRouteContactSheet()])
console.log('Rendered Çim Alan seat and route contact sheets.')
