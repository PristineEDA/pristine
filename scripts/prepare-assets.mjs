import { createReadStream, createWriteStream } from 'node:fs'
import { access, copyFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import extractZip from 'extract-zip'
import tarFs from 'tar-fs'
import unbzip2Stream from 'unbzip2-stream'

const workspaceRoot = process.cwd()
const generatedDir = path.join(workspaceRoot, 'public', 'generated')
const wallpaperTargetPath = path.join(generatedDir, 'empty-wallpaper.png')
const generatedFontsDir = path.join(generatedDir, 'fonts')

const defaultAssetUrl = 'https://raw.githubusercontent.com/PristineEDA/pristine-res/main/images/empty-wallpaper.png'
const assetUrl = process.env.PRISTINE_EMPTY_WALLPAPER_URL ?? defaultAssetUrl
const defaultFontAssetBaseUrl = 'https://raw.githubusercontent.com/PristineEDA/pristine-res/main/fonts'
const fontAssetBaseUrl = process.env.PRISTINE_FONT_ASSET_BASE_URL ?? defaultFontAssetBaseUrl
const defaultLocalResourceRoot = path.resolve(workspaceRoot, '..', 'pristine-res')
const localResourceRoot = process.env.PRISTINE_RES_LOCAL_DIR ?? defaultLocalResourceRoot
const localWallpaperSourcePath = path.join(localResourceRoot, 'images', 'empty-wallpaper.png')
const localFontSourceDir = path.join(localResourceRoot, 'fonts')

const fontAssets = [
  {
    sourceFile: '0xProto_2_502.zip',
    kind: 'zip',
    outputs: [
      { entry: 'fonts/0xProto-Regular.ttf', targetFile: '0xProto-Regular.ttf' },
      { entry: 'fonts/ZxProto/ZxProto-Regular.ttf', targetFile: 'ZxProto-Regular.ttf' },
    ],
  },
  {
    sourceFile: 'Agave-Regular.ttf',
    kind: 'copy',
    outputs: [{ targetFile: 'Agave-Regular.ttf' }],
  },
  {
    sourceFile: 'dejavu-fonts-ttf-2.37.tar.bz2',
    kind: 'tar',
    outputs: [{ entry: 'dejavu-fonts-ttf-2.37/ttf/DejaVuSansMono.ttf', targetFile: 'DejaVuSansMono.ttf' }],
  },
  {
    sourceFile: 'FantasqueSansMono-Normal.tar.gz',
    kind: 'tar',
    outputs: [{ entry: 'TTF/FantasqueSansMono-Regular.ttf', targetFile: 'FantasqueSansMono-Regular.ttf' }],
  },
  {
    sourceFile: 'Hack-v3.003-webfonts.tar.gz',
    kind: 'tar',
    outputs: [{ entry: 'web/fonts/hack-regular.woff2', targetFile: 'Hack-Regular.woff2' }],
  },
  {
    sourceFile: 'Hasklig-1.2.zip',
    kind: 'zip',
    outputs: [{ entry: 'TTF/Hasklig-Regular.ttf', targetFile: 'Hasklig-Regular.ttf' }],
  },
  {
    sourceFile: 'JuliaMono-webfonts.tar.gz',
    kind: 'tar',
    outputs: [{ entry: 'webfonts/JuliaMono-Regular.woff2', targetFile: 'JuliaMono-Regular.woff2' }],
  },
  {
    sourceFile: 'liberation-fonts-ttf-2.1.5.tar.gz',
    kind: 'tar',
    outputs: [{ entry: 'liberation-fonts-ttf-2.1.5/LiberationMono-Regular.ttf', targetFile: 'LiberationMono-Regular.ttf' }],
  },
  {
    sourceFile: 'MPLUSCodeLatin.zip',
    kind: 'zip',
    outputs: [
      { entry: 'MPLUSCodeLatin/ttf/MPLUSCodeLatin60-Regular.ttf', targetFile: 'MPLUSCodeLatin-Regular.ttf' },
      { entry: 'MPLUSCodeLatin/ttf/MPLUSCodeLatin50-Regular.ttf', targetFile: 'MPLUSCodeLatin50-Regular.ttf' },
    ],
  },
  {
    sourceFile: 'Meslo LG DZ v1.2.1.zip',
    kind: 'zip',
    outputs: [
      { entry: 'Meslo LG DZ v1.2.1/MesloLGLDZ-Regular.ttf', targetFile: 'MesloLGLDZ-Regular.ttf' },
      { entry: 'Meslo LG DZ v1.2.1/MesloLGMDZ-Regular.ttf', targetFile: 'MesloLGMDZ-Regular.ttf' },
      { entry: 'Meslo LG DZ v1.2.1/MesloLGSDZ-Regular.ttf', targetFile: 'MesloLGSDZ-Regular.ttf' },
    ],
  },
  {
    sourceFile: 'monaspace-webfont-variable-v1.400.zip',
    kind: 'zip',
    outputs: [
      { entry: 'Variable Web Fonts/Monaspace Argon/Monaspace Argon Var.woff2', targetFile: 'MonaspaceArgon-Regular.woff2' },
      { entry: 'Variable Web Fonts/Monaspace Krypton/Monaspace Krypton Var.woff2', targetFile: 'MonaspaceKrypton-Regular.woff2' },
      { entry: 'Variable Web Fonts/Monaspace Neon/Monaspace Neon Var.woff2', targetFile: 'MonaspaceNeon-Regular.woff2' },
      { entry: 'Variable Web Fonts/Monaspace Radon/Monaspace Radon Var.woff2', targetFile: 'MonaspaceRadon-Regular.woff2' },
      { entry: 'Variable Web Fonts/Monaspace Xenon/Monaspace Xenon Var.woff2', targetFile: 'MonaspaceXenon-Regular.woff2' },
    ],
  },
  {
    sourceFile: 'Monoid.zip',
    kind: 'zip',
    outputs: [{ entry: 'Monoid-Regular.ttf', targetFile: 'Monoid-Regular.ttf' }],
  },
]

function joinRemoteUrl(baseUrl, assetPath) {
  return `${baseUrl.replace(/\/$/, '')}/${assetPath.split('/').map(encodeURIComponent).join('/')}`
}

function getFontTargetPath(targetFile) {
  return path.join(generatedFontsDir, targetFile)
}

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

async function hasContent(filePath) {
  if (!(await exists(filePath))) {
    return false
  }

  const fileStat = await stat(filePath)
  return fileStat.size > 0
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

  await ensureDirectory(path.dirname(targetPath))
  await pipeline(response.body, createWriteStream(targetPath))
  console.log(`Prepared ${label} from remote source: ${url}`)
}

async function downloadRemoteAsset() {
  await downloadRemoteFile(assetUrl, wallpaperTargetPath, 'empty wallpaper')
}

async function copyLocalAsset(sourcePath, targetPath, label) {
  await ensureDirectory(path.dirname(targetPath))
  await copyFile(sourcePath, targetPath)
  console.log(`Prepared ${label} from local source: ${path.relative(workspaceRoot, sourcePath)}`)
}

async function getLocalFontSourcePath(sourceFile) {
  const localSourcePath = path.join(localFontSourceDir, sourceFile)
  return (await hasContent(localSourcePath)) ? localSourcePath : null
}

async function resolveFontAssetSourcePath(asset, tempRoot) {
  const localSourcePath = await getLocalFontSourcePath(asset.sourceFile)
  if (localSourcePath) {
    return localSourcePath
  }

  const archivePath = path.join(tempRoot, asset.sourceFile)
  await downloadRemoteFile(joinRemoteUrl(fontAssetBaseUrl, asset.sourceFile), archivePath, `font archive ${asset.sourceFile}`)
  return archivePath
}

function createTarDecompressor(archivePath) {
  if (archivePath.endsWith('.tar.gz')) {
    return createGunzip()
  }

  if (archivePath.endsWith('.tar.bz2')) {
    return unbzip2Stream()
  }

  throw new Error(`Unsupported tar archive format: ${path.basename(archivePath)}`)
}

async function extractTarArchive(archivePath, extractDir) {
  await ensureDirectory(extractDir)
  await pipeline(
    createReadStream(archivePath),
    createTarDecompressor(archivePath),
    tarFs.extract(extractDir),
  )
}

async function copyExtractedFile(sourcePath, targetPath) {
  await ensureDirectory(path.dirname(targetPath))
  await copyFile(sourcePath, targetPath)
}

async function prepareFontAsset(asset, tempRoot) {
  const missingOutputs = []

  for (const output of asset.outputs) {
    const targetPath = getFontTargetPath(output.targetFile)
    if (!(await hasContent(targetPath))) {
      missingOutputs.push({ ...output, targetPath })
    }
  }

  if (missingOutputs.length === 0) {
    return
  }

  if (asset.kind === 'copy') {
    const target = missingOutputs[0]
    const localSourcePath = await getLocalFontSourcePath(asset.sourceFile)

    if (localSourcePath) {
      await copyLocalAsset(localSourcePath, target.targetPath, `font asset ${asset.sourceFile}`)
      return
    }

    await downloadRemoteFile(joinRemoteUrl(fontAssetBaseUrl, asset.sourceFile), target.targetPath, `font asset ${asset.sourceFile}`)
    return
  }

  const archivePath = await resolveFontAssetSourcePath(asset, tempRoot)

  if (asset.kind === 'tar') {
    const extractDir = await mkdtemp(path.join(tempRoot, `${path.parse(asset.sourceFile).name}-`))

    try {
      await extractTarArchive(archivePath, extractDir)

      for (const output of missingOutputs) {
        const sourcePath = path.join(extractDir, ...output.entry.split('/'))
        if (!(await exists(sourcePath))) {
          throw new Error(`Missing extracted font entry: ${output.entry}`)
        }

        await copyExtractedFile(sourcePath, output.targetPath)
        console.log(`Prepared font file: ${path.relative(workspaceRoot, output.targetPath)}`)
      }
    } finally {
      await rm(extractDir, { recursive: true, force: true })
    }

    return
  }

  const extractDir = await mkdtemp(path.join(tempRoot, `${path.parse(asset.sourceFile).name}-`))

  try {
    await extractZip(archivePath, { dir: extractDir })

    for (const output of missingOutputs) {
      const sourcePath = path.join(extractDir, ...output.entry.split('/'))
      if (!(await exists(sourcePath))) {
        throw new Error(`Missing extracted font entry: ${output.entry}`)
      }

      await copyExtractedFile(sourcePath, output.targetPath)
      console.log(`Prepared font file: ${path.relative(workspaceRoot, output.targetPath)}`)
    }
  } finally {
    await rm(extractDir, { recursive: true, force: true })
  }
}

async function prepareFontAssets() {
  await ensureDirectory(generatedFontsDir)
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'pristine-font-assets-'))

  try {
    for (const asset of fontAssets) {
      await prepareFontAsset(asset, tempRoot)
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}

async function main() {
  await ensureDirectory(generatedDir)
  await prepareFontAssets()

  if (await hasContent(wallpaperTargetPath)) {
    console.log(`Empty wallpaper already available: ${path.relative(workspaceRoot, wallpaperTargetPath)}`)
    return
  }

  if (await hasContent(localWallpaperSourcePath)) {
    await copyLocalAsset(localWallpaperSourcePath, wallpaperTargetPath, 'empty wallpaper')
    return
  }

  await downloadRemoteAsset()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})