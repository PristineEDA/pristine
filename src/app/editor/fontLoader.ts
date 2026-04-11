import type { EditorFontFamilyId } from './editorSettings'

const loadedFontFamilies = new Set<EditorFontFamilyId>([
  'jetbrains-mono',
  '0xproto',
  'zxproto',
  'agave',
  'dejavu-sans-mono',
  'fantasque-sans-mono',
  'hack',
  'hasklig',
  'julia-mono',
  'liberation-mono',
  'm-plus-code-latin',
  'm-plus-code-latin-50',
  'meslo-lg-dz',
  'meslo-lg-mdz',
  'meslo-lg-sdz',
  'monaspace-argon',
  'monaspace-krypton',
  'monaspace-neon',
  'monaspace-radon',
  'monaspace-xenon',
  'monoid',
])

const fontLoaders: Partial<Record<EditorFontFamilyId, () => Promise<unknown>>> = {
  'anonymous-pro': () => import('@fontsource/anonymous-pro/400.css'),
  'cascadia-code': () => import('@fontsource/cascadia-code/400.css'),
  'comic-mono': () => import('@fontsource/comic-mono/400.css'),
  cousine: () => import('@fontsource/cousine/400.css'),
  'fira-code': () => import('@fontsource/fira-code/400.css'),
  'ibm-plex-mono': () => import('@fontsource/ibm-plex-mono/400.css'),
  inconsolata: () => import('@fontsource/inconsolata/400.css'),
  iosevka: () => import('@fontsource/iosevka/400.css'),
  mononoki: () => import('@fontsource/mononoki/400.css'),
  'noto-sans-mono': () => import('@fontsource/noto-sans-mono/400.css'),
  'source-code-pro': () => import('@fontsource/source-code-pro/400.css'),
  'space-mono': () => import('@fontsource/space-mono/400.css'),
  'ubuntu-mono': () => import('@fontsource/ubuntu-mono/400.css'),
  'victor-mono': () => import('@fontsource/victor-mono/400.css'),
}

const inflightFontLoads = new Map<EditorFontFamilyId, Promise<void>>()

export function ensureEditorFontFamilyLoaded(fontFamilyId: EditorFontFamilyId): Promise<void> {
  if (loadedFontFamilies.has(fontFamilyId)) {
    return Promise.resolve()
  }

  const existingLoad = inflightFontLoads.get(fontFamilyId)
  if (existingLoad) {
    return existingLoad
  }

  const loader = fontLoaders[fontFamilyId]
  if (!loader) {
    loadedFontFamilies.add(fontFamilyId)
    return Promise.resolve()
  }

  const nextLoad = loader()
    .then(() => {
      loadedFontFamilies.add(fontFamilyId)
    })
    .finally(() => {
      inflightFontLoads.delete(fontFamilyId)
    })

  inflightFontLoads.set(fontFamilyId, nextLoad)
  return nextLoad
}