import path from 'node:path';

export function validatePathWithinRoot(projectRoot: string, targetPath: string): string {
  const resolved = path.resolve(projectRoot, targetPath);
  if (!resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot) {
    throw new Error(`Path traversal denied: ${targetPath}`);
  }
  return resolved;
}

export function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`Expected string for "${name}", got ${typeof value}`);
  }
}

export function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Expected number for "${name}", got ${typeof value}`);
  }
}

export function assertOptionalString(value: unknown, name: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`Expected string or undefined for "${name}", got ${typeof value}`);
  }
}
