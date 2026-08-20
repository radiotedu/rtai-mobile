import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '.')
const timeline = JSON.parse(await readFile(resolve(root, 'timeline.json'), 'utf8'))
const frames = timeline.filter((entry) => entry.frame)
if (frames.length === 0) throw new Error('The frame audit has no screenshots.')

const lines = ['ffconcat version 1.0']
for (let index = 0; index < frames.length; index += 1) {
  lines.push(`file '${frames[index].frame}'`)
  if (index < frames.length - 1) {
    lines.push(`duration ${Math.max(0.12, (frames[index + 1].at - frames[index].at) / 1000).toFixed(3)}`)
  }
}
lines.push(`file '${frames.at(-1).frame}'`)
await writeFile(resolve(root, 'frames.ffconcat'), `${lines.join('\n')}\n`)
console.log(`Indexed ${frames.length} frame-audit screenshots.`)
