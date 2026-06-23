import { inflateSync } from 'node:zlib';

export const tinyQvVisualMinRatio = 0.0005;

export interface TinyQvViewportVisualAnalysis {
  visualColorfulPixelCount: number;
  visualColorfulPixelRatio: number;
  visualFailureReason: '' | 'colorful-ratio-below-threshold' | 'no-colorful-pixels' | 'no-non-background-pixels' | 'no-sample-pixels';
  visualIsNonBlank: boolean;
  visualNonBackgroundPixelCount: number;
  visualNonBackgroundPixelRatio: number;
  visualSampleHeight: number;
  visualSamplePixelCount: number;
  visualSampleWidth: number;
}

export interface TinyQvViewportVisualAnalysisOptions {
  edgeInsetPx?: number;
  minColorfulPixelRatio?: number;
  minimapExclusionHeightPx?: number;
  minimapExclusionWidthPx?: number;
}

interface DecodedPngRgba {
  data: Uint8ClampedArray;
  height: number;
  width: number;
}

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function analyzeTinyQvViewportPng(
  pngBuffer: Buffer,
  options: TinyQvViewportVisualAnalysisOptions = {},
): TinyQvViewportVisualAnalysis {
  const decoded = decodePngRgba(pngBuffer);

  return analyzeTinyQvViewportPixelsFromRgba(decoded.data, decoded.width, decoded.height, options);
}

export function analyzeTinyQvViewportPixelsFromRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: TinyQvViewportVisualAnalysisOptions = {},
): TinyQvViewportVisualAnalysis {
  const edgeInsetPx = Math.max(0, Math.floor(options.edgeInsetPx ?? 8));
  const minColorfulPixelRatio = options.minColorfulPixelRatio ?? tinyQvVisualMinRatio;
  const minimapWidth = Math.max(0, Math.floor(options.minimapExclusionWidthPx ?? 160));
  const minimapHeight = Math.max(0, Math.floor(options.minimapExclusionHeightPx ?? 130));
  const startX = Math.min(edgeInsetPx, width);
  const startY = Math.min(edgeInsetPx, height);
  const endX = Math.max(startX, width - edgeInsetPx);
  const endY = Math.max(startY, height - edgeInsetPx);
  const shouldExcludeMinimap = minimapWidth > 0
    && minimapHeight > 0
    && width > minimapWidth + edgeInsetPx * 2
    && height > minimapHeight + edgeInsetPx * 2;
  const minimapStartX = shouldExcludeMinimap ? Math.max(startX, width - minimapWidth - edgeInsetPx) : width;
  const minimapEndY = shouldExcludeMinimap ? Math.min(endY, minimapHeight + edgeInsetPx) : startY;
  let colorfulPixels = 0;
  let nonBackgroundPixels = 0;
  let samplePixels = 0;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      if (x >= minimapStartX && y < minimapEndY) {
        continue;
      }

      const offset = (y * width + x) * 4;
      const red = rgba[offset] ?? 0;
      const green = rgba[offset + 1] ?? 0;
      const blue = rgba[offset + 2] ?? 0;
      const alpha = rgba[offset + 3] ?? 255;

      if (alpha < 32) {
        continue;
      }

      samplePixels += 1;

      if (!isTinyQvBackgroundPixel(red, green, blue)) {
        nonBackgroundPixels += 1;
      }

      if (isTinyQvColorfulGdsPixel(red, green, blue)) {
        colorfulPixels += 1;
      }
    }
  }

  const colorfulRatio = samplePixels > 0 ? colorfulPixels / samplePixels : 0;
  const nonBackgroundRatio = samplePixels > 0 ? nonBackgroundPixels / samplePixels : 0;
  const failureReason = getTinyQvVisualFailureReason({
    colorfulPixels,
    colorfulRatio,
    minColorfulPixelRatio,
    nonBackgroundPixels,
    samplePixels,
  });

  return {
    visualColorfulPixelCount: colorfulPixels,
    visualColorfulPixelRatio: colorfulRatio,
    visualFailureReason: failureReason,
    visualIsNonBlank: failureReason === '',
    visualNonBackgroundPixelCount: nonBackgroundPixels,
    visualNonBackgroundPixelRatio: nonBackgroundRatio,
    visualSampleHeight: Math.max(0, endY - startY),
    visualSamplePixelCount: samplePixels,
    visualSampleWidth: Math.max(0, endX - startX),
  };
}

