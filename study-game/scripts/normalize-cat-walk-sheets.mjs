import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

const root = process.cwd()
const inputDirectory = path.join(root, 'art', 'npcs', 'walk-sources')
const outputDirectory = path.join(root, 'public', 'assets', 'npcs')
const columns = 4
const rows = 8
const frameWidth = 256
const frameHeight = 192
const baselineY = 184
const maximumSubjectWidth = 224
const maximumSubjectHeight = 180
const alphaThreshold = 16
const minimumComponentPixels = 200

await mkdir(outputDirectory, { recursive: true })

function findSubjects(data, width, height) {
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  const subjects = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x
      if (visited[start] || data[start * 4 + 3] <= alphaThreshold) continue

      let head = 0
      let tail = 0
      let pixels = 0
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      visited[start] = 1
      queue[tail++] = start

      while (head < tail) {
        const current = queue[head++]
        const currentX = current % width
        const currentY = Math.floor(current / width)
        pixels += 1
        minX = Math.min(minX, currentX)
        maxX = Math.max(maxX, currentX)
        minY = Math.min(minY, currentY)
        maxY = Math.max(maxY, currentY)

        const neighbours = [current - 1, current + 1, current - width, current + width]
        for (const neighbour of neighbours) {
          const neighbourX = neighbour % width
          if (neighbour < 0 || neighbour >= visited.length) continue
          if (Math.abs(neighbourX - currentX) > 1) continue
          if (visited[neighbour] || data[neighbour * 4 + 3] <= alphaThreshold) continue
          visited[neighbour] = 1
          queue[tail++] = neighbour
        }
      }

      if (pixels >= minimumComponentPixels) {
        subjects.push({
          pixels,
          minX,
          minY,
          maxX,
          maxY,
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
        })
      }
    }
  }

  if (subjects.length !== columns * rows) {
    throw new Error(`Expected ${columns * rows} cat subjects, found ${subjects.length}`)
  }

  const orderedByRow = subjects.sort((a, b) => a.centerY - b.centerY)
  return Array.from({ length: rows }, (_, row) => (
    orderedByRow
      .slice(row * columns, (row + 1) * columns)
      .sort((a, b) => a.centerX - b.centerX)
  ))
}

for (const name of ['tarcin', 'benek', 'komur']) {
  const input = path.join(inputDirectory, `${name}-alpha.png`)
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (!info.width || !info.height || info.channels !== 4) {
    throw new Error(`${name} walk source must be an RGBA image`)
  }

  const subjects = findSubjects(data, info.width, info.height)
  const widest = Math.max(...subjects.flat().map((subject) => subject.maxX - subject.minX + 1))
  const tallest = Math.max(...subjects.flat().map((subject) => subject.maxY - subject.minY + 1))
  const scale = Math.min(maximumSubjectWidth / widest, maximumSubjectHeight / tallest)
  const composites = []
  const baselines = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const subject = subjects[row][column]
      const sourceWidth = subject.maxX - subject.minX + 1
      const sourceHeight = subject.maxY - subject.minY + 1
      const width = Math.max(1, Math.round(sourceWidth * scale))
      const height = Math.max(1, Math.round(sourceHeight * scale))
      const left = column * frameWidth + Math.round((frameWidth - width) / 2)
      const top = row * frameHeight + baselineY - height
      const frame = await sharp(input)
        .extract({ left: subject.minX, top: subject.minY, width: sourceWidth, height: sourceHeight })
        .resize(width, height, { fit: 'fill' })
        .png()
        .toBuffer()

      composites.push({ input: frame, left, top })
      baselines.push(top + height - row * frameHeight)
    }
  }

  const output = path.join(outputDirectory, `campus-cat-${name}-walk.png`)
  await sharp({
    create: {
      width: columns * frameWidth,
      height: rows * frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(composites).png().toFile(output)

  console.log(JSON.stringify({
    name,
    output,
    frames: columns * rows,
    width: columns * frameWidth,
    height: rows * frameHeight,
    subjectScale: scale,
    baselineRange: [Math.min(...baselines), Math.max(...baselines)],
  }))
}
