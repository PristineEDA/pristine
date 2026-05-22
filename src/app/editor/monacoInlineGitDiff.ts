import type { InlineGitDiffHunk, InlineGitDiffResult } from './gitInlineDiff'

export interface MonacoInlineGitDiffController {
  apply: (diff: InlineGitDiffResult) => void
  clear: () => void
  dispose: () => void
  setStateBackgroundsVisible: (visible: boolean) => void
  syncEditorFont: () => void
}

interface MonacoInlineGitDiffControllerOptions {
  stateBackgroundsVisible?: boolean
}

const ADDED_LINE_CLASS = 'pristine-inline-git-diff-line pristine-inline-git-diff-line-added'
const MODIFIED_LINE_CLASS = 'pristine-inline-git-diff-line pristine-inline-git-diff-line-modified'
const REMOVED_ANCHOR_LINE_CLASS = 'pristine-inline-git-diff-line pristine-inline-git-diff-line-removed-anchor'
const ADDED_MARGIN_CLASS = 'pristine-inline-git-diff-margin pristine-inline-git-diff-margin-added'
const MODIFIED_MARGIN_CLASS = 'pristine-inline-git-diff-margin pristine-inline-git-diff-margin-modified'
const REMOVED_MARGIN_CLASS = 'pristine-inline-git-diff-margin pristine-inline-git-diff-margin-removed'
const ADDED_LINE_NUMBER_CLASS = 'pristine-inline-git-diff-line-number pristine-inline-git-diff-line-number-added'
const MODIFIED_LINE_NUMBER_CLASS = 'pristine-inline-git-diff-line-number pristine-inline-git-diff-line-number-modified'
const REMOVED_LINE_NUMBER_CLASS = 'pristine-inline-git-diff-line-number pristine-inline-git-diff-line-number-removed'
const BACKGROUNDLESS_LINE_NUMBER_CLASS = 'pristine-inline-git-diff-line-number-hit-target'
const INLINE_DIFF_DETAIL_TEST_ID = 'monaco-inline-git-diff-detail'
const INLINE_DIFF_DETAIL_TITLE_TEST_ID = 'monaco-inline-git-diff-detail-title'
const INLINE_DIFF_DETAIL_BODY_TEST_ID = 'monaco-inline-git-diff-detail-body'
const INLINE_DIFF_DETAIL_CLOSE_TEST_ID = 'monaco-inline-git-diff-detail-close'
const INLINE_DIFF_DECORATION_SELECTOR = '.pristine-inline-git-diff-margin, .pristine-inline-git-diff-line-number, .pristine-inline-git-diff-line'
const INLINE_DIFF_DETAIL_HEADER_HEIGHT_IN_LINES = 2
const INLINE_DIFF_DETAIL_MAX_HEIGHT_IN_LINES = 18
const EDITOR_OPTION_FALLBACKS = {
  fontFamily: 58,
  fontSize: 61,
  lineHeight: 75,
} as const

function getLineCount(editor: any) {
  return Math.max(editor?.getModel?.()?.getLineCount?.() ?? 1, 1)
}

function getLineMaxColumn(editor: any, lineNumber: number) {
  return editor?.getModel?.()?.getLineMaxColumn?.(lineNumber) ?? 1
}

function createLineRange(editor: any, lineNumber: number) {
  const safeLineNumber = Math.min(Math.max(lineNumber, 1), getLineCount(editor))

  return {
    startLineNumber: safeLineNumber,
    startColumn: 1,
    endLineNumber: safeLineNumber,
    endColumn: getLineMaxColumn(editor, safeLineNumber),
  }
}

function createOverviewRulerOptions(monaco: any, color: string) {
  return {
    color,
    position: monaco?.editor?.OverviewRulerLane?.Left ?? 1,
  }
}

function getEditorOption(editor: any, monaco: any, optionName: keyof typeof EDITOR_OPTION_FALLBACKS) {
  const editorOption = monaco?.editor?.EditorOption?.[optionName] ?? EDITOR_OPTION_FALLBACKS[optionName]

  try {
    return editor?.getOption?.(editorOption)
  } catch {
    return undefined
  }
}

