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

function createRemovedBlockNode(hunk: InlineGitDiffHunk) {
  const domNode = document.createElement('div')
  domNode.className = `pristine-inline-git-diff-removed-block pristine-inline-git-diff-removed-block-${hunk.type}`
  domNode.dataset.inlineGitDiff = 'removed'
  domNode.dataset.testid = 'monaco-inline-git-diff-removed-block'

  hunk.removedLines.forEach((line) => {
    const row = document.createElement('div')
    row.className = 'pristine-inline-git-diff-removed-row'
    row.dataset.originalLineNumber = String(line.originalLineNumber ?? '')

    const marker = document.createElement('span')
    marker.className = 'pristine-inline-git-diff-removed-marker'
    marker.textContent = '-'

    const content = document.createElement('span')
    content.className = 'pristine-inline-git-diff-removed-content'
    content.textContent = line.content.length > 0 ? line.content : ' '

    row.append(marker, content)
    domNode.append(row)
  })

  return domNode
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
          isWholeLine: true,
          linesDecorationsClassName: REMOVED_GUTTER_CLASS,
          overviewRuler: createOverviewRulerOptions(monaco, 'var(--ide-error)'),
        },
      })
    }
  })

  return decorations
}

function addRemovedViewZones(editor: any, hunks: InlineGitDiffHunk[]) {
  const zoneIds: string[] = []
  const removedHunks = hunks.filter((hunk) => hunk.removedLines.length > 0)

  if (removedHunks.length === 0 || typeof editor?.changeViewZones !== 'function') {
    return zoneIds
  }

  editor.changeViewZones((accessor: any) => {
    removedHunks.forEach((hunk) => {
      const zoneId = accessor.addZone({
        afterLineNumber: Math.max(hunk.anchorLine, 0),
        domNode: createRemovedBlockNode(hunk),
        heightInLines: Math.max(hunk.removedLines.length, 1),
        ordinal: 10_000 + hunk.originalStartLine,
        suppressMouseDown: true,
      })

      if (zoneId !== undefined && zoneId !== null) {
        zoneIds.push(String(zoneId))
      }
    })
  })

  return zoneIds
}

export function createMonacoInlineGitDiffController(editor: any, monaco: any): MonacoInlineGitDiffController {
  let decorationIds: string[] = []
  let viewZoneIds: string[] = []

  const clear = () => {
    if (viewZoneIds.length > 0 && typeof editor?.changeViewZones === 'function') {
      const currentZoneIds = viewZoneIds
      editor.changeViewZones((accessor: any) => {
        currentZoneIds.forEach((zoneId) => accessor.removeZone(zoneId))
      })
    }

    viewZoneIds = []

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

    viewZoneIds = addRemovedViewZones(editor, diff.hunks)
    const decorations = createCurrentLineDecorations(editor, monaco, diff)

    if (decorations.length > 0 && typeof editor?.deltaDecorations === 'function') {
      decorationIds = editor.deltaDecorations([], decorations) ?? []
    }
  }

  return {
    apply,
    clear,
    dispose: clear,
  }
}
