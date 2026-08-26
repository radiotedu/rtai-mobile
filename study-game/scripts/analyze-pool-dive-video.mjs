import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from '@playwright/test'
import sharp from 'sharp'

const videoPath = path.resolve(process.argv[2] ?? '')
const outputDir = path.resolve(process.argv[3] ?? '../artifacts/study-game/pool-dive-frame-audit')
const frameRate = 8
const framesDir = path.join(outputDir, 'frames-8fps')
const contactSheetPath = path.join(outputDir, 'contact-sheet.png')
const reportPath = path.join(outputDir, 'frame-analysis.json')

if (!videoPath) throw new Error('Pass the Playwright video path as the first argument.')

await rm(framesDir, { recursive: true, force: true })
await mkdir(framesDir, { recursive: true })

const videoBytes = await readFile(videoPath)
const videoSha256 = createHash('sha256').update(videoBytes).digest('hex')
const browser = await chromium.launch({ headless: true })
let metadata

try {
  const page = await browser.newPage()
  await page.setContent(`
    <style>html,body{margin:0;background:#081012}canvas{display:block}</style>
    <video id="source" muted preload="auto"></video>
    <canvas id="frame"></canvas>
  `)
  const source = `data:video/webm;base64,${videoBytes.toString('base64')}`
  metadata = await page.evaluate(async (src) => {
    const video = document.querySelector('#source')
    const canvas = document.querySelector('#frame')
    video.src = src
    video.load()
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', resolve, { once: true })
        video.addEventListener('error', () => reject(new Error('Video metadata could not be decoded.')), { once: true })
      })
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight }
  }, source)

  if (!Number.isFinite(metadata.duration) || metadata.duration <= 0 || metadata.width <= 0 || metadata.height <= 0) {
    throw new Error('Chromium returned invalid video metadata.')
  }

  await page.setViewportSize({ width: metadata.width, height: metadata.height })
  const frameCount = Math.max(1, Math.ceil(metadata.duration * frameRate))
  for (let index = 0; index < frameCount; index += 1) {
    const atSeconds = Math.min(metadata.duration - 0.001, index / frameRate)
    await page.evaluate(async (time) => {
      const video = document.querySelector('#source')
      const canvas = document.querySelector('#frame')
      if (Math.abs(video.currentTime - time) > 0.001) {
        const seeked = new Promise((resolve, reject) => {
          video.addEventListener('seeked', resolve, { once: true })
          video.addEventListener('error', () => reject(new Error('Video seek failed.')), { once: true })
        })
        video.currentTime = time
        await seeked
      }
      canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height)
    }, atSeconds)
    await page.locator('#frame').screenshot({
      path: path.join(framesDir, `frame-${String(index + 1).padStart(5, '0')}.png`),
    })
  }
} finally {
  await browser.close()
}

const files = (await readdir(framesDir)).filter((file) => file.endsWith('.png')).sort()
const frames = []
let previousPixels = null
for (const [index, file] of files.entries()) {
  const { data } = await sharp(path.join(framesDir, file))
    .resize({ width: 64, height: 64, fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let meanDelta = null
  if (previousPixels) {
    let delta = 0
    for (let offset = 0; offset < data.length; offset += 1) delta += Math.abs(data[offset] - previousPixels[offset])
    meanDelta = delta / data.length / 255
  }
  frames.push({ file, atMs: Math.round(index * 1_000 / frameRate), meanDelta })
  previousPixels = data
}

let stillRun = 0
let longestStillRun = 0
for (const frame of frames) {
  if (frame.meanDelta !== null && frame.meanDelta < 0.000_02) stillRun += 1
  else stillRun = 0
  longestStillRun = Math.max(longestStillRun, stillRun)
}

const contactCount = Math.min(12, files.length)
const contactFiles = Array.from({ length: contactCount }, (_, index) => (
  files[Math.round(index * (files.length - 1) / Math.max(1, contactCount - 1))]
))
const thumbWidth = 320
const thumbHeight = Math.round(thumbWidth * metadata.height / metadata.width)
const columns = Math.min(4, contactCount)
const rows = Math.ceil(contactCount / columns)
const composites = await Promise.all(contactFiles.map(async (file, index) => ({
  input: await sharp(path.join(framesDir, file)).resize({ width: thumbWidth, height: thumbHeight, fit: 'fill' }).png().toBuffer(),
  left: (index % columns) * thumbWidth,
  top: Math.floor(index / columns) * thumbHeight,
})))
await sharp({
  create: { width: columns * thumbWidth, height: rows * thumbHeight, channels: 4, background: { r: 8, g: 16, b: 18, alpha: 1 } },
}).composite(composites).png().toFile(contactSheetPath)

const report = {
  videoPath,
  videoSha256,
  frameRate,
  frameCount: frames.length,
  durationMs: Math.round(metadata.duration * 1_000),
  dimensions: { width: metadata.width, height: metadata.height },
  changedFrameCount: frames.filter((frame) => frame.meanDelta !== null && frame.meanDelta >= 0.000_02).length,
  longestStillRunFrames: longestStillRun,
  longestStillRunMs: Math.round(longestStillRun * 1_000 / frameRate),
  contactSheetPath,
  frames,
}
await writeFile(reportPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  reportPath,
  contactSheetPath,
  frameCount: report.frameCount,
  durationMs: report.durationMs,
  dimensions: report.dimensions,
  changedFrameCount: report.changedFrameCount,
  longestStillRunMs: report.longestStillRunMs,
}))
