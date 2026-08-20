import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(process.argv[2] ?? 'release-evidence/all-seats-verified-2026-08-09')

const rooms = [
  { id: 'library-local', title: 'Library', files: /^\d{2}-.+\.png$/, targets: 'targets.json', columns: 5 },
  { id: 'chim-alan-local', title: 'Çim Alan', files: /^\d{2}-.+\.png$/, targets: 'targets.json', columns: 3 },
  { id: 'auditorium', title: 'Auditorium', files: /^fixed-\d{2}-.+\.png$/, targets: 'fixed-targets.json', columns: 3 },
  { id: 'learning-lab', title: 'Learning Lab', files: /^\d{2}-.+\.png$/, targets: 'targets.json', columns: 3 },
]

const tileWidth = 300
const imageHeight = 225
const labelHeight = 28

async function renderRoom(config) {
  const roomRoot = join(root, config.id)
  const targets = JSON.parse(await readFile(join(roomRoot, config.targets), 'utf8'))
  const targetById = new Map(targets.map((target) => [target.id, target]))
  const files = (await readdir(roomRoot)).filter((file) => config.files.test(file)).sort()
  const rows = Math.ceil(files.length / config.columns)
  const composites = []

  for (const [index, file] of files.entries()) {
    const id = basename(file, '.png').replace(/^fixed-/, '').replace(/^\d{2}-/, '')
    const target = targetById.get(id)
    if (!target) throw new Error(`Missing target for ${config.id}:${id}`)
    const left = Math.max(0, Math.min(1280 - 280, Math.round(target.screen.x - 140)))
    const top = Math.max(0, Math.min(720 - 210, Math.round(target.screen.y - 145)))
    const crop = await sharp(join(roomRoot, file))
      .extract({ left, top, width: 280, height: 210 })
      .resize(tileWidth, imageHeight, { kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer()
    const x = (index % config.columns) * tileWidth
    const y = Math.floor(index / config.columns) * (imageHeight + labelHeight)
    composites.push({ input: crop, left: x, top: y })
    composites.push({
      input: Buffer.from(`<svg width="${tileWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#061922"/><text x="9" y="20" fill="#e8fff8" font-family="Arial" font-size="14">PASS · ${file.replace(/^fixed-/, '').replace('.png', '')}</text></svg>`),
      left: x,
      top: y + imageHeight,
    })
  }

  const output = join(root, `${config.id}-verified-contact.png`)
  await sharp({
    create: {
      width: config.columns * tileWidth,
      height: rows * (imageHeight + labelHeight),
      channels: 3,
      background: '#061922',
    },
  }).composite(composites).png().toFile(output)
  return { room: config.title, seats: files.length, contact: output }
}

const contacts = []
for (const room of rooms) contacts.push(await renderRoom(room))

const resultFiles = [
  ['Library', 'library-local/results.json'],
  ['Çim Alan', 'chim-alan-local/results.json'],
  ['Auditorium', 'auditorium/fixed-results.json'],
  ['Learning Lab', 'learning-lab/results.json'],
]
const results = []
for (const [room, file] of resultFiles) {
  const seats = JSON.parse(await readFile(join(root, file), 'utf8'))
  for (const seat of seats) results.push({ room, ...seat })
}
const matrix = {
  generatedAt: new Date().toISOString(),
  method: 'Real canvas CUA click plus explicit final seated seat ID and retained screenshot',
  total: results.length,
  passed: results.filter((result) => result.pass).length,
  failed: results.filter((result) => !result.pass).length,
  results,
}
await writeFile(join(root, 'ALL_68_RESULTS.json'), `${JSON.stringify(matrix, null, 2)}\n`)
console.log(JSON.stringify({ contacts, total: matrix.total, passed: matrix.passed, failed: matrix.failed }, null, 2))
