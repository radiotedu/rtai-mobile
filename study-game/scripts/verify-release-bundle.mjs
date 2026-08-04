import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(process.argv[2] ?? '.')
const excludedDirectories = new Set(['node_modules', '.git', 'playwright-report', 'test-results'])
const forbiddenNames = [
  /^\.env(?:\..+)?$/i,
  /^(?:google-services|credentials|service-account)\.json$/i,
  /\.(?:pem|key|p12|pfx|jks|keystore)$/i,
]
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.ps1', '.ts', '.txt', '.yaml', '.yml'])
const secretPatterns = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: 'OpenAI-style token', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: 'literal bearer credential', pattern: /Bearer\s+[A-Za-z0-9._~-]{24,}/i },
  { name: 'credential-bearing database URL', pattern: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/:]+:[^\s@]+@/i },
]

const files = []
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(absolute)
    else if (entry.isFile()) files.push(absolute)
  }
}

await walk(root)
const findings = []
const manifest = []
for (const absolute of files) {
  const relative = path.relative(root, absolute).replaceAll(path.sep, '/')
  if (forbiddenNames.some((pattern) => pattern.test(path.basename(relative)))) {
    findings.push({ file: relative, issue: 'forbidden secret-bearing filename' })
  }
  const buffer = await readFile(absolute)
  const details = await stat(absolute)
  manifest.push({ file: relative, bytes: details.size, sha256: createHash('sha256').update(buffer).digest('hex') })
  if (!textExtensions.has(path.extname(relative).toLowerCase())) continue
  const content = buffer.toString('utf8')
  for (const secret of secretPatterns) {
    if (secret.pattern.test(content)) findings.push({ file: relative, issue: secret.name })
  }
}

const result = {
  status: findings.length === 0 ? 'passed' : 'failed',
  root,
  filesScanned: files.length,
  bytesScanned: manifest.reduce((sum, entry) => sum + entry.bytes, 0),
  findings,
}
console.log(JSON.stringify(result, null, 2))
if (findings.length > 0) process.exitCode = 1

export { manifest }
