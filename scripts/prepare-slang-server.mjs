import { copyFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'

const workspaceRoot = process.cwd()
const defaultSourcePath = 'C:\\Users\\maksy\\Downloads\\slang-server-windows-x64\\slang-server.exe'
const sourcePath = process.env.PRISTINE_SLANG_SERVER_SOURCE ?? defaultSourcePath
const binariesDir = path.join(workspaceRoot, 'binaries')
const targetPath = path.join(binariesDir, 'slang-server.exe')

async function assertFileExists(filePath) {
  let fileStats

  try {
    fileStats = await stat(filePath)
  } catch {
    throw new Error(`Slang server binary not found at ${filePath}`)
  }

  if (!fileStats.isFile()) {
    throw new Error(`Slang server binary path is not a file: ${filePath}`)
  }

  return fileStats
}

async function readFileStatsIfExists(filePath) {
  try {
    return await stat(filePath)
  } catch {
    return null
  }
}

function isTargetUpToDate(sourceStats, targetStats) {
  return Boolean(
    targetStats &&
    targetStats.isFile() &&
    targetStats.size === sourceStats.size &&
    targetStats.mtimeMs >= sourceStats.mtimeMs,
  )
}

async function main() {
  if (process.platform !== 'win32') {
    console.log('Skipping slang-server prepare on non-Windows platform')
    return
  }

  const sourceStats = await assertFileExists(sourcePath)
  const existingTargetStats = await readFileStatsIfExists(targetPath)

  if (isTargetUpToDate(sourceStats, existingTargetStats)) {
    console.log(`Using existing slang-server binary: ${path.relative(workspaceRoot, targetPath)}`)
    return
  }

  await mkdir(binariesDir, { recursive: true })

  try {
    await copyFile(sourcePath, targetPath)
  } catch (error) {
    if (error?.code === 'EBUSY') {
      const lockedTargetStats = await readFileStatsIfExists(targetPath)
      if (isTargetUpToDate(sourceStats, lockedTargetStats)) {
        console.log(`Keeping in-use slang-server binary: ${path.relative(workspaceRoot, targetPath)}`)
        return
      }
    }

    throw error
  }

  console.log(`Prepared slang-server binary: ${path.relative(workspaceRoot, targetPath)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})