function applyEditorFontInfo(editor: any, monaco: any, domNode: HTMLElement | null) {
  if (!domNode) {
    return
  }

  if (typeof editor?.applyFontInfo === 'function') {
    editor.applyFontInfo(domNode)
    return
  }

  const fontFamily = getEditorOption(editor, monaco, 'fontFamily')
  const fontSize = getEditorOption(editor, monaco, 'fontSize')
  const lineHeight = getEditorOption(editor, monaco, 'lineHeight')

  if (typeof fontFamily === 'string' && fontFamily.length > 0) {
    domNode.style.fontFamily = fontFamily
  }

  if (typeof fontSize === 'number' && Number.isFinite(fontSize)) {
    domNode.style.fontSize = `${fontSize}px`
  }

  if (typeof lineHeight === 'number' && Number.isFinite(lineHeight)) {
    domNode.style.lineHeight = `${lineHeight}px`
  }
}

function stopInlineDiffDetailEvent(event: Event) {
  event.preventDefault()
  event.stopPropagation()
}

function createDetailRow(kind: 'added' | 'removed', line: { content: string; currentLineNumber?: number; originalLineNumber?: number }) {
  const row = document.createElement('div')
  row.className = `pristine-inline-git-diff-detail-row pristine-inline-git-diff-detail-row-${kind}`

  if (kind === 'added') {
    row.dataset.currentLineNumber = String(line.currentLineNumber ?? '')
  } else {
    row.dataset.originalLineNumber = String(line.originalLineNumber ?? '')
  }

  const marker = document.createElement('span')
  marker.className = 'pristine-inline-git-diff-detail-marker'
  marker.textContent = kind === 'added' ? '+' : '-'

  const content = document.createElement('span')
  content.className = 'pristine-inline-git-diff-detail-content'
  content.textContent = line.content.length > 0 ? line.content : ' '

  row.append(marker, content)
  return row
}

function createHunkDetailNode(hunk: InlineGitDiffHunk, onClose: () => void) {
  const domNode = document.createElement('div')
  domNode.className = `pristine-inline-git-diff-detail pristine-inline-git-diff-detail-${hunk.type}`
  domNode.dataset.inlineGitDiff = 'detail'
  domNode.dataset.testid = INLINE_DIFF_DETAIL_TEST_ID
  domNode.dataset.hunkType = hunk.type
  domNode.dataset.currentStartLine = String(hunk.currentStartLine)
  domNode.dataset.originalStartLine = String(hunk.originalStartLine)

  const header = document.createElement('div')
  header.className = 'pristine-inline-git-diff-detail-header'

  const title = document.createElement('span')
  title.className = 'pristine-inline-git-diff-detail-title'
  title.dataset.testid = INLINE_DIFF_DETAIL_TITLE_TEST_ID
  title.textContent = `Git Local Changes - ${hunk.type} change`

  const closeButton = document.createElement('button')
  closeButton.className = 'pristine-inline-git-diff-detail-close'
  closeButton.type = 'button'
  closeButton.dataset.testid = INLINE_DIFF_DETAIL_CLOSE_TEST_ID
  closeButton.setAttribute('aria-label', 'Close inline Git diff detail')
  closeButton.title = 'Close'
  closeButton.textContent = 'x'
  closeButton.addEventListener('mousedown', stopInlineDiffDetailEvent)
  closeButton.addEventListener('click', (event) => {
    stopInlineDiffDetailEvent(event)
    onClose()
  })

  header.append(title, closeButton)
  domNode.append(header)

  const body = document.createElement('div')
  body.className = 'pristine-inline-git-diff-detail-body'
  body.dataset.testid = INLINE_DIFF_DETAIL_BODY_TEST_ID

  hunk.removedLines.forEach((line) => {
    body.append(createDetailRow('removed', line))
  })

  hunk.addedLines.forEach((line) => {
    body.append(createDetailRow('added', line))
  })

  domNode.append(body)
  domNode.addEventListener('mousedown', stopInlineDiffDetailEvent)

  return domNode
}

