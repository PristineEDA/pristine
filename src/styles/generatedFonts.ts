const generatedFontStyleId = 'pristine-generated-fonts';

interface GeneratedFontFace {
  family: string;
  file: string;
  format: 'truetype' | 'woff2';
}

const generatedFontFaces: GeneratedFontFace[] = [
  { family: '0xProto', file: '0xProto-Regular.ttf', format: 'truetype' },
  { family: 'ZxProto', file: 'ZxProto-Regular.ttf', format: 'truetype' },
  { family: 'Agave', file: 'Agave-Regular.ttf', format: 'truetype' },
  { family: 'DejaVu Sans Mono', file: 'DejaVuSansMono.ttf', format: 'truetype' },
  { family: 'Fantasque Sans Mono', file: 'FantasqueSansMono-Regular.ttf', format: 'truetype' },
  { family: 'Hack', file: 'Hack-Regular.woff2', format: 'woff2' },
  { family: 'Hasklig', file: 'Hasklig-Regular.ttf', format: 'truetype' },
  { family: 'JuliaMono', file: 'JuliaMono-Regular.woff2', format: 'woff2' },
  { family: 'Liberation Mono', file: 'LiberationMono-Regular.ttf', format: 'truetype' },
  { family: 'M PLUS Code Latin 60', file: 'MPLUSCodeLatin-Regular.ttf', format: 'truetype' },
  { family: 'M PLUS Code Latin 50', file: 'MPLUSCodeLatin50-Regular.ttf', format: 'truetype' },
  { family: 'Meslo LG DZ', file: 'MesloLGLDZ-Regular.ttf', format: 'truetype' },
  { family: 'Meslo LG MDZ', file: 'MesloLGMDZ-Regular.ttf', format: 'truetype' },
  { family: 'Meslo LG SDZ', file: 'MesloLGSDZ-Regular.ttf', format: 'truetype' },
  { family: 'Monaspace Argon', file: 'MonaspaceArgon-Regular.woff2', format: 'woff2' },
  { family: 'Monaspace Krypton', file: 'MonaspaceKrypton-Regular.woff2', format: 'woff2' },
  { family: 'Monaspace Neon', file: 'MonaspaceNeon-Regular.woff2', format: 'woff2' },
  { family: 'Monaspace Radon', file: 'MonaspaceRadon-Regular.woff2', format: 'woff2' },
  { family: 'Monaspace Xenon', file: 'MonaspaceXenon-Regular.woff2', format: 'woff2' },
  { family: 'Monoid', file: 'Monoid-Regular.ttf', format: 'truetype' },
];

function quoteCssString(value: string) {
  return JSON.stringify(value);
}

function createFontFaceCss({ family, file, format }: GeneratedFontFace) {
  const source = new URL(`./generated/fonts/${file}`, document.baseURI).toString();

  return `
@font-face {
  font-family: ${quoteCssString(family)};
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${quoteCssString(source)}) format(${quoteCssString(format)});
}`;
}

export function installGeneratedFonts() {
  if (document.getElementById(generatedFontStyleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = generatedFontStyleId;
  style.textContent = generatedFontFaces.map(createFontFaceCss).join('\n');
  document.head.append(style);
}
