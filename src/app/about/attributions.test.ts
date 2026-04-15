import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatAttributionsMarkdown } from './attributions';

describe('attributions', () => {
  it('keeps ATTRIBUTIONS.md in sync with the shared attribution data', () => {
    const expectedMarkdown = formatAttributionsMarkdown();
    const actualMarkdown = fs.readFileSync(path.resolve(process.cwd(), 'ATTRIBUTIONS.md'), 'utf8').replace(/\r\n/g, '\n');

    expect(actualMarkdown).toBe(expectedMarkdown);
  });
});