function getHunkKey(hunk: InlineGitDiffHunk) {
  return `${hunk.type}:${hunk.originalStartLine}:${hunk.originalEndLine}:${hunk.currentStartLine}:${hunk.currentEndLine}`
}

function getHunkDetailHeightInLines(hunk: InlineGitDiffHunk) {
  const contentLineCount = Math.max(hunk.addedLines.length + hunk.removedLines.length, 1)
  return Math.min(
    Math.max(contentLineCount + INLINE_DIFF_DETAIL_HEADER_HEIGHT_IN_LINES, 3),
    INLINE_DIFF_DETAIL_MAX_HEIGHT_IN_LINES,
  )
}

function getHunkForLine(hunks: InlineGitDiffHunk[], lineNumber: number) {
  return hunks.find((hunk) => {
    const currentStartLine = Math.min(hunk.currentStartLine, hunk.currentEndLine)
    const currentEndLine = Math.max(hunk.currentStartLine, hunk.currentEndLine)

    return lineNumber === hunk.anchorLine || (lineNumber >= currentStartLine && lineNumber <= currentEndLine)
  })
}

function getMouseTargetElement(target: any): Element | null {
  const element = target?.element

  if (element && typeof element.closest === 'function') {
    return element
  }

  return null
}

function isInlineGitDiffDecorationClick(target: any) {
  const element = getMouseTargetElement(target)

  return Boolean(element?.closest(INLINE_DIFF_DECORATION_SELECTOR))
}

function getEventLineNumber(event: any) {
  const lineNumber = event?.target?.position?.lineNumber
  return typeof lineNumber === 'number' ? lineNumber : undefined
}

function getDetailAfterLineNumber(hunk: InlineGitDiffHunk, clickedLineNumber: number) {
  if (hunk.addedLines.length > 0) {
    return hunk.currentEndLine
  }

  return clickedLineNumber || hunk.anchorLine
}

function createLineDecorationOptions(
  monaco: any,
  className: string,
  marginClassName: string,
  lineNumberClassName: string,
  overviewColor: string,
  stateBackgroundsVisible: boolean,
) {
  const options: any = {
    className,
    hoverMessage: { value: 'Click to show Git change' },
    isWholeLine: true,
    marginClassName,
    overviewRuler: createOverviewRulerOptions(monaco, overviewColor),
  }

  if (stateBackgroundsVisible) {
    options.lineNumberClassName = lineNumberClassName
    return options
  }

  delete options.className
  options.lineNumberClassName = BACKGROUNDLESS_LINE_NUMBER_CLASS
  return options
}

function createCurrentLineDecorations(editor: any, monaco: any, diff: InlineGitDiffResult, stateBackgroundsVisible: boolean) {
  const decorations: any[] = []

  diff.hunks.forEach((hunk) => {
    if (hunk.addedLines.length > 0) {
      const isAddedOnly = hunk.type === 'added'
      const className = isAddedOnly ? ADDED_LINE_CLASS : MODIFIED_LINE_CLASS
      const marginClassName = isAddedOnly ? ADDED_MARGIN_CLASS : MODIFIED_MARGIN_CLASS
      const lineNumberClassName = isAddedOnly ? ADDED_LINE_NUMBER_CLASS : MODIFIED_LINE_NUMBER_CLASS
      const overviewColor = isAddedOnly ? 'var(--ide-success)' : 'var(--ide-warning)'

      hunk.addedLines.forEach((line) => {
        decorations.push({
          range: createLineRange(editor, line.currentLineNumber ?? hunk.currentStartLine),
          options: createLineDecorationOptions(monaco, className, marginClassName, lineNumberClassName, overviewColor, stateBackgroundsVisible),
        })
      })
    }

    if (hunk.removedLines.length > 0 && hunk.addedLines.length === 0) {
      const anchorLine = Math.min(Math.max(hunk.anchorLine || 1, 1), getLineCount(editor))
      decorations.push({
        range: createLineRange(editor, anchorLine),
        options: createLineDecorationOptions(monaco, REMOVED_ANCHOR_LINE_CLASS, REMOVED_MARGIN_CLASS, REMOVED_LINE_NUMBER_CLASS, 'var(--ide-error)', stateBackgroundsVisible),
      })
    }
  })

  return decorations
}

