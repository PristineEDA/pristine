import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  validatePathWithinRoot,
  assertString,
  assertNumber,
  assertOptionalString,
  assertValidEncoding,
} from './validators.js';

// ─── validatePathWithinRoot ─────────────────────────────────────────────────

describe('validatePathWithinRoot', () => {
  const root = path.resolve('/project');

  it('allows a relative path inside the root', () => {
    const result = validatePathWithinRoot(root, 'src/main.ts');
    expect(result).toBe(path.join(root, 'src', 'main.ts'));
  });

  it('allows the root itself', () => {
    const result = validatePathWithinRoot(root, '.');
    expect(result).toBe(root);
  });

  it('blocks path traversal via ..', () => {
    expect(() => validatePathWithinRoot(root, '../etc/passwd')).toThrow('Path traversal denied');
  });

  it('blocks absolute paths outside root', () => {
    expect(() => validatePathWithinRoot(root, '/etc/passwd')).toThrow('Path traversal denied');
  });

  it('blocks traversal hidden in nested ..', () => {
    expect(() => validatePathWithinRoot(root, 'src/../../etc/password')).toThrow('Path traversal denied');
  });
});

// ─── assertString ───────────────────────────────────────────────────────────

describe('assertString', () => {
  it('passes for a valid string', () => {
    expect(() => assertString('hello', 'param')).not.toThrow();
  });

  it('throws for number', () => {
    expect(() => assertString(42, 'param')).toThrow('Expected string');
  });

  it('throws for null', () => {
    expect(() => assertString(null, 'param')).toThrow('Expected string');
  });

  it('throws for undefined', () => {
    expect(() => assertString(undefined, 'param')).toThrow('Expected string');
  });
});

// ─── assertNumber ───────────────────────────────────────────────────────────

describe('assertNumber', () => {
  it('passes for a valid number', () => {
    expect(() => assertNumber(42, 'param')).not.toThrow();
  });

  it('throws for NaN', () => {
    expect(() => assertNumber(NaN, 'param')).toThrow('Expected number');
  });

  it('throws for string', () => {
    expect(() => assertNumber('hello', 'param')).toThrow('Expected number');
  });
});

// ─── assertOptionalString ───────────────────────────────────────────────────

describe('assertOptionalString', () => {
  it('passes for a valid string', () => {
    expect(() => assertOptionalString('hi', 'p')).not.toThrow();
  });

  it('passes for undefined', () => {
    expect(() => assertOptionalString(undefined, 'p')).not.toThrow();
  });

  it('throws for number', () => {
    expect(() => assertOptionalString(42, 'p')).toThrow('Expected string or undefined');
  });
});

// ─── assertValidEncoding ────────────────────────────────────────────────────

describe('assertValidEncoding', () => {
  it('passes for utf-8', () => {
    expect(() => assertValidEncoding('utf-8', 'enc')).not.toThrow();
  });

  it('passes for ascii', () => {
    expect(() => assertValidEncoding('ascii', 'enc')).not.toThrow();
  });

  it('passes for base64', () => {
    expect(() => assertValidEncoding('base64', 'enc')).not.toThrow();
  });

  it('passes for binary', () => {
    expect(() => assertValidEncoding('binary', 'enc')).not.toThrow();
  });

  it('passes for undefined (default encoding)', () => {
    expect(() => assertValidEncoding(undefined, 'enc')).not.toThrow();
  });

  it('rejects invalid encoding string', () => {
    expect(() => assertValidEncoding('evil-enc', 'enc')).toThrow('Invalid encoding');
  });

  it('rejects non-string encoding', () => {
    expect(() => assertValidEncoding(42, 'enc')).toThrow('Expected string');
  });

  it('rejects empty string', () => {
    expect(() => assertValidEncoding('', 'enc')).toThrow('Invalid encoding');
  });
});
