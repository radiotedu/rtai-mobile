import path from 'node:path'

import sharp from 'sharp'

const inputPath = path.resolve(process.argv[2] ?? 'public/assets/rooms/chim-alan-wide.png')
const outputPath = path.resolve(process.argv[3] ?? 'release-evidence/chim-alan-calibration-grid.png')
const step = Number(process.argv[4] ?? 50)

const metadata = await sharp(inputPath).metadata()
const width = metadata.width ?? 0
const height = metadata.height ?? 0
if (width <= 0 || height <= 0 || !Number.isFinite(step) || step <= 0) {
  throw new Error('A readable image and a positive grid step are required')
}

const vertical = []
const horizontal = []
const labels = []
for (let x = 0; x <= width; x += step) {
  vertical.push(`<path d="M ${x} 0 V ${height}"/>`)
  labels.push(`<text x="${x + 3}" y="16">${x}</text>`)
}
for (let y = 0; y <= height; y += step) {
  horizontal.push(`<path d="M 0 ${y} H ${width}"/>`)
  if (y > 0) labels.push(`<text x="3" y="${y - 4}">${y}</text>`)
}

const overlay = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g fill="none" stroke="#00ffff" stroke-opacity="0.38" stroke-width="1">
      ${vertical.join('')}${horizontal.join('')}
    </g>
    <g fill="#061014" stroke="#d9ffff" stroke-width="2" paint-order="stroke" font-family="monospace" font-size="13" font-weight="700">
      ${labels.join('')}
    </g>
  </svg>
`)

await sharp(inputPath)
  .composite([{ input: overlay, blend: 'over' }])
  .png({ compressionLevel: 9 })
  .toFile(outputPath)

process.stdout.write(`${outputPath}\n`)
