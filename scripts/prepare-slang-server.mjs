import { createReadStream, createWriteStream } from 'node:fs'
import { chmod, copyFile, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import extractZip from 'extract-zip'
import tarFs from 'tar-fs'

const workspaceRoot = process.cwd()
const binariesDir = path.join(workspaceRoot, 'binaries')
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const defaultLocalSourcePath = 'C:\\Users\\maksy\\Downloads\\slang-server-windows-x64\\slang-server.exe'
const remoteReleaseRepository = process.env.PRISTINE_SLANG_SERVER_REPOSITORY ?? 'hudson-trading/slang-server'
const remoteReleaseVersion = process.env.PRISTINE_SLANG_SERVER_VERSION ?? 'v0.2.4'
const linuxAssetFlavor = process.env.PRISTINE_SLANG_SERVER_LINUX_FLAVOR ?? 'gcc'

function getBinaryName(platform = process.platform) {
  return platform === 'win32' ? 'slang-server.exe' : 'slang-server'
}

function getTargetPath(platform = process.platform) {
  return path.join(binariesDir, getBinaryName(platform))
}

function getRemoteReleaseAsset(platform = process.platform, arch = process.arch) {
  if (platform === 'win32') {
    if (arch !== 'x64') {
      throw new Error(`Unsupported slang-server architecture for Windows: ${arch}`)
    }

    return {
      archiveFile: 'slang-server-windows-x64.zip',
      archiveKind: 'zip',
    }
  }

  if (platform === 'linux') {
    if (arch !== 'x64') {
      throw new Error(`Unsupported slang-server architecture for Linux: ${arch}`)
    }

    return {
      archiveFile: `slang-server-linux-x64-${linuxAssetFlavor}.tar.gz`,
      archiveKind: 'tar.gz',
    }
  }

  if (platform === 'darwin') {
    return {
      archiveFile: 'slang-server-macos.tar.gz',
      archiveKind: 'tar.gz',
    }
  }

  return null
}

function getRemoteReleaseAssetUrl(archiveFile) {
  return `https://github.com/${remoteReleaseRepository}/releases/download/${remoteReleaseVersion}/${archiveFile}`
}

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

async function ensureExecutable(filePath) {
  if (process.platform !== 'win32') {
    await chmod(filePath, 0o755)
  }
}

async function downloadRemoteFile(url, targetPath, label) {
  let response

  try {
    response = await fetch(url)
  } catch (error) {
    throw new Error(
      `Failed to download ${label} from ${url}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${label}: ${response.status} ${response.statusText}`)
  }

  await mkdir(path.dirname(targetPath), { recursive: true })
  await pipeline(response.body, createWriteStream(targetPath))
}

async function extractTarArchive(archivePath, extractDir) {
  await mkdir(extractDir, { recursive: true })
  await pipeline(
    createReadStream(archivePath),
    createGunzip(),
    tarFs.extract(extractDir),
  )
}

async function extractArchive(archivePath, archiveKind, extractDir) {
  if (archiveKind === 'zip') {
    await extractZip(archivePath, { dir: extractDir })
    return
  }

  if (archiveKind === 'tar.gz') {
    await extractTarArchive(archivePath, extractDir)
    return
  }

  throw new Error(`Unsupported slang-server archive format: ${archiveKind}`)
}

async function findBinaryPath(directoryPath, binaryName) {
  const entries = await readdir(directoryPath, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name)

    if (entry.isFile() && entry.name === binaryName) {
      return entryPath
    }

    if (entry.isDirectory()) {
      const nestedBinaryPath = await findBinaryPath(entryPath, binaryName)
      if (nestedBinaryPath) {
        return nestedBinaryPath
      }
    }
  }

  return null
}

async function copyPreparedBinary(sourcePath, targetPath) {
  const sourceStats = await assertFileExists(sourcePath)
  const existingTargetStats = await readFileStatsIfExists(targetPath)

  if (isTargetUpToDate(sourceStats, existingTargetStats)) {
    await ensureExecutable(targetPath)
    console.log(`Using existing slang-server binary: ${path.relative(workspaceRoot, targetPath)}`)
    return
  }

  await mkdir(path.dirname(targetPath), { recursive: true })

  try {
    await copyFile(sourcePath, targetPath)
  } catch (error) {
    if (error?.code === 'EBUSY') {
      const lockedTargetStats = await readFileStatsIfExists(targetPath)
      if (isTargetUpToDate(sourceStats, lockedTargetStats)) {
        await ensureExecutable(targetPath)
        console.log(`Keeping in-use slang-server binary: ${path.relative(workspaceRoot, targetPath)}`)
        return
      }
    }

    throw error
  }

  await ensureExecutable(targetPath)
  console.log(`Prepared slang-server binary: ${path.relative(workspaceRoot, targetPath)}`)
}

async function prepareBinaryFromRemoteRelease() {
  const releaseAsset = getRemoteReleaseAsset()
  if (!releaseAsset) {
    console.log(`Skipping slang-server prepare on unsupported platform: ${process.platform}`)
    return
  }

  const targetPath = getTargetPath()
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'pristine-slang-server-'))

  try {
    const archivePath = path.join(tempRoot, releaseAsset.archiveFile)
    const extractDir = path.join(tempRoot, 'extract')

    await downloadRemoteFile(
      getRemoteReleaseAssetUrl(releaseAsset.archiveFile),
      archivePath,
      `slang-server release asset ${releaseAsset.archiveFile}`,
    )

    await extractArchive(archivePath, releaseAsset.archiveKind, extractDir)

    const extractedBinaryPath = await findBinaryPath(extractDir, getBinaryName())
    if (!extractedBinaryPath) {
      throw new Error(`Unable to locate ${getBinaryName()} inside ${releaseAsset.archiveFile}`)
    }

    await mkdir(path.dirname(targetPath), { recursive: true })
    await copyFile(extractedBinaryPath, targetPath)
    await ensureExecutable(targetPath)

    console.log(
      `Prepared slang-server binary from GitHub release ${remoteReleaseVersion}: ${path.relative(workspaceRoot, targetPath)}`,
    )
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function main() {
  const explicitSourcePath = process.env.PRISTINE_SLANG_SERVER_SOURCE

  if (explicitSourcePath) {
    await copyPreparedBinary(explicitSourcePath, getTargetPath())
    return
  }

  if (isGitHubActions) {
    await prepareBinaryFromRemoteRelease()
    return
  }

  if (process.platform !== 'win32') {
    console.log('Skipping slang-server prepare on non-Windows platform outside GitHub Actions')
    return
  }

  await copyPreparedBinary(defaultLocalSourcePath, getTargetPath())
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
