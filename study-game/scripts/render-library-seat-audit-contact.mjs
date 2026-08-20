import { readdir, readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import sharp from 'sharp'

const auditRoot = resolve(process.argv[2] ?? 'release-evidence/frame-audit-2026-08-09/all-library-seats-final')
const targets = JSON.parse(await readFile(join(auditRoot, 'seat-targets.json'), 'utf8'))
const targetById = new Map(targets.map((target) => [target.id, target]))
const files = (await readdir(auditRoot))
  .filter((file) => /^\d{2}-.+\.jpg$/.test(file))
  .sort()

const tileWidth = 300
const imageHeight = 225
const labelHeight = 25
const columns = 5

async function renderContact(name, selected) {
  const rows = Math.ceil(selected.length / columns)
  const composites = []
  for (const [index, file] of selected.entries()) {
    const id = basename(file, '.jpg').replace(/^\d{2}-/, '')
    const target = targetById.get(id)
    if (!target) throw new Error(`Missing tap target for ${id}`)
    const left = Math.max(0, Math.min(1280 - 240, Math.round(target.screen.x - 120)))
    const top = Math.max(0, Math.min(720 - 180, Math.round(target.screen.y - 130)))
    const crop = await sharp(join(auditRoot, file))
      .extract({ left, top, width: 240, height: 180 })
      .resize(tileWidth, imageHeight, { kernel: sharp.kernel.nearest })
      .jpeg({ quality: 92 })
      .toBuffer()
    const x = (index % columns) * tileWidth
    const y = Math.floor(index / columns) * (imageHeight + labelHeight)
    composites.push({ input: crop, left: x, top: y })
    composites.push({
      input: Buffer.from(`<svg width="${tileWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#071a25"/><text x="8" y="18" fill="#e9f8f3" font-family="Arial" font-size="15">${file.replace('.jpg', '')}</text></svg>`),
      left: x,
      top: y + imageHeight,
    })
  }
  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * (imageHeight + labelHeight),
      channels: 3,
      background: '#06151e',
    },
  }).composite(composites).png().toFile(join(auditRoot, name))
}

await renderContact('all-51-seats-contact.png', files)
console.log(`Rendered ${files.length} audited Library seats.`)
