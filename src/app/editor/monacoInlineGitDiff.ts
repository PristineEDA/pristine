import type { InlineGitDiffHunk, InlineGitDiffResult } from './gitInlineDiff'

export interface MonacoInlineGitDiffController {
  apply: (diff: InlineGitDiffResult) => void
  clear: () => void
  dispose: () => void
}

const ADDED_LINE_CLASS = 'pristine-inline-git-diff-line pristine-inline-git-diff-line-added'
const MODIFIED_LINE_CLASS = 'pristine-inline-git-diff-line pristine-inline-git-diff-line-modified'
const REMOVED_ANCHOR_LINE_CLASS = 'pristine-inline-git-diff-line pristine-inline-git-diff-line-removed-anchor'
const ADDED_GUTTER_CLASS = 'pristine-inline-git-diff-gutter pristine-inline-git-diff-gutter-added'
const MODIFIED_GUTTER_CLASS = 'pristine-inline-git-diff-gutter pristine-inline-git-diff-gutter-modified'
const REMOVED_GUTTER_CLASS = 'pristine-inline-git-diff-gutter pristine-inline-git-diff-gutter-removed'
const INLINE_DIFF_DETAIL_TEST_ID = 'monaco-inline-git-diff-detail'
const INLINE_DIFF_DETAIL_TITLE_TEST_ID = 'monaco-inline-git-diff-detail-title'
const INLINE_DIFF_DETAIL_BODY_TEST_ID = 'monaco-inline-git-diff-detail-body'
const INLINE_DIFF_DETAIL_CLOSE_TEST_ID = 'monaco-inline-git-diff-detail-close'
const INLINE_DIFF_DECORATION_SELECTOR = '.pristine-inline-git-diff-gutter, .pristine-inline-git-diff-line'
const INLINE_DIFF_DETAIL_HEADER_HEIGHT_IN_LINES = 2
const INLINE_DIFF_DETAIL_MAX_HEIGHT_IN_LINES = 18

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

function createCurrentLineDecorations(editor: any, monaco: any, diff: InlineGitDiffResult) {
  const decorations: any[] = []

  diff.hunks.forEach((hunk) => {
    if (hunk.addedLines.length > 0) {
      const isAddedOnly = hunk.type === 'added'
      const className = isAddedOnly ? ADDED_LINE_CLASS : MODIFIED_LINE_CLASS
      const gutterClassName = isAddedOnly ? ADDED_GUTTER_CLASS : MODIFIED_GUTTER_CLASS
      const overviewColor = isAddedOnly ? 'var(--ide-success)' : 'var(--ide-warning)'

      hunk.addedLines.forEach((line) => {
        decorations.push({
          range: createLineRange(editor, line.currentLineNumber ?? hunk.currentStartLine),
          options: {
            className,
            hoverMessage: { value: 'Click to show Git change' },
            isWholeLine: true,
            linesDecorationsClassName: gutterClassName,
            overviewRuler: createOverviewRulerOptions(monaco, overviewColor),
          },
        })
      })
    }

    if (hunk.removedLines.length > 0 && hunk.addedLines.length === 0) {
      const anchorLine = Math.min(Math.max(hunk.anchorLine || 1, 1), getLineCount(editor))
      decorations.push({
        range: createLineRange(editor, anchorLine),
        options: {
          className: REMOVED_ANCHOR_LINE_CLASS,
          hoverMessage: { value: 'Click to show Git change' },
          isWholeLine: true,
          linesDecorationsClassName: REMOVED_GUTTER_CLASS,
          overviewRuler: createOverviewRulerOptions(monaco, 'var(--ide-error)'),
        },
      })
    }
  })

  return decorations
}

export function createMonacoInlineGitDiffController(editor: any, monaco: any): MonacoInlineGitDiffController {
  let decorationIds: string[] = []
  let currentHunks: InlineGitDiffHunk[] = []
  let detailZoneId: string | null = null
  let activeDetailHunkKey: string | null = null

  const closeDetail = () => {
    if (detailZoneId && typeof editor?.changeViewZones === 'function') {
      const currentDetailZoneId = detailZoneId
      editor.changeViewZones((accessor: any) => {
        accessor.removeZone(currentDetailZoneId)
      })
    }

    detailZoneId = null
    activeDetailHunkKey = null
  }

  const openDetail = (hunk: InlineGitDiffHunk) => {
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
      const zoneId = accessor.addZone({
        afterLineNumber: Math.max(hunk.anchorLine, 0),
        domNode: createHunkDetailNode(hunk, closeDetail),
        heightInLines: getHunkDetailHeightInLines(hunk),
        ordinal: 10_000 + hunk.originalStartLine,
        suppressMouseDown: true,
      })

      if (zoneId !== undefined && zoneId !== null) {
        detailZoneId = String(zoneId)
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
    openDetail(hunk)
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
    currentHunks = []

    if (typeof editor?.deltaDecorations === 'function') {
      decorationIds = editor.deltaDecorations(decorationIds, []) ?? []
      return
    }

    decorationIds = []
  }

  const apply = (diff: InlineGitDiffResult) => {
    clear()

    if (diff.hunks.length === 0) {
      return
    }

    currentHunks = diff.hunks
    const decorations = createCurrentLineDecorations(editor, monaco, diff)

    if (decorations.length > 0 && typeof editor?.deltaDecorations === 'function') {
      decorationIds = editor.deltaDecorations([], decorations) ?? []
    }
  }

  return {
    apply,
    clear,
    dispose: () => {
      clear()
      mouseDownDisposable?.dispose?.()
      document.removeEventListener('keydown', handleDocumentKeyDown)
    },
  }
}
