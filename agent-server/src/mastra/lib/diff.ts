const MAX_DIFF_LINES = 400;

function splitLines(content: string): string[] {
  return content.length === 0 ? [] : content.replace(/\r\n/g, "\n").split("\n");
}

export function createUnifiedDiff(before: string, after: string, beforePath: string, afterPath = beforePath): string {
  if (before === after) {
    return "";
  }

  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  const diffLines = [`--- a/${beforePath}`, `+++ b/${afterPath}`, "@@"];
  const maxLineCount = Math.max(beforeLines.length, afterLines.length);

  for (let lineIndex = 0; lineIndex < maxLineCount; lineIndex += 1) {
    const beforeLine = beforeLines[lineIndex];
    const afterLine = afterLines[lineIndex];

    if (beforeLine === afterLine) {
      if (diffLines.length < MAX_DIFF_LINES) {
        diffLines.push(` ${beforeLine ?? ""}`);
      }
      continue;
    }

    if (beforeLine !== undefined && diffLines.length < MAX_DIFF_LINES) {
      diffLines.push(`-${beforeLine}`);
    }

    if (afterLine !== undefined && diffLines.length < MAX_DIFF_LINES) {
      diffLines.push(`+${afterLine}`);
    }
  }

  if (diffLines.length >= MAX_DIFF_LINES) {
    diffLines.push("... diff truncated ...");
  }

  return diffLines.join("\n");
}
