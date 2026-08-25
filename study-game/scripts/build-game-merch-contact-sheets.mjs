import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

const input = path.resolve(process.argv[2] ?? '../artifacts/study-game/merch-visual-audit')
const output = path.resolve(process.argv[3] ?? path.join(input, 'contact-sheets'))
const projects = ['desktop-chromium', 'mobile-chromium']
const states = ['standing', 'seated']
const columns = 4
const cellWidth = 216
const cellHeight = 226
const imageSize = 190

fs.mkdirSync(output, { recursive: true })

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

for (const project of projects) {
  for (const state of states) {
    const files = fs.readdirSync(input)
      .filter((file) => file.startsWith(`${project}--${state}--`) && file.endsWith('.png'))
      .sort()
    if (files.length !== 16) throw new Error(`Expected 16 ${project}/${state} captures, found ${files.length}`)

    const rows = Math.ceil(files.length / columns)
    const width = columns * cellWidth
    const height = rows * cellHeight
    const composites = []

    for (const [index, file] of files.entries()) {
      const [, , top, bottom, shoes, hat] = file.replace(/\.png$/, '').split('--')
      const left = (index % columns) * cellWidth + 13
      const topOffset = Math.floor(index / columns) * cellHeight + 29
      const preview = await sharp(path.join(input, file))
        .resize(imageSize, imageSize, { fit: 'cover' })
        .png()
        .toBuffer()
      const label = `${top} / ${bottom}\n${shoes} / ${hat}`
      const svg = Buffer.from(`<svg width="${cellWidth}" height="29" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#172137"/>
        <text x="9" y="11" fill="#f5f7fb" font-family="Arial, sans-serif" font-size="9">${escapeXml(label.split('\n')[0])}</text>
        <text x="9" y="23" fill="#aebbd3" font-family="Arial, sans-serif" font-size="9">${escapeXml(label.split('\n')[1])}</text>
      </svg>`)
      composites.push({ input: svg, left: (index % columns) * cellWidth, top: Math.floor(index / columns) * cellHeight })
      composites.push({ input: preview, left, top: topOffset })
    }

    const target = path.join(output, `${project}--${state}.png`)
    await sharp({ create: { width, height, channels: 4, background: '#0c1322' } })
      .composite(composites)
      .png()
      .toFile(target)
    console.log(target)
  }
}
