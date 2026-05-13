import { createWriteStream } from 'node:fs'
import { access, copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'
import extractZip from 'extract-zip'
import { parse, printParseErrorCode } from 'jsonc-parser'

const workspaceRoot = process.cwd()
const manifestPath = path.join(workspaceRoot, 'src', 'app', 'theme', 'bundledUpstreamThemeManifest.json')
const outputRoot = path.join(workspaceRoot, 'src', 'app', 'theme', 'bundled-upstream')
const marketplaceQueryUrl = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery'

function normalizeRelativePath(filePath) {
  return path.posix.normalize(filePath.replace(/\\/g, '/')).replace(/^\.\//, '')
}

function resolveRelativePath(baseFilePath, nextFilePath) {
  return normalizeRelativePath(path.posix.join(path.posix.dirname(baseFilePath), nextFilePath))
}

async function ensureDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true })
}

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function parseJsonc(filePath, text) {
  const errors = []
  const parsed = parse(text, errors, { allowTrailingComma: true, disallowComments: false })

  if (errors.length > 0) {
    const summary = errors
      .map((error) => `${printParseErrorCode(error.error)} at ${error.offset}`)
      .join(', ')
    throw new Error(`Unable to parse theme file '${filePath}': ${summary}`)
  }

  return parsed
}

async function loadManifest() {
  const raw = await readFile(manifestPath, 'utf8')
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error('Bundled upstream theme manifest must be an array.')
  }

  return parsed
}

async function downloadFile(url, targetPath, label) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Pristine bundled theme sync',
    },
  })

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${label}: ${response.status} ${response.statusText}`)
  }

  await ensureDirectory(path.dirname(targetPath))
  await pipeline(response.body, createWriteStream(targetPath))
}

async function queryMarketplaceExtension({ publisher, extensionName }) {
  const response = await fetch(marketplaceQueryUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json;api-version=3.0-preview.1',
      'Content-Type': 'application/json',
      'User-Agent': 'Pristine bundled theme sync',
    },
    body: JSON.stringify({
      filters: [
        {
          criteria: [
            {
              filterType: 7,
              value: `${publisher}.${extensionName}`,
            },
          ],
          pageNumber: 1,
          pageSize: 1,
          sortBy: 0,
          sortOrder: 0,
        },
      ],
      assetTypes: ['Microsoft.VisualStudio.Services.VSIXPackage'],
      flags: 103,
    }),
  })

  if (!response.ok) {
    throw new Error(`Marketplace query failed for ${publisher}.${extensionName}: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  const extension = payload?.results?.[0]?.extensions?.[0]

  if (!extension) {
    throw new Error(`Marketplace extension '${publisher}.${extensionName}' was not found.`)
  }

  return extension
}

function getVsixSource(extension, expectedVersion) {
  const version = extension.versions?.find((candidate) => candidate.version === expectedVersion) ?? extension.versions?.[0]

  if (!version) {
    throw new Error(`Marketplace extension '${extension.publisher.publisherName}.${extension.extensionName}' has no downloadable versions.`)
  }

  if (version.version !== expectedVersion) {
    throw new Error(
      `Expected ${extension.publisher.publisherName}.${extension.extensionName} version ${expectedVersion} but received ${version.version}.`,
    )
  }

  const vsixAsset = version.files?.find((file) => file.assetType === 'Microsoft.VisualStudio.Services.VSIXPackage')

  if (!vsixAsset?.source) {
    throw new Error(`Marketplace extension '${extension.publisher.publisherName}.${extension.extensionName}' does not expose a VSIX asset.`)
  }

  return vsixAsset.source
}

async function extractVsixToTemp(extensionConfig, tempRoot) {
  const extension = await queryMarketplaceExtension(extensionConfig)
  const vsixUrl = getVsixSource(extension, extensionConfig.version)
  const archivePath = path.join(tempRoot, `${extensionConfig.assetDirectory}.vsix`)
  const extractDir = path.join(tempRoot, extensionConfig.assetDirectory)

  await downloadFile(vsixUrl, archivePath, `${extensionConfig.publisher}.${extensionConfig.extensionName}`)
  await extractZip(archivePath, { dir: extractDir })

  const extensionRoot = path.join(extractDir, 'extension')
  return (await exists(extensionRoot)) ? extensionRoot : extractDir
}

async function collectThemeDependencyPaths(extensionRoot, relativePath, collectedPaths) {
  const normalizedPath = normalizeRelativePath(relativePath)

  if (collectedPaths.has(normalizedPath)) {
    return
  }

  const absolutePath = path.join(extensionRoot, ...normalizedPath.split('/'))
  const text = await readFile(absolutePath, 'utf8')
  collectedPaths.add(normalizedPath)

  const parsed = parseJsonc(normalizedPath, text)

  if (Array.isArray(parsed) || !parsed || typeof parsed !== 'object') {
    return
  }

  if (typeof parsed.include === 'string' && parsed.include.trim().length > 0) {
    await collectThemeDependencyPaths(
      extensionRoot,
      resolveRelativePath(normalizedPath, parsed.include.trim()),
      collectedPaths,
    )
  }

  if (typeof parsed.tokenColors === 'string' && /\.jsonc?$/i.test(parsed.tokenColors)) {
    await collectThemeDependencyPaths(
      extensionRoot,
      resolveRelativePath(normalizedPath, parsed.tokenColors.trim()),
      collectedPaths,
    )
  }
}

async function syncExtensionAssets(extensionEntries, tempRoot) {
  const [firstEntry] = extensionEntries

  if (!firstEntry) {
    return
  }

  const extensionRoot = await extractVsixToTemp(firstEntry, tempRoot)
  const outputDirectory = path.join(outputRoot, firstEntry.assetDirectory)
  const collectedPaths = new Set()

  for (const entry of extensionEntries) {
    await collectThemeDependencyPaths(extensionRoot, entry.themePath, collectedPaths)
  }

  await rm(outputDirectory, { recursive: true, force: true })

  for (const relativePath of [...collectedPaths].sort()) {
    const sourcePath = path.join(extensionRoot, ...relativePath.split('/'))
    const targetPath = path.join(outputDirectory, ...relativePath.split('/'))
    await ensureDirectory(path.dirname(targetPath))
    await copyFile(sourcePath, targetPath)
  }

  console.log(`Synced ${firstEntry.assetDirectory} (${collectedPaths.size} files)`)
}

export async function syncBundledThemeAssets() {
  const manifest = await loadManifest()
  await ensureDirectory(outputRoot)
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'pristine-bundled-theme-'))

  try {
    const groups = new Map()

    for (const entry of manifest) {
      const key = `${entry.publisher}.${entry.extensionName}@${entry.version}`
      const existingEntries = groups.get(key)
      if (existingEntries) {
        existingEntries.push(entry)
      } else {
        groups.set(key, [entry])
      }
    }

    for (const entries of groups.values()) {
      await syncExtensionAssets(entries, tempRoot)
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncBundledThemeAssets().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
