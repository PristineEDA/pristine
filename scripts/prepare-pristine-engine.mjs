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
const pristineEngineLicensesDir = path.join(workspaceRoot, 'licenses', 'pristine-engine')
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const remoteReleaseRepository = process.env.PRISTINE_ENGINE_REPOSITORY ?? 'PristineEDA/pristine-engine'
const remoteReleaseVersion = process.env.PRISTINE_ENGINE_VERSION ?? 'v0.1.1'
const explicitReleaseAsset = process.env.PRISTINE_ENGINE_ASSET

function getBinaryName(platform = process.platform) {
  return platform === 'win32' ? 'pristine-engine.exe' : 'pristine-engine'
}

function getTargetPath(platform = process.platform) {
  return path.join(binariesDir, getBinaryName(platform))
}

function getDefaultLocalSourcePath(platform = process.platform) {
  return path.resolve(workspaceRoot, '..', 'pristine-engine', 'build', 'dev', getBinaryName(platform))
}

function getDefaultLocalLicensesPath() {
  return path.resolve(workspaceRoot, '..', 'pristine-engine', 'build', 'install-smoke', 'share', 'pristine-engine', 'licenses')
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function getPreferredPlatformAssetId(platform = process.platform, arch = process.arch) {
  const imageOS = (process.env.ImageOS ?? '').toLowerCase()

  if (platform === 'win32') {
    if (imageOS.includes('win22') || imageOS.includes('windows2022')) {
      return `windows-2022-${arch}`
    }

    if (imageOS.includes('win25') || imageOS.includes('windows2025')) {
      return `windows-2025-${arch}`
    }

    return null
  }

  if (platform === 'linux') {
    if (imageOS.includes('ubuntu22') || imageOS.includes('ubuntu-22')) {
      return `ubuntu-22.04-${arch}`
    }

    if (imageOS.includes('ubuntu24') || imageOS.includes('ubuntu-24')) {
      return `ubuntu-24.04-${arch}`
    }

    return null
  }

  if (platform === 'darwin') {
    if (imageOS.includes('macos15') || imageOS.includes('macos-15')) {
      return `macos-15-${arch}`
    }

    if (imageOS.includes('macos26') || imageOS.includes('macos-26')) {
      return `macos-26-${arch}`
    }
  }

  return null
}

function getPlatformAssetIds(platform = process.platform, arch = process.arch) {
  if (arch !== 'x64' && arch !== 'arm64') {
    throw new Error(`Unsupported pristine-engine architecture: ${arch}`)
  }

  if (platform === 'win32') {
    if (arch !== 'x64') {
      throw new Error(`Unsupported pristine-engine architecture for Windows: ${arch}`)
    }

    return unique([
      getPreferredPlatformAssetId(platform, arch),
      `windows-${arch}`,
      `windows-2025-${arch}`,
      `windows-2022-${arch}`,
    ])
  }

  if (platform === 'linux') {
    if (arch !== 'x64') {
      throw new Error(`Unsupported pristine-engine architecture for Linux: ${arch}`)
    }

    return unique([
      getPreferredPlatformAssetId(platform, arch),
      `linux-${arch}`,
      `ubuntu-24.04-${arch}`,
      `ubuntu-22.04-${arch}`,
    ])
  }

  if (platform === 'darwin') {
    return unique([
      getPreferredPlatformAssetId(platform, arch),
      `macos-${arch}`,
      `macos-26-${arch}`,
      `macos-15-${arch}`,
    ])
  }

  return []
}

function getRemoteReleaseAssetCandidates(platform = process.platform, arch = process.arch) {
  if (explicitReleaseAsset) {
    return [explicitReleaseAsset]
  }

  return getPlatformAssetIds(platform, arch).flatMap((assetId) => [
    `pristine-engine-${assetId}.zip`,
    `pristine-engine-${remoteReleaseVersion}-${assetId}.zip`,
  ])
}

function getRemoteReleaseAssetUrl(archiveFile) {
  return `https://github.com/${remoteReleaseRepository}/releases/download/${remoteReleaseVersion}/${archiveFile}`
}

function getArchiveKind(archiveFile) {
  if (archiveFile.endsWith('.zip')) {
    return 'zip'
  }

  if (archiveFile.endsWith('.tar.gz')) {
    return 'tar.gz'
  }

  throw new Error(`Unsupported pristine-engine archive format: ${archiveFile}`)
}

async function assertFileExists(filePath, label = 'file') {
  let fileStats

  try {
    fileStats = await stat(filePath)
  } catch {
    throw new Error(`Pristine Engine ${label} not found at ${filePath}`)
  }

  if (!fileStats.isFile()) {
    throw new Error(`Pristine Engine ${label} path is not a file: ${filePath}`)
  }

  return fileStats
}

async function assertDirectoryExists(directoryPath, label = 'directory') {
  let directoryStats

  try {
    directoryStats = await stat(directoryPath)
  } catch {
    throw new Error(`Pristine Engine ${label} not found at ${directoryPath}`)
  }

  if (!directoryStats.isDirectory()) {
    throw new Error(`Pristine Engine ${label} path is not a directory: ${directoryPath}`)
  }

  return directoryStats
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

async function removeLegacySlangServerBinaries() {
  await Promise.all([
    rm(path.join(binariesDir, 'slang-server'), { force: true }),
    rm(path.join(binariesDir, 'slang-server.exe'), { force: true }),
  ])
}

async function downloadRemoteFileIfAvailable(url, targetPath, label) {
  let response

  try {
    response = await fetch(url)
  } catch (error) {
    throw new Error(
      `Failed to download ${label} from ${url}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (response.status === 404) {
    return false
  }

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${label}: ${response.status} ${response.statusText}`)
  }

  await mkdir(path.dirname(targetPath), { recursive: true })
  await pipeline(response.body, createWriteStream(targetPath))
  return true
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

  throw new Error(`Unsupported pristine-engine archive format: ${archiveKind}`)
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

async function findLicenseBundlePath(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const fileNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name))

  if (fileNames.has('LICENSE') && fileNames.has('ATTRIBUTIONS.md') && fileNames.has('NOTICE')) {
    return directoryPath
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const nestedBundlePath = await findLicenseBundlePath(path.join(directoryPath, entry.name))
    if (nestedBundlePath) {
      return nestedBundlePath
    }
  }

  return null
}

async function copyLicenseBundle(sourceDirectoryPath) {
  await assertDirectoryExists(sourceDirectoryPath, 'license bundle')
  await Promise.all([
    assertFileExists(path.join(sourceDirectoryPath, 'LICENSE'), 'LICENSE'),
    assertFileExists(path.join(sourceDirectoryPath, 'ATTRIBUTIONS.md'), 'ATTRIBUTIONS.md'),
    assertFileExists(path.join(sourceDirectoryPath, 'NOTICE'), 'NOTICE'),
  ])

  await rm(pristineEngineLicensesDir, { recursive: true, force: true })
  await mkdir(pristineEngineLicensesDir, { recursive: true })

  await Promise.all([
    copyFile(path.join(sourceDirectoryPath, 'LICENSE'), path.join(pristineEngineLicensesDir, 'LICENSE')),
    copyFile(path.join(sourceDirectoryPath, 'ATTRIBUTIONS.md'), path.join(pristineEngineLicensesDir, 'ATTRIBUTIONS.md')),
    copyFile(path.join(sourceDirectoryPath, 'NOTICE'), path.join(pristineEngineLicensesDir, 'NOTICE')),
  ])

  console.log(`Prepared pristine-engine notices: ${path.relative(workspaceRoot, pristineEngineLicensesDir)}`)
}

async function copyPreparedBinary(sourcePath, targetPath) {
  const sourceStats = await assertFileExists(sourcePath, 'binary')
  const existingTargetStats = await readFileStatsIfExists(targetPath)

  await removeLegacySlangServerBinaries()

  if (isTargetUpToDate(sourceStats, existingTargetStats)) {
    await ensureExecutable(targetPath)
    console.log(`Using existing pristine-engine binary: ${path.relative(workspaceRoot, targetPath)}`)
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
        console.log(`Keeping in-use pristine-engine binary: ${path.relative(workspaceRoot, targetPath)}`)
        return
      }
    }

    throw error
  }

  await ensureExecutable(targetPath)
  console.log(`Prepared pristine-engine binary: ${path.relative(workspaceRoot, targetPath)}`)
}

