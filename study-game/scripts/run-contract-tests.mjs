import { readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const testsDirectory = path.resolve('tests')
const testFiles = (await readdir(testsDirectory))
  .filter((file) => file.endsWith('.test.mjs'))
  .sort()
  .map((file) => path.join(testsDirectory, file))

if (testFiles.length === 0) {
  throw new Error(`No Node contract tests found in ${testsDirectory}`)
}

const child = spawn(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  windowsHide: true,
})

child.once('error', (error) => {
  console.error(error)
  process.exitCode = 1
})

child.once('exit', (code, signal) => {
  if (signal) {
    console.error(`Contract tests terminated by ${signal}`)
    process.exitCode = 1
    return
  }
  process.exitCode = code ?? 1
})
