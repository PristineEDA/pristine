import { afterEach, describe, expect, it } from 'vitest';
import { installGeneratedFonts } from './generatedFonts';

describe('installGeneratedFonts', () => {
  afterEach(() => {
    document.getElementById('pristine-generated-fonts')?.remove();
  });

  it('registers generated font URLs relative to the current document base URI', () => {
    installGeneratedFonts();

    const style = document.getElementById('pristine-generated-fonts');

    expect(style?.textContent).toContain(
      new URL('./generated/fonts/0xProto-Regular.ttf', document.baseURI).toString(),
    );
    expect(style?.textContent).toContain('font-family: "Monaspace Neon"');
    expect(style?.textContent).toContain('format("woff2")');
  });

  it('does not duplicate the generated font stylesheet', () => {
    installGeneratedFonts();
    installGeneratedFonts();

    expect(document.querySelectorAll('#pristine-generated-fonts')).toHaveLength(1);
  });
});
