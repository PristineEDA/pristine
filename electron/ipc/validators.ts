import path from 'node:path';

export function validatePathWithinRoot(projectRoot: string, targetPath: string): string {
  const normalizedRoot = path.resolve(projectRoot);
  const resolved = path.resolve(normalizedRoot, targetPath);
  const relative = path.relative(normalizedRoot, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
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

const VALID_ENCODINGS = new Set<string>([
  'utf-8', 'utf8', 'ascii', 'binary', 'base64', 'hex', 'latin1', 'ucs-2', 'ucs2', 'utf16le',
]);

export function assertValidEncoding(value: unknown, name: string): asserts value is BufferEncoding {
  if (value === undefined) return;
  assertString(value, name);
  if (!VALID_ENCODINGS.has(value.toLowerCase())) {
    throw new Error(`Invalid encoding "${value}". Allowed: ${[...VALID_ENCODINGS].join(', ')}`);
  }
}
