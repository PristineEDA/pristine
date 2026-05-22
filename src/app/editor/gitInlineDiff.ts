export type InlineGitDiffHunkType = 'added' | 'removed' | 'modified'

export interface InlineGitDiffLine {
  content: string
  currentLineNumber?: number
  originalLineNumber?: number
}

export interface InlineGitDiffHunk {
  anchorLine: number
  currentEndLine: number
  currentStartLine: number
  originalEndLine: number
  originalStartLine: number
  type: InlineGitDiffHunkType
  addedLines: InlineGitDiffLine[]
  removedLines: InlineGitDiffLine[]
}

export interface InlineGitDiffResult {
  changedLineCount: number
  currentLineCount: number
  hunks: InlineGitDiffHunk[]
  originalLineCount: number
  usedFallback: boolean
}

export interface InlineGitDiffLineCounts {
  addedLineCount: number
  removedLineCount: number
}

export interface InlineGitDiffSummary extends InlineGitDiffLineCounts {
  filePath: string
}

type DiffOperationKind = 'equal' | 'added' | 'removed'

interface DiffOperation extends InlineGitDiffLine {
  kind: DiffOperationKind
}

const MAX_LCS_MATRIX_CELLS = 4_000_000

function splitContentIntoLines(content: string): string[] {
  if (content.length === 0) {
    return []
  }

  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

function createLine(content: string, lineNumber: number, side: 'current' | 'original'): InlineGitDiffLine {
  return side === 'current'
    ? { content, currentLineNumber: lineNumber }
    : { content, originalLineNumber: lineNumber }
}

function computeLcsOperations(
  originalLines: string[],
  currentLines: string[],
  originalLineOffset: number,
  currentLineOffset: number,
): DiffOperation[] {
  const originalLineCount = originalLines.length
  const currentLineCount = currentLines.length
  const columnCount = currentLineCount + 1
  const lcs = new Uint32Array((originalLineCount + 1) * columnCount)
  const readLcs = (originalIndex: number, currentIndex: number) => lcs[originalIndex * columnCount + currentIndex] ?? 0

  for (let originalIndex = originalLineCount - 1; originalIndex >= 0; originalIndex -= 1) {
    for (let currentIndex = currentLineCount - 1; currentIndex >= 0; currentIndex -= 1) {
      const cellIndex = originalIndex * columnCount + currentIndex
      lcs[cellIndex] = originalLines[originalIndex] === currentLines[currentIndex]
        ? readLcs(originalIndex + 1, currentIndex + 1) + 1
        : Math.max(
          readLcs(originalIndex + 1, currentIndex),
          readLcs(originalIndex, currentIndex + 1),
        )
    }
  }

  const operations: DiffOperation[] = []
  let originalIndex = 0
  let currentIndex = 0

  while (originalIndex < originalLineCount && currentIndex < currentLineCount) {
    const originalLineNumber = originalLineOffset + originalIndex + 1
    const currentLineNumber = currentLineOffset + currentIndex + 1

    if (originalLines[originalIndex] === currentLines[currentIndex]) {
      operations.push({
        content: currentLines[currentIndex] ?? '',
        currentLineNumber,
        kind: 'equal',
        originalLineNumber,
      })
      originalIndex += 1
      currentIndex += 1
      continue
    }

    const removeScore = readLcs(originalIndex + 1, currentIndex)
    const addScore = readLcs(originalIndex, currentIndex + 1)

    if (removeScore >= addScore) {
      operations.push({
        content: originalLines[originalIndex] ?? '',
        kind: 'removed',
        originalLineNumber,
      })
      originalIndex += 1
    } else {
      operations.push({
        content: currentLines[currentIndex] ?? '',
        currentLineNumber,
        kind: 'added',
      })
      currentIndex += 1
    }
  }

  while (originalIndex < originalLineCount) {
    operations.push({
      content: originalLines[originalIndex] ?? '',
      kind: 'removed',
      originalLineNumber: originalLineOffset + originalIndex + 1,
    })
    originalIndex += 1
  }

  while (currentIndex < currentLineCount) {
    operations.push({
      content: currentLines[currentIndex] ?? '',
      currentLineNumber: currentLineOffset + currentIndex + 1,
      kind: 'added',
    })
    currentIndex += 1
  }

  return operations
}

function createFallbackOperations(
  originalLines: string[],
  currentLines: string[],
  originalLineOffset: number,
  currentLineOffset: number,
): DiffOperation[] {
  return [
    ...originalLines.map<DiffOperation>((content, index) => ({
      content,
      kind: 'removed',
      originalLineNumber: originalLineOffset + index + 1,
    })),
    ...currentLines.map<DiffOperation>((content, index) => ({
      content,
      currentLineNumber: currentLineOffset + index + 1,
      kind: 'added',
    })),
  ]
}

function buildOperations(originalLines: string[], currentLines: string[]) {
  let commonPrefixLength = 0
  while (
    commonPrefixLength < originalLines.length
    && commonPrefixLength < currentLines.length
    && originalLines[commonPrefixLength] === currentLines[commonPrefixLength]
  ) {
    commonPrefixLength += 1
  }

  let commonSuffixLength = 0
  while (
    commonSuffixLength < originalLines.length - commonPrefixLength
    && commonSuffixLength < currentLines.length - commonPrefixLength
    && originalLines[originalLines.length - commonSuffixLength - 1] === currentLines[currentLines.length - commonSuffixLength - 1]
  ) {
    commonSuffixLength += 1
  }

  const originalMiddleEnd = originalLines.length - commonSuffixLength
  const currentMiddleEnd = currentLines.length - commonSuffixLength
  const originalMiddleLines = originalLines.slice(commonPrefixLength, originalMiddleEnd)
  const currentMiddleLines = currentLines.slice(commonPrefixLength, currentMiddleEnd)
  const middleMatrixCells = (originalMiddleLines.length + 1) * (currentMiddleLines.length + 1)
  const usedFallback = middleMatrixCells > MAX_LCS_MATRIX_CELLS

  return {
    operations: [
      ...currentLines.slice(0, commonPrefixLength).map<DiffOperation>((content, index) => ({
        content,
        currentLineNumber: index + 1,
        kind: 'equal',
        originalLineNumber: index + 1,
      })),
      ...(usedFallback
        ? createFallbackOperations(originalMiddleLines, currentMiddleLines, commonPrefixLength, commonPrefixLength)
        : computeLcsOperations(originalMiddleLines, currentMiddleLines, commonPrefixLength, commonPrefixLength)),
      ...currentLines.slice(currentMiddleEnd).map<DiffOperation>((content, index) => {
        const currentLineNumber = currentMiddleEnd + index + 1
        const originalLineNumber = originalMiddleEnd + index + 1

        return {
          content,
          currentLineNumber,
          kind: 'equal',
          originalLineNumber,
        }
      }),
    ],
    usedFallback,
  }
}

function buildHunks(operations: DiffOperation[], originalLineCount: number, currentLineCount: number): InlineGitDiffHunk[] {
  const hunks: InlineGitDiffHunk[] = []
  let addedLines: InlineGitDiffLine[] = []
  let removedLines: InlineGitDiffLine[] = []
  let anchorCurrentLine = 0
  let anchorOriginalLine = 0
  let lastCurrentLine = 0
  let lastOriginalLine = 0

  const flushPendingHunk = () => {
    if (addedLines.length === 0 && removedLines.length === 0) {
      return
    }

    const type: InlineGitDiffHunkType = addedLines.length > 0 && removedLines.length > 0
      ? 'modified'
      : addedLines.length > 0
        ? 'added'
        : 'removed'
    const currentStartLine = addedLines[0]?.currentLineNumber ?? Math.min(anchorCurrentLine + 1, Math.max(currentLineCount, 1))
    const currentEndLine = addedLines[addedLines.length - 1]?.currentLineNumber ?? currentStartLine
    const originalStartLine = removedLines[0]?.originalLineNumber ?? Math.min(anchorOriginalLine + 1, Math.max(originalLineCount, 1))
    const originalEndLine = removedLines[removedLines.length - 1]?.originalLineNumber ?? originalStartLine

    hunks.push({
      addedLines,
      anchorLine: anchorCurrentLine,
      currentEndLine,
      currentStartLine,
      originalEndLine,
      originalStartLine,
      removedLines,
      type,
    })

    addedLines = []
    removedLines = []
  }

  operations.forEach((operation) => {
    if (operation.kind === 'equal') {
      flushPendingHunk()
      lastCurrentLine = operation.currentLineNumber ?? lastCurrentLine
      lastOriginalLine = operation.originalLineNumber ?? lastOriginalLine
      return
    }

    if (addedLines.length === 0 && removedLines.length === 0) {
      anchorCurrentLine = lastCurrentLine
      anchorOriginalLine = lastOriginalLine
    }

    if (operation.kind === 'added') {
      addedLines.push(createLine(operation.content, operation.currentLineNumber ?? lastCurrentLine + 1, 'current'))
      lastCurrentLine = operation.currentLineNumber ?? lastCurrentLine
      return
    }

    removedLines.push(createLine(operation.content, operation.originalLineNumber ?? lastOriginalLine + 1, 'original'))
    lastOriginalLine = operation.originalLineNumber ?? lastOriginalLine
  })

  flushPendingHunk()
  return hunks
}

export function computeInlineGitDiff(originalContent: string, currentContent: string): InlineGitDiffResult {
  const originalLines = splitContentIntoLines(originalContent)
  const currentLines = splitContentIntoLines(currentContent)

  if (originalContent === currentContent) {
    return {
      changedLineCount: 0,
      currentLineCount: currentLines.length,
      hunks: [],
      originalLineCount: originalLines.length,
      usedFallback: false,
    }
  }

  const { operations, usedFallback } = buildOperations(originalLines, currentLines)
  const hunks = buildHunks(operations, originalLines.length, currentLines.length)

  return {
    changedLineCount: hunks.reduce((total, hunk) => total + hunk.addedLines.length + hunk.removedLines.length, 0),
    currentLineCount: currentLines.length,
    hunks,
    originalLineCount: originalLines.length,
    usedFallback,
  }
}

export function getInlineGitDiffLineCounts(diff: InlineGitDiffResult): InlineGitDiffLineCounts {
  return diff.hunks.reduce<InlineGitDiffLineCounts>((counts, hunk) => ({
    addedLineCount: counts.addedLineCount + hunk.addedLines.length,
    removedLineCount: counts.removedLineCount + hunk.removedLines.length,
  }), {
    addedLineCount: 0,
    removedLineCount: 0,
  })
}