function getTinyQvVisualFailureReason(input: {
  colorfulPixels: number;
  colorfulRatio: number;
  minColorfulPixelRatio: number;
  nonBackgroundPixels: number;
  samplePixels: number;
}): TinyQvViewportVisualAnalysis['visualFailureReason'] {
  if (input.samplePixels === 0) {
    return 'no-sample-pixels';
  }

  if (input.nonBackgroundPixels === 0) {
    return 'no-non-background-pixels';
  }

  if (input.colorfulPixels === 0) {
    return 'no-colorful-pixels';
  }

  if (input.colorfulRatio < input.minColorfulPixelRatio) {
    return 'colorful-ratio-below-threshold';
  }

  return '';
}

function isTinyQvBackgroundPixel(red: number, green: number, blue: number) {
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);

  return maxChannel <= 38 && maxChannel - minChannel <= 24;
}

function isTinyQvColorfulGdsPixel(red: number, green: number, blue: number) {
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);
  const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;

  return maxChannel >= 64 && saturation >= 0.22;
}

function decodePngRgba(pngBuffer: Buffer): DecodedPngRgba {
  if (pngBuffer.length < pngSignature.length || !pngBuffer.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error('Invalid PNG signature');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];
  let offset = pngSignature.length;

  while (offset + 12 <= pngBuffer.length) {
    const length = pngBuffer.readUInt32BE(offset);
    const chunkType = pngBuffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > pngBuffer.length) {
      throw new Error(`Truncated PNG chunk: ${chunkType}`);
    }

    const chunkData = pngBuffer.subarray(dataStart, dataEnd);

    if (chunkType === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8] ?? 0;
      colorType = chunkData[9] ?? 0;
    } else if (chunkType === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (chunkType === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (width <= 0 || height <= 0) {
    throw new Error('PNG is missing IHDR dimensions');
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const sourceBytesPerPixel = colorType === 6 ? 4 : 3;
  const outputBytesPerPixel = 4;
  const stride = width * sourceBytesPerPixel;
  const expectedLength = (stride + 1) * height;

  if (inflated.length < expectedLength) {
    throw new Error('Truncated PNG pixel data');
  }

  const unfiltered = new Uint8Array(width * height * sourceBytesPerPixel);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[inputOffset] ?? 0;
    inputOffset += 1;
    const rowStart = y * stride;
    const previousRowStart = y > 0 ? rowStart - stride : -1;

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[inputOffset + x] ?? 0;
      const left = x >= sourceBytesPerPixel ? unfiltered[rowStart + x - sourceBytesPerPixel] ?? 0 : 0;
      const up = previousRowStart >= 0 ? unfiltered[previousRowStart + x] ?? 0 : 0;
      const upperLeft = previousRowStart >= 0 && x >= sourceBytesPerPixel
        ? unfiltered[previousRowStart + x - sourceBytesPerPixel] ?? 0
        : 0;
      unfiltered[rowStart + x] = unfilterPngByte(filterType, raw, left, up, upperLeft);
    }

    inputOffset += stride;
  }

  const output = new Uint8ClampedArray(width * height * outputBytesPerPixel);

  for (let sourceOffset = 0, outputOffset = 0; sourceOffset < unfiltered.length; sourceOffset += sourceBytesPerPixel, outputOffset += outputBytesPerPixel) {
    output[outputOffset] = unfiltered[sourceOffset] ?? 0;
    output[outputOffset + 1] = unfiltered[sourceOffset + 1] ?? 0;
    output[outputOffset + 2] = unfiltered[sourceOffset + 2] ?? 0;
    output[outputOffset + 3] = colorType === 6 ? unfiltered[sourceOffset + 3] ?? 255 : 255;
  }

  return { data: output, height, width };
}

function unfilterPngByte(filterType: number, raw: number, left: number, up: number, upperLeft: number) {
  switch (filterType) {
    case 0:
      return raw;
    case 1:
      return (raw + left) & 0xff;
    case 2:
      return (raw + up) & 0xff;
    case 3:
      return (raw + Math.floor((left + up) / 2)) & 0xff;
    case 4:
      return (raw + paethPredictor(left, up, upperLeft)) & 0xff;
    default:
      throw new Error(`Unsupported PNG filter: ${filterType}`);
  }
}

function paethPredictor(left: number, up: number, upperLeft: number) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);

  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) {
    return left;
  }

  return upDistance <= upperLeftDistance ? up : upperLeft;
}