export function createMonacoInlineGitDiffController(
  editor: any,
  monaco: any,
  options: MonacoInlineGitDiffControllerOptions = {},
): MonacoInlineGitDiffController {
  let decorationIds: string[] = []
  let currentDiff: InlineGitDiffResult | null = null
  let currentHunks: InlineGitDiffHunk[] = []
  let detailZoneId: string | null = null
  let detailDomNode: HTMLElement | null = null
  let activeDetailHunkKey: string | null = null
  let stateBackgroundsVisible = options.stateBackgroundsVisible ?? true

  const syncEditorFont = () => {
    applyEditorFontInfo(editor, monaco, detailDomNode)
  }

  const renderDecorations = () => {
    if (typeof editor?.deltaDecorations !== 'function') {
      decorationIds = []
      return
    }

    if (!currentDiff || currentDiff.hunks.length === 0) {
      decorationIds = editor.deltaDecorations(decorationIds, []) ?? []
      return
    }

    const decorations = createCurrentLineDecorations(editor, monaco, currentDiff, stateBackgroundsVisible)
    decorationIds = editor.deltaDecorations(decorationIds, decorations) ?? []
  }

  const setStateBackgroundsVisible = (visible: boolean) => {
    if (stateBackgroundsVisible === visible) {
      return
    }

    stateBackgroundsVisible = visible
    renderDecorations()
  }

  const closeDetail = () => {
    if (detailZoneId && typeof editor?.changeViewZones === 'function') {
      const currentDetailZoneId = detailZoneId
      editor.changeViewZones((accessor: any) => {
        accessor.removeZone(currentDetailZoneId)
      })
    }

    detailZoneId = null
    detailDomNode = null
    activeDetailHunkKey = null
  }

  const openDetail = (hunk: InlineGitDiffHunk, clickedLineNumber: number) => {
    if (typeof editor?.changeViewZones !== 'function') {
      return
    }

    const hunkKey = getHunkKey(hunk)
    if (activeDetailHunkKey === hunkKey) {
      closeDetail()
      return
    }

    closeDetail()

    editor.changeViewZones((accessor: any) => {
      const domNode = createHunkDetailNode(hunk, closeDetail)
      applyEditorFontInfo(editor, monaco, domNode)
      const zoneId = accessor.addZone({
        afterLineNumber: Math.max(getDetailAfterLineNumber(hunk, clickedLineNumber), 0),
        domNode,
        heightInLines: getHunkDetailHeightInLines(hunk),
        ordinal: 10_000 + hunk.originalStartLine,
        suppressMouseDown: true,
      })

      if (zoneId !== undefined && zoneId !== null) {
        detailZoneId = String(zoneId)
        detailDomNode = domNode
        activeDetailHunkKey = hunkKey
      }
    })
  }

  const handleMouseDown = (event: any) => {
    if (!isInlineGitDiffDecorationClick(event?.target)) {
      return
    }

    const lineNumber = getEventLineNumber(event)
    if (lineNumber === undefined) {
      return
    }

    const hunk = getHunkForLine(currentHunks, lineNumber)
    if (!hunk) {
      return
    }

    event?.event?.preventDefault?.()
    event?.event?.stopPropagation?.()
    openDetail(hunk, lineNumber)
  }

  const mouseDownDisposable = typeof editor?.onMouseDown === 'function'
    ? editor.onMouseDown(handleMouseDown)
    : null

  const handleDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeDetail()
    }
  }

  document.addEventListener('keydown', handleDocumentKeyDown)

  const clear = () => {
    closeDetail()
    currentDiff = null
    currentHunks = []

    renderDecorations()
  }

  const apply = (diff: InlineGitDiffResult) => {
    closeDetail()
    currentDiff = diff
    currentHunks = diff.hunks
    renderDecorations()
  }

  return {
    apply,
    clear,
    dispose: () => {
      clear()
      mouseDownDisposable?.dispose?.()
      document.removeEventListener('keydown', handleDocumentKeyDown)
    },
    setStateBackgroundsVisible,
    syncEditorFont,
  }
}
