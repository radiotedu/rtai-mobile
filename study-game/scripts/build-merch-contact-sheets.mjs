import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..')
const ASSET_DIRECTORY = path.join(PROJECT_ROOT, 'public', 'assets', 'avatars', 'engine-proof')
const OUTPUT_DIRECTORY = process.argv[2]

if (!OUTPUT_DIRECTORY) {
  throw new Error('Usage: node scripts/build-merch-contact-sheets.mjs <output-directory>')
}

const DIRECTIONS = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se']
const ACTIONS = [
  { id: 'idle', sourceFrame: 0 },
  { id: 'walk', sourceFrame: 1 },
  { id: 'sit', sourceFrame: 0 },
  { id: 'stand', sourceFrame: 1 },
]
const OPTIONS = {
  top: ['radio-hoodie', 'varsity-jacket'],
  bottom: ['jeans', 'black-cargos'],
  shoes: ['sneakers', 'boots'],
  hat: ['bucket-hat', 'beanie'],
}
const FRAME = { width: 64, height: 96 }
const SCALE = 2
const CELL = { width: FRAME.width * SCALE, height: FRAME.height * SCALE + 26 }
const HEADER_HEIGHT = 58

const xml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

function combinations() {
  const result = []
  for (const top of OPTIONS.top) {
    for (const bottom of OPTIONS.bottom) {
      for (const shoes of OPTIONS.shoes) {
        for (const hat of OPTIONS.hat) result.push({ top, bottom, shoes, hat })
      }
    }
  }
  return result
}

function layers(outfit, action) {
  return [
    `body-${action}.png`,
    `skin-${action}.png`,
    `bottom-${outfit.bottom}-${action}.png`,
    `shoes-${outfit.shoes}-${action}.png`,
    `top-${outfit.top}-${action}.png`,
    `hair-${action}.png`,
    `hat-${outfit.hat}-${action}.png`,
  ]
}

async function frameBuffer(file, directionIndex, sourceFrame) {
  return sharp(path.join(ASSET_DIRECTORY, file))
    .extract({
      left: sourceFrame * FRAME.width,
      top: directionIndex * FRAME.height,
      width: FRAME.width,
      height: FRAME.height,
    })
    .png()
    .toBuffer()
}

async function composedFrame(outfit, action, directionIndex, sourceFrame) {
  const layerBuffers = await Promise.all(layers(outfit, action).map((file) => frameBuffer(file, directionIndex, sourceFrame)))
  const transparent = {
    create: {
      width: FRAME.width,
      height: FRAME.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }
  return sharp(transparent)
    .composite(layerBuffers.map((input) => ({ input })))
    .resize(FRAME.width * SCALE, FRAME.height * SCALE, { kernel: 'nearest' })
    .png()
    .toBuffer()
}

function labelSvg(outfit) {
  const title = `${outfit.top} · ${outfit.bottom} · ${outfit.shoes} · ${outfit.hat}`
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CELL.width * DIRECTIONS.length}" height="${HEADER_HEIGHT}">
    <rect width="100%" height="100%" fill="#081614"/>
    <text x="18" y="25" fill="#7fe7c2" font-size="18" font-family="Segoe UI, sans-serif" font-weight="700">MERCH VISUAL AUDIT</text>
    <text x="18" y="47" fill="#dcece7" font-size="15" font-family="Segoe UI, sans-serif">${xml(title)}</text>
  </svg>`)
}

function cellLabelSvg(action, direction) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CELL.width}" height="26">
    <rect width="100%" height="100%" fill="#102522"/>
    <text x="8" y="18" fill="#dcece7" font-size="13" font-family="Segoe UI, sans-serif" font-weight="600">${xml(action)} · ${xml(direction)}</text>
  </svg>`)
}

await fs.mkdir(OUTPUT_DIRECTORY, { recursive: true })
const audit = []

for (const outfit of combinations()) {
  const width = CELL.width * DIRECTIONS.length
  const height = HEADER_HEIGHT + CELL.height * ACTIONS.length
  const composites = [{ input: labelSvg(outfit), left: 0, top: 0 }]
  for (let actionIndex = 0; actionIndex < ACTIONS.length; actionIndex += 1) {
    const action = ACTIONS[actionIndex]
    for (let directionIndex = 0; directionIndex < DIRECTIONS.length; directionIndex += 1) {
      const left = directionIndex * CELL.width
      const top = HEADER_HEIGHT + actionIndex * CELL.height
      const avatar = await composedFrame(outfit, action.id, directionIndex, action.sourceFrame)
      composites.push({ input: avatar, left, top })
      composites.push({ input: cellLabelSvg(action.id, DIRECTIONS[directionIndex]), left, top: top + FRAME.height * SCALE })
      const stats = await sharp(avatar).stats()
      audit.push({
        outfit,
        action: action.id,
        direction: DIRECTIONS[directionIndex],
        opaquePixels: stats.channels[3]?.sum ?? 0,
      })
    }
  }
  const fileName = `${outfit.top}--${outfit.bottom}--${outfit.shoes}--${outfit.hat}.png`
  await sharp({
    create: { width, height, channels: 4, background: { r: 4, g: 17, b: 15, alpha: 1 } },
  }).composite(composites).png().toFile(path.join(OUTPUT_DIRECTORY, fileName))
}

await fs.writeFile(path.join(OUTPUT_DIRECTORY, 'audit.json'), JSON.stringify({
  outfits: combinations().length,
  frames: audit.length,
  emptyFrames: audit.filter((entry) => entry.opaquePixels === 0),
  audit,
}, null, 2))

console.log(`MERCH_CONTACT_SHEETS_OK outfits=${combinations().length} frames=${audit.length} output=${OUTPUT_DIRECTORY}`)
