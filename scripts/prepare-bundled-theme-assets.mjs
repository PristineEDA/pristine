import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { syncBundledThemeAssets } from './sync-bundled-theme-assets.mjs'

const workspaceRoot = process.cwd()
const manifestPath = path.join(workspaceRoot, 'src', 'app', 'theme', 'bundledUpstreamThemeManifest.json')
const outputRoot = path.join(workspaceRoot, 'src', 'app', 'theme', 'bundled-upstream')
const cacheRoot = path.join(workspaceRoot, '.pristine-vendor')
const stampPath = path.join(cacheRoot, 'bundled-theme-assets.manifest-sha256')

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function ensureDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true })
}

function hashText(text) {
  return createHash('sha256').update(text).digest('hex')
}

async function loadManifest() {
  const raw = await readFile(manifestPath, 'utf8')
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error('Bundled upstream theme manifest must be an array.')
  }

  return {
    raw,
    entries: parsed,
  }
}

async function readStamp() {
  if (!(await exists(stampPath))) {
    return null
  }

  return (await readFile(stampPath, 'utf8')).trim() || null
}

async function hasAllManifestThemeFiles(entries) {
  for (const entry of entries) {
    const themeFilePath = path.join(outputRoot, entry.assetDirectory, ...entry.themePath.split('/'))

    if (!(await exists(themeFilePath))) {
      return false
    }
  }

  return true
}

async function writeStamp(hash) {
  await ensureDirectory(cacheRoot)
  await writeFile(stampPath, `${hash}\n`, 'utf8')
}

async function main() {
  const manifest = await loadManifest()
  const manifestHash = hashText(manifest.raw)
  const currentStamp = await readStamp()
  const themeFilesPresent = await hasAllManifestThemeFiles(manifest.entries)

  if (themeFilesPresent && currentStamp === manifestHash) {
    console.log('Bundled theme assets already prepared.')
    return
  }

  await syncBundledThemeAssets()
  await writeStamp(manifestHash)
  console.log('Bundled theme assets prepared.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})