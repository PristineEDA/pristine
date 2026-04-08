import { createWriteStream } from 'node:fs'
import { access, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

const workspaceRoot = process.cwd()
const targetPath = path.join(workspaceRoot, 'public', 'generated', 'empty-wallpaper.png')
const defaultAssetUrl = 'https://raw.githubusercontent.com/PristineEDA/Pristine-res/main/images/empty-wallpaper.png'
const assetUrl = process.env.PRISTINE_EMPTY_WALLPAPER_URL ?? defaultAssetUrl

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function ensureTargetDirectory() {
  await mkdir(path.dirname(targetPath), { recursive: true })
}

async function hasContent(filePath) {
  if (!(await exists(filePath))) {
    return false
  }

  const fileStat = await stat(filePath)
  return fileStat.size > 0
}

async function downloadRemoteAsset() {
  const response = await fetch(assetUrl)

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download wallpaper asset: ${response.status} ${response.statusText}`)
  }

  await pipeline(response.body, createWriteStream(targetPath))
  console.log(`Prepared empty wallpaper from remote source: ${assetUrl}`)
}

async function main() {
  await ensureTargetDirectory()

  if (await hasContent(targetPath)) {
    console.log(`Empty wallpaper already available: ${path.relative(workspaceRoot, targetPath)}`)
    return
  }

  await downloadRemoteAsset()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})