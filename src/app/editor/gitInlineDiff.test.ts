import { describe, expect, it } from 'vitest'
import { computeInlineGitDiff } from './gitInlineDiff'

describe('computeInlineGitDiff', () => {
  it('returns no hunks for identical content', () => {
    const diff = computeInlineGitDiff('module top;\nendmodule', 'module top;\nendmodule')

    expect(diff.hunks).toEqual([])
    expect(diff.changedLineCount).toBe(0)
    expect(diff.usedFallback).toBe(false)
  })

  it('detects added lines with current line anchors', () => {
    const diff = computeInlineGitDiff(
      'module top;\nendmodule',
      'module top;\nassign ready = 1\'b1;\nendmodule',
    )

    expect(diff.hunks).toHaveLength(1)
    expect(diff.hunks[0]).toMatchObject({
      anchorLine: 1,
      currentStartLine: 2,
      currentEndLine: 2,
      originalStartLine: 2,
      type: 'added',
    })
    expect(diff.hunks[0]?.addedLines.map((line) => line.content)).toEqual(["assign ready = 1'b1;"])
  })

  it('detects removed lines and keeps the deleted original content', () => {
    const diff = computeInlineGitDiff(
      'module top;\nassign ready = 1\'b1;\nendmodule',
      'module top;\nendmodule',
    )

    expect(diff.hunks).toHaveLength(1)
    expect(diff.hunks[0]).toMatchObject({
      anchorLine: 1,
      currentStartLine: 2,
      originalStartLine: 2,
      originalEndLine: 2,
      type: 'removed',
    })
    expect(diff.hunks[0]?.removedLines.map((line) => line.content)).toEqual(["assign ready = 1'b1;"])
  })

  it('groups replacement edits as modified hunks', () => {
    const diff = computeInlineGitDiff(
      'module top;\nassign ready = done;\nendmodule',
      'module top;\nassign ready = valid;\nendmodule',
    )

    expect(diff.hunks).toHaveLength(1)
    expect(diff.hunks[0]).toMatchObject({
      anchorLine: 1,
      currentStartLine: 2,
      originalStartLine: 2,
      type: 'modified',
    })
    expect(diff.hunks[0]?.removedLines.map((line) => line.content)).toEqual(['assign ready = done;'])
    expect(diff.hunks[0]?.addedLines.map((line) => line.content)).toEqual(['assign ready = valid;'])
  })

  it('handles multiple independent hunks', () => {
    const diff = computeInlineGitDiff(
      'a\nb\nc\nd\ne',
      'a\nb2\nc\nd\ne2',
    )

    expect(diff.hunks).toHaveLength(2)
    expect(diff.hunks.map((hunk) => hunk.type)).toEqual(['modified', 'modified'])
    expect(diff.hunks.map((hunk) => hunk.currentStartLine)).toEqual([2, 5])
  })

  it('normalizes CRLF content before comparing lines', () => {
    const diff = computeInlineGitDiff('a\r\nb\r\n', 'a\nb\n')

    expect(diff.hunks).toEqual([])
  })

  it('does not invent changes when both files omit a trailing newline', () => {
    const diff = computeInlineGitDiff('a\nb', 'a\nb')

    expect(diff.hunks).toEqual([])
  })
})
