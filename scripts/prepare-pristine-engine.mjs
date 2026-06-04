import { createReadStream, createWriteStream } from 'node:fs'
import { chmod, copyFile, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import extractZip from 'extract-zip'
import tarFs from 'tar-fs'
import {
  DEFAULT_PRISTINE_ENGINE_ARTIFACT_BRANCH,
  DEFAULT_PRISTINE_ENGINE_ARTIFACT_WORKFLOW,
  DEFAULT_PRISTINE_ENGINE_REPOSITORY,
  getRemoteSourceMode,
  resolveReleaseDownload,
  resolveWorkflowArtifactDownload,
} from './pristine-engine-remote-source.mjs'

const workspaceRoot = process.cwd()
const binariesDir = path.join(workspaceRoot, 'binaries')
const pristineEngineLicensesDir = path.join(workspaceRoot, 'licenses', 'pristine-engine')
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const remoteRepository = process.env.PRISTINE_ENGINE_REPOSITORY ?? DEFAULT_PRISTINE_ENGINE_REPOSITORY
const remoteReleaseVersion = process.env.PRISTINE_ENGINE_VERSION
const explicitReleaseAsset = process.env.PRISTINE_ENGINE_ASSET
const remoteArtifactBranch = process.env.PRISTINE_ENGINE_ARTIFACT_BRANCH ?? DEFAULT_PRISTINE_ENGINE_ARTIFACT_BRANCH
const remoteArtifactWorkflow = process.env.PRISTINE_ENGINE_ARTIFACT_WORKFLOW ?? DEFAULT_PRISTINE_ENGINE_ARTIFACT_WORKFLOW
const explicitWorkflowArtifact = process.env.PRISTINE_ENGINE_ARTIFACT

function getBinaryName(platform = process.platform) {
  return platform === 'win32' ? 'pristine-engine.exe' : 'pristine-engine'
}

function getTargetPath(platform = process.platform) {
  return path.join(binariesDir, getBinaryName(platform))
}

function getDefaultLocalSourceCandidates(platform = process.platform) {
  const binaryName = getBinaryName(platform)

  return [
    path.resolve(workspaceRoot, '..', 'pristine-engine', 'build', 'release', binaryName),
    path.resolve(workspaceRoot, '..', 'pristine-engine', 'build', 'install-smoke', 'bin', binaryName),
  ]
}

function getDefaultLocalLicensesPath() {
  return path.resolve(workspaceRoot, '..', 'pristine-engine', 'build', 'install-smoke', 'share', 'pristine-engine', 'licenses')
}

async function resolveDefaultLocalSourcePath(platform = process.platform) {
  const sourceCandidates = getDefaultLocalSourceCandidates(platform)

  for (const sourceCandidate of sourceCandidates) {
    const sourceStats = await readFileStatsIfExists(sourceCandidate)
    if (sourceStats?.isFile()) {
      return sourceCandidate
    }
  }

  throw new Error(
    [
      'Pristine Engine local release binary not found.',
      'Build pristine-engine with the release preset or install-smoke target before packaging Pristine.',
      'Tried:',
      ...sourceCandidates.map((sourceCandidate) => `  - ${sourceCandidate}`),
    ].join('\n'),
  )
}

function normalizePathForMatching(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/').toLowerCase()
}

function isKnownDebugLocalSourcePath(sourcePath) {
  const normalizedSourcePath = normalizePathForMatching(sourcePath)

  return normalizedSourcePath.includes('/build/dev/')
    || normalizedSourcePath.includes('/build/clang-cl/')
}

function assertNonDebugLocalSourcePath(sourcePath) {
  if (process.env.PRISTINE_ENGINE_ALLOW_DEBUG_SOURCE === '1' || !isKnownDebugLocalSourcePath(sourcePath)) {
    return
  }

  throw new Error(
    [
      `Debug pristine-engine source is not allowed for packaging/build: ${sourcePath}`,
      'Use a non-debug source such as build/release or build/install-smoke/bin.',
      'Set PRISTINE_ENGINE_ALLOW_DEBUG_SOURCE=1 only when intentionally testing a debug engine.',
    ].join('\n'),
  )
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

function getRemoteDownloadHeaders() {
  const token = process.env.PRISTINE_ENGINE_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN

  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function downloadRemoteFileIfAvailable(url, targetPath, label, headers = {}) {
  let response

  try {
    response = await fetch(url, { headers })
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
  const releaseDownload = await resolveReleaseDownload({
    repository: remoteRepository,
    releaseVersion: remoteReleaseVersion,
    explicitAsset: explicitReleaseAsset,
  })

  if (!releaseDownload) {
    console.log(`Skipping pristine-engine prepare on unsupported platform: ${process.platform}`)
    return null
  }

  const archivePath = path.join(tempRoot, releaseDownload.archiveFile)
  const didDownload = await downloadRemoteFileIfAvailable(
    releaseDownload.archiveUrl,
    archivePath,
    `pristine-engine ${releaseDownload.sourceLabel}`,
    getRemoteDownloadHeaders(),
  )

  if (!didDownload) {
    throw new Error(`Unable to download pristine-engine ${releaseDownload.sourceLabel}`)
  }

  return {
    archiveFile: releaseDownload.archiveFile,
    archiveKind: getArchiveKind(releaseDownload.archiveFile),
    archivePath,
    sourceLabel: releaseDownload.sourceLabel,
  }
}

async function prepareBinaryFromRemoteArchive(downloadRemoteArchive) {
  const targetPath = getTargetPath()
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'pristine-engine-'))

  try {
    const remoteArchive = await downloadRemoteArchive(tempRoot)
    if (!remoteArchive) {
      return
    }

    const extractDir = path.join(tempRoot, 'extract')

    await extractArchive(remoteArchive.archivePath, remoteArchive.archiveKind, extractDir)

    const extractedBinaryPath = await findBinaryPath(extractDir, getBinaryName())
    if (!extractedBinaryPath) {
      throw new Error(`Unable to locate ${getBinaryName()} inside ${remoteArchive.archiveFile}`)
    }

    const licenseBundlePath = await findLicenseBundlePath(extractDir)
    if (!licenseBundlePath) {
      throw new Error(`Unable to locate pristine-engine LICENSE, ATTRIBUTIONS.md, and NOTICE inside ${remoteArchive.archiveFile}`)
    }

    await copyPreparedBinary(extractedBinaryPath, targetPath)
    await copyLicenseBundle(licenseBundlePath)

    console.log(
      `Prepared pristine-engine from ${remoteArchive.sourceLabel}: ${path.relative(workspaceRoot, targetPath)}`,
    )
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function prepareBinaryFromRemoteRelease() {
  await prepareBinaryFromRemoteArchive(downloadRemoteReleaseAsset)
}

async function downloadRemoteWorkflowArtifact(tempRoot) {
  const artifactDownload = await resolveWorkflowArtifactDownload({
    repository: remoteRepository,
    workflow: remoteArtifactWorkflow,
    branch: remoteArtifactBranch,
    explicitArtifact: explicitWorkflowArtifact,
  })

  if (!artifactDownload) {
    console.log(`Skipping pristine-engine prepare on unsupported platform: ${process.platform}`)
    return null
  }

  const archivePath = path.join(tempRoot, artifactDownload.archiveFile)
  const didDownload = await downloadRemoteFileIfAvailable(
    artifactDownload.archiveUrl,
    archivePath,
    `pristine-engine ${artifactDownload.sourceLabel}`,
    getRemoteDownloadHeaders(),
  )

  if (!didDownload) {
    throw new Error(`Unable to download pristine-engine ${artifactDownload.sourceLabel}`)
  }

  return {
    archiveFile: artifactDownload.archiveFile,
    archiveKind: getArchiveKind(artifactDownload.archiveFile),
    archivePath,
    sourceLabel: artifactDownload.sourceLabel,
  }
}

async function prepareBinaryFromRemoteWorkflowArtifact() {
  await prepareBinaryFromRemoteArchive(downloadRemoteWorkflowArtifact)
}

async function prepareBinaryFromLocalSource(sourcePath) {
  const resolvedSourcePath = path.resolve(sourcePath)
  const licenseBundlePath = process.env.PRISTINE_ENGINE_LICENSES_SOURCE ?? getDefaultLocalLicensesPath()

  assertNonDebugLocalSourcePath(resolvedSourcePath)
  await copyPreparedBinary(resolvedSourcePath, getTargetPath())
  await copyLicenseBundle(licenseBundlePath)
}

async function main() {
  const explicitSourcePath = process.env.PRISTINE_ENGINE_SOURCE

  if (explicitSourcePath) {
    await prepareBinaryFromLocalSource(explicitSourcePath)
    return
  }

  if (isGitHubActions) {
    const remoteSourceMode = getRemoteSourceMode({
      mode: process.env.PRISTINE_ENGINE_REMOTE_SOURCE_MODE ?? 'auto',
      ref: process.env.GITHUB_REF ?? '',
    })

    if (remoteSourceMode === 'release') {
      await prepareBinaryFromRemoteRelease()
      return
    }

    await prepareBinaryFromRemoteWorkflowArtifact()
    return
  }

  if (process.platform !== 'win32') {
    console.log('Skipping pristine-engine prepare on non-Windows platform outside GitHub Actions')
    return
  }

  await prepareBinaryFromLocalSource(await resolveDefaultLocalSourcePath())
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
