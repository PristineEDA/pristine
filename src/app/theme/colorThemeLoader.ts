import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser'
import type {
  ThemeKind,
  VSCodeColorThemeFile,
  VSCodeTokenColorRule,
  VSCodeTokenColorSettings,
} from './colorThemeTypes'

interface ResolvedColorThemeData {
  kind: ThemeKind
  colors: Record<string, string>
  tokenColors: VSCodeTokenColorRule[]
  semanticHighlighting: boolean
  semanticTokenColors: Record<string, string | VSCodeTokenColorSettings>
}

type SyncTextLoader = (filePath: string) => string
type AsyncTextLoader = (filePath: string) => Promise<string>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizePathSeparators(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

function normalizeThemePath(filePath: string): string {
  const normalized = normalizePathSeparators(filePath)
  const drivePrefix = normalized.match(/^[A-Za-z]:/)?.[0] ?? ''
  const hasLeadingSlash = !drivePrefix && normalized.startsWith('/')
  const rest = drivePrefix
    ? normalized.slice(drivePrefix.length).replace(/^\//, '')
    : hasLeadingSlash
      ? normalized.slice(1)
      : normalized

  const segments = rest.split('/').filter(Boolean)
  const resolvedSegments: string[] = []

  for (const segment of segments) {
    if (segment === '.') {
      continue
    }

    if (segment === '..') {
      if (resolvedSegments.length > 0 && resolvedSegments[resolvedSegments.length - 1] !== '..') {
        resolvedSegments.pop()
      } else if (!drivePrefix && !hasLeadingSlash) {
        resolvedSegments.push(segment)
      }
      continue
    }

    resolvedSegments.push(segment)
  }

  if (drivePrefix) {
    return `${drivePrefix}/${resolvedSegments.join('/')}`
  }

  return hasLeadingSlash ? `/${resolvedSegments.join('/')}` : resolvedSegments.join('/')
}

function isAbsoluteThemePath(filePath: string): boolean {
  const normalized = normalizePathSeparators(filePath)
  return /^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/')
}

function getThemeDirectory(filePath: string): string {
  const normalized = normalizeThemePath(filePath)
  const lastSlashIndex = normalized.lastIndexOf('/')

  if (lastSlashIndex <= 0) {
    return normalized.includes('/') ? normalized.slice(0, Math.max(lastSlashIndex, 0)) : ''
  }

  return normalized.slice(0, lastSlashIndex)
}

export function getThemeBaseName(filePath: string): string {
  const normalized = normalizeThemePath(filePath)
  const lastSlashIndex = normalized.lastIndexOf('/')
  return lastSlashIndex === -1 ? normalized : normalized.slice(lastSlashIndex + 1)
}

export function getThemeBaseNameWithoutExtension(filePath: string): string {
  const baseName = getThemeBaseName(filePath)
  return baseName.replace(/\.[^.]+$/, '')
}

export function resolveThemeIncludePath(baseFilePath: string, nextPath: string): string {
  if (isAbsoluteThemePath(nextPath)) {
    return normalizeThemePath(nextPath)
  }

  const baseDirectory = getThemeDirectory(baseFilePath)
  return normalizeThemePath(baseDirectory ? `${baseDirectory}/${nextPath}` : nextPath)
}

function parseThemeJson<T>(filePath: string, text: string): T {
  const errors: ParseError[] = []
  const parsed = parse(text, errors, { allowTrailingComma: true, disallowComments: false })

  if (errors.length > 0) {
    const errorSummary = errors
      .map((error) => `${printParseErrorCode(error.error)} at ${error.offset}`)
      .join(', ')
    throw new Error(`Unable to parse color theme '${filePath}': ${errorSummary}`)
  }

  return parsed as T
}

function normalizeThemeKind(themeFile: VSCodeColorThemeFile, fallbackKind: ThemeKind = 'dark'): ThemeKind {
  const declaredType = typeof themeFile.type === 'string'
    ? themeFile.type.toLowerCase()
    : typeof themeFile.uiTheme === 'string'
      ? themeFile.uiTheme.toLowerCase()
      : ''

  if (declaredType.includes('light') || declaredType === 'vs' || declaredType === 'hc-light') {
    return 'light'
  }

  if (declaredType.includes('dark') || declaredType === 'hc-black' || declaredType === 'vs-dark') {
    return 'dark'
  }

  return fallbackKind
}

function normalizeColorEntries(entries: unknown): Record<string, string> {
  if (!isPlainObject(entries)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(entries)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
      .map(([key, value]) => [key, value.trim()]),
  )
}

function normalizeSemanticTokenColors(entries: unknown): Record<string, string | VSCodeTokenColorSettings> {
  if (!isPlainObject(entries)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(entries).filter((entry) => {
      return typeof entry[1] === 'string' || isPlainObject(entry[1])
    }),
  ) as Record<string, string | VSCodeTokenColorSettings>
}

function normalizeTokenColorRules(entries: unknown): VSCodeTokenColorRule[] {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries.filter(isPlainObject) as VSCodeTokenColorRule[]
}

function parseReferencedTokenColors(filePath: string, text: string): VSCodeTokenColorRule[] {
  const parsed = parseThemeJson<unknown>(filePath, text)

  if (Array.isArray(parsed)) {
    return normalizeTokenColorRules(parsed)
  }

  if (isPlainObject(parsed)) {
    return normalizeTokenColorRules(parsed['tokenColors'])
  }

  return []
}

function resolveReferencedTokenColorsSync(
  baseFilePath: string,
  tokenColorsPath: string,
  loadText: SyncTextLoader,
): VSCodeTokenColorRule[] {
  const resolvedTokenPath = resolveThemeIncludePath(baseFilePath, tokenColorsPath)

  if (!/\.jsonc?$/i.test(resolvedTokenPath)) {
    return []
  }

  return parseReferencedTokenColors(resolvedTokenPath, loadText(resolvedTokenPath))
}

async function resolveReferencedTokenColors(
  baseFilePath: string,
  tokenColorsPath: string,
  loadText: AsyncTextLoader,
): Promise<VSCodeTokenColorRule[]> {
  const resolvedTokenPath = resolveThemeIncludePath(baseFilePath, tokenColorsPath)

  if (!/\.jsonc?$/i.test(resolvedTokenPath)) {
    return []
  }

  return parseReferencedTokenColors(resolvedTokenPath, await loadText(resolvedTokenPath))
}

function mergeResolvedThemeData(
  baseTheme: ResolvedColorThemeData,
  nextTheme: Partial<ResolvedColorThemeData> & Pick<ResolvedColorThemeData, 'kind'>,
): ResolvedColorThemeData {
  return {
    kind: nextTheme.kind,
    colors: {
      ...baseTheme.colors,
      ...nextTheme.colors,
    },
    tokenColors: [
      ...baseTheme.tokenColors,
      ...(nextTheme.tokenColors ?? []),
    ],
    semanticHighlighting: nextTheme.semanticHighlighting ?? baseTheme.semanticHighlighting,
    semanticTokenColors: {
      ...baseTheme.semanticTokenColors,
      ...nextTheme.semanticTokenColors,
    },
  }
}

function getEmptyResolvedThemeData(kind: ThemeKind): ResolvedColorThemeData {
  return {
    kind,
    colors: {},
    tokenColors: [],
    semanticHighlighting: false,
    semanticTokenColors: {},
  }
}

function resolveThemeFileSync(
  filePath: string,
  loadText: SyncTextLoader,
  seenPaths: Set<string>,
): ResolvedColorThemeData {
  const normalizedPath = normalizeThemePath(filePath)

  if (seenPaths.has(normalizedPath)) {
    throw new Error(`Circular color theme include detected for '${normalizedPath}'.`)
  }

  const themeFile = parseThemeJson<VSCodeColorThemeFile>(normalizedPath, loadText(normalizedPath))
  const nextSeenPaths = new Set(seenPaths)
  nextSeenPaths.add(normalizedPath)

  const inheritedTheme = typeof themeFile.include === 'string' && themeFile.include.trim().length > 0
    ? resolveThemeFileSync(resolveThemeIncludePath(normalizedPath, themeFile.include), loadText, nextSeenPaths)
    : getEmptyResolvedThemeData(normalizeThemeKind(themeFile))

  const tokenColors = Array.isArray(themeFile.tokenColors)
    ? normalizeTokenColorRules(themeFile.tokenColors)
    : typeof themeFile.tokenColors === 'string'
      ? resolveReferencedTokenColorsSync(normalizedPath, themeFile.tokenColors, loadText)
      : []

  return mergeResolvedThemeData(inheritedTheme, {
    kind: normalizeThemeKind(themeFile, inheritedTheme.kind),
    colors: normalizeColorEntries(themeFile.colors),
    tokenColors,
    semanticHighlighting: typeof themeFile.semanticHighlighting === 'boolean'
      ? themeFile.semanticHighlighting
      : inheritedTheme.semanticHighlighting,
    semanticTokenColors: normalizeSemanticTokenColors(themeFile.semanticTokenColors),
  })
}

async function resolveThemeFile(
  filePath: string,
  loadText: AsyncTextLoader,
  seenPaths: Set<string>,
): Promise<ResolvedColorThemeData> {
  const normalizedPath = normalizeThemePath(filePath)

  if (seenPaths.has(normalizedPath)) {
    throw new Error(`Circular color theme include detected for '${normalizedPath}'.`)
  }

  const themeFile = parseThemeJson<VSCodeColorThemeFile>(normalizedPath, await loadText(normalizedPath))
  const nextSeenPaths = new Set(seenPaths)
  nextSeenPaths.add(normalizedPath)

  const inheritedTheme = typeof themeFile.include === 'string' && themeFile.include.trim().length > 0
    ? await resolveThemeFile(resolveThemeIncludePath(normalizedPath, themeFile.include), loadText, nextSeenPaths)
    : getEmptyResolvedThemeData(normalizeThemeKind(themeFile))

  const tokenColors = Array.isArray(themeFile.tokenColors)
    ? normalizeTokenColorRules(themeFile.tokenColors)
    : typeof themeFile.tokenColors === 'string'
      ? await resolveReferencedTokenColors(normalizedPath, themeFile.tokenColors, loadText)
      : []

  return mergeResolvedThemeData(inheritedTheme, {
    kind: normalizeThemeKind(themeFile, inheritedTheme.kind),
    colors: normalizeColorEntries(themeFile.colors),
    tokenColors,
    semanticHighlighting: typeof themeFile.semanticHighlighting === 'boolean'
      ? themeFile.semanticHighlighting
      : inheritedTheme.semanticHighlighting,
    semanticTokenColors: normalizeSemanticTokenColors(themeFile.semanticTokenColors),
  })
}

export function resolveColorThemeDataSync(entryFilePath: string, loadText: SyncTextLoader): ResolvedColorThemeData {
  return resolveThemeFileSync(entryFilePath, loadText, new Set())
}

export function resolveColorThemeData(entryFilePath: string, loadText: AsyncTextLoader): Promise<ResolvedColorThemeData> {
  return resolveThemeFile(entryFilePath, loadText, new Set())
}

export function mergeResolvedColorThemeData(
  baseTheme: ResolvedColorThemeData,
  nextTheme: ResolvedColorThemeData,
): ResolvedColorThemeData {
  return mergeResolvedThemeData(baseTheme, nextTheme)
}