import { getWorkspaceBaseName, normalizeWorkspacePath } from '../workspace/workspaceFiles';

export interface QuickOpenFileEntry {
  path: string;
  name: string;
}

export interface QuickOpenSearchResult extends QuickOpenFileEntry {
  score: number;
}

function getSubsequenceScore(target: string, query: string): number | null {
  let queryIndex = 0;
  let firstMatchIndex = -1;
  let previousMatchIndex = -1;
  let gapPenalty = 0;

  for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
    if (target[targetIndex] !== query[queryIndex]) {
      continue;
    }

    if (firstMatchIndex === -1) {
      firstMatchIndex = targetIndex;
    }

    if (previousMatchIndex !== -1) {
      gapPenalty += targetIndex - previousMatchIndex - 1;
    }

    previousMatchIndex = targetIndex;
    queryIndex += 1;

    if (queryIndex === query.length) {
      return 120 - firstMatchIndex * 3 - gapPenalty * 2 - (target.length - query.length);
    }
  }

  return null;
}

function getMatchScore(file: QuickOpenFileEntry, normalizedQuery: string): number | null {
  const lowerName = file.name.toLowerCase();
  const lowerPath = file.path.toLowerCase();

  if (lowerName === normalizedQuery) {
    return 2000 - lowerPath.length;
  }

  if (lowerName.startsWith(normalizedQuery)) {
    return 1800 - (lowerName.length - normalizedQuery.length) * 2;
  }

  const nameIncludesIndex = lowerName.indexOf(normalizedQuery);
  if (nameIncludesIndex !== -1) {
    return 1500 - nameIncludesIndex * 8 - lowerPath.length;
  }

  const nameSubsequenceScore = getSubsequenceScore(lowerName, normalizedQuery);
  if (nameSubsequenceScore !== null) {
    return 1200 + nameSubsequenceScore;
  }

  const pathIncludesIndex = lowerPath.indexOf(normalizedQuery);
  if (pathIncludesIndex !== -1) {
    return 900 - pathIncludesIndex * 4 - lowerPath.length;
  }

  const pathSubsequenceScore = getSubsequenceScore(lowerPath, normalizedQuery);
  if (pathSubsequenceScore !== null) {
    return 600 + pathSubsequenceScore;
  }

  return null;
}

export function createQuickOpenFileEntries(paths: string[]): QuickOpenFileEntry[] {
  return paths.map((path) => {
    const normalizedPath = normalizeWorkspacePath(path);

    return {
      path: normalizedPath,
      name: getWorkspaceBaseName(normalizedPath),
    };
  });
}

export function searchQuickOpenFiles(
  files: QuickOpenFileEntry[],
  query: string,
  limit = 100,
): QuickOpenSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0 || limit <= 0 || files.length === 0) {
    return [];
  }

  const matches: QuickOpenSearchResult[] = [];

  for (const file of files) {
    const score = getMatchScore(file, normalizedQuery);

    if (score === null) {
      continue;
    }

    matches.push({ ...file, score });
  }

  matches.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    if (left.name !== right.name) {
      return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
    }

    return left.path.localeCompare(right.path, undefined, { numeric: true, sensitivity: 'base' });
  });

  if (matches.length > limit) {
    matches.length = limit;
  }

  return matches;
}

export function getRecentQuickOpenFiles(
  recentFiles: QuickOpenFileEntry[],
  availableFiles?: QuickOpenFileEntry[] | null,
  limit = 20,
): QuickOpenSearchResult[] {
  if (limit <= 0 || recentFiles.length === 0) {
    return [];
  }

  let availablePaths: Set<string> | null = null;

  if (availableFiles) {
    availablePaths = new Set<string>();

    for (const file of availableFiles) {
      availablePaths.add(file.path);
    }
  }

  const recentResults: QuickOpenSearchResult[] = [];

  for (const file of recentFiles) {
    if (availablePaths !== null && !availablePaths.has(file.path)) {
      continue;
    }

    recentResults.push({
      ...file,
      score: limit - recentResults.length,
    });

    if (recentResults.length === limit) {
      break;
    }
  }

  return recentResults;
}