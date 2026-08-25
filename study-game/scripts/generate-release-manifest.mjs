import { createHash } from 'node:crypto'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(process.argv[2] ?? '.')
const outputName = 'RELEASE_MANIFEST.json'
const excludedDirectories = new Set(['node_modules', '.git', 'playwright-report', 'test-results', 'tmp'])
const excludedFiles = new Set([outputName])
const files = []

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(absolute)
    else if (entry.isFile() && !excludedFiles.has(entry.name) && !entry.name.endsWith('.log')) files.push(absolute)
  }
}

await walk(root)
files.sort((left, right) => left.localeCompare(right, 'en'))

const entries = []
for (const absolute of files) {
  const bytes = await readFile(absolute)
  const details = await stat(absolute)
  entries.push({
    file: path.relative(root, absolute).replaceAll(path.sep, '/'),
    bytes: details.size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  })
}

const manifest = {
  format: 1,
  generatedAt: new Date().toISOString(),
  package: 'RadioTEDU Social',
  publicPath: 'https://radiotedu.com/social/',
  secretsIncluded: false,
  files: entries,
}

await writeFile(path.join(root, outputName), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ status: 'passed', output: path.join(root, outputName), files: entries.length }))