async function downloadRemoteReleaseAsset(tempRoot) {
  const releaseAssetCandidates = getRemoteReleaseAssetCandidates()

  if (releaseAssetCandidates.length === 0) {
    console.log(`Skipping pristine-engine prepare on unsupported platform: ${process.platform}`)
    return null
  }

  for (const archiveFile of releaseAssetCandidates) {
    const archivePath = path.join(tempRoot, archiveFile)
    const url = getRemoteReleaseAssetUrl(archiveFile)
    const didDownload = await downloadRemoteFileIfAvailable(
      url,
      archivePath,
      `pristine-engine release asset ${archiveFile}`,
    )

    if (didDownload) {
      return {
        archiveFile,
        archiveKind: getArchiveKind(archiveFile),
        archivePath,
      }
    }
  }

  throw new Error(
    `Unable to download a pristine-engine release asset from ${remoteReleaseRepository}@${remoteReleaseVersion}. Tried: ${releaseAssetCandidates.join(', ')}`,
  )
}

async function prepareBinaryFromRemoteRelease() {
  const targetPath = getTargetPath()
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'pristine-engine-'))

  try {
    const releaseAsset = await downloadRemoteReleaseAsset(tempRoot)
    if (!releaseAsset) {
      return
    }

    const extractDir = path.join(tempRoot, 'extract')

    await extractArchive(releaseAsset.archivePath, releaseAsset.archiveKind, extractDir)

    const extractedBinaryPath = await findBinaryPath(extractDir, getBinaryName())
    if (!extractedBinaryPath) {
      throw new Error(`Unable to locate ${getBinaryName()} inside ${releaseAsset.archiveFile}`)
    }

    const licenseBundlePath = await findLicenseBundlePath(extractDir)
    if (!licenseBundlePath) {
      throw new Error(`Unable to locate pristine-engine LICENSE, ATTRIBUTIONS.md, and NOTICE inside ${releaseAsset.archiveFile}`)
    }

    await copyPreparedBinary(extractedBinaryPath, targetPath)
    await copyLicenseBundle(licenseBundlePath)

    console.log(
      `Prepared pristine-engine from GitHub release ${remoteReleaseVersion}: ${path.relative(workspaceRoot, targetPath)}`,
    )
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function prepareBinaryFromLocalSource(sourcePath) {
  const licenseBundlePath = process.env.PRISTINE_ENGINE_LICENSES_SOURCE ?? getDefaultLocalLicensesPath()

  await copyPreparedBinary(sourcePath, getTargetPath())
  await copyLicenseBundle(licenseBundlePath)
}

async function main() {
  const explicitSourcePath = process.env.PRISTINE_ENGINE_SOURCE

  if (explicitSourcePath) {
    await prepareBinaryFromLocalSource(explicitSourcePath)
    return
  }

  if (isGitHubActions) {
    await prepareBinaryFromRemoteRelease()
    return
  }

  if (process.platform !== 'win32') {
    console.log('Skipping pristine-engine prepare on non-Windows platform outside GitHub Actions')
    return
  }

  await prepareBinaryFromLocalSource(getDefaultLocalSourcePath())
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})