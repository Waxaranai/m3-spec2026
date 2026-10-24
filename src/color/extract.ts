import {
  Hct,
  QuantizerCelebi,
  Score,
  argbFromRgb,
  hexFromArgb,
} from '@material/material-color-utilities';

const MAX_SAMPLE_SIZE = 1024;
const MAX_QUANTIZE_SIZE = 160;
const QUANTIZE_COLORS = 128;
const SEED_COUNT = 10;
const FALLBACK = 0xff1b6ef3;

export interface LoadedImage {
  url: string;
  name: string;
  width: number;
  height: number;
  /** A bounded copy of the image used for pixel picking and quantization. */
  canvas: HTMLCanvasElement;
  /** True when this loader created the object URL and must revoke it. */
  ownsUrl: boolean;
}

export interface SeedCandidate {
  argb: number;
  hex: string;
  hct: { hue: number; chroma: number; tone: number };
}

export interface ExtractionResult {
  seeds: SeedCandidate[];
  usedFallback: boolean;
  sampledPixels: number;
  uniqueColors: number;
}

function drawBounded(
  image: CanvasImageSource,
  width: number,
  height: number,
  maxSize: number,
): HTMLCanvasElement {
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is not available in this browser.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function decodeImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error('The image has no readable dimensions.');
  }
  return image;
}

async function makeLoadedImage(
  url: string,
  name: string,
  ownsUrl: boolean,
): Promise<LoadedImage> {
  const image = await decodeImage(url);
  return {
    url,
    name,
    width: image.naturalWidth,
    height: image.naturalHeight,
    canvas: drawBounded(
      image,
      image.naturalWidth,
      image.naturalHeight,
      MAX_SAMPLE_SIZE,
    ),
    ownsUrl,
  };
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image. Use PNG, JPEG, WebP, AVIF, GIF, or SVG.');
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new Error('That image is larger than 30 MB. Try a smaller version.');
  }
  const url = URL.createObjectURL(file);
  try {
    return await makeLoadedImage(url, file.name || 'Uploaded image', true);
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function loadImageFromUrl(
  url: string,
  name: string,
): Promise<LoadedImage> {
  return makeLoadedImage(url, name, false);
}

export function releaseImage(image: LoadedImage | undefined): void {
  if (image?.ownsUrl) URL.revokeObjectURL(image.url);
}

/**
 * Reproduces the useful part of Android's wallpaper pipeline: quantize to a
 * high cluster count, then let Score rank colors for use as a UI seed.
 */
export function extractSeeds(image: LoadedImage): ExtractionResult {
  const quantCanvas = drawBounded(
    image.canvas,
    image.canvas.width,
    image.canvas.height,
    MAX_QUANTIZE_SIZE,
  );
  const context = quantCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is not available in this browser.');
  const { data } = context.getImageData(0, 0, quantCanvas.width, quantCanvas.height);

  const pixels: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 128) continue;
    pixels.push(argbFromRgb(data[index], data[index + 1], data[index + 2]));
  }

  if (pixels.length === 0) {
    throw new Error('The image is fully transparent. Try another image.');
  }

  const quantized = QuantizerCelebi.quantize(pixels, QUANTIZE_COLORS);
  const ranked = Score.score(quantized, {
    desired: SEED_COUNT,
    filter: true,
    fallbackColorARGB: FALLBACK,
  });

  const seen = new Set<string>();
  const seeds: SeedCandidate[] = [];
  for (const argb of ranked) {
    const hex = hexFromArgb(argb).toLowerCase();
    if (seen.has(hex)) continue;
    seen.add(hex);
    const hct = Hct.fromInt(argb);
    seeds.push({
      argb,
      hex,
      hct: {
        hue: Math.round(hct.hue * 100) / 100,
        chroma: Math.round(hct.chroma * 100) / 100,
        tone: Math.round(hct.tone * 100) / 100,
      },
    });
    if (seeds.length >= SEED_COUNT) break;
  }

  const usedFallback = seeds.length === 1 && seeds[0].argb === FALLBACK;

  return {
    seeds,
    usedFallback,
    sampledPixels: pixels.length,
    uniqueColors: quantized.size,
  };
}

export function pickColor(
  image: LoadedImage,
  normalizedX: number,
  normalizedY: number,
): SeedCandidate {
  const x = Math.min(
    image.canvas.width - 1,
    Math.max(0, Math.round(normalizedX * (image.canvas.width - 1))),
  );
  const y = Math.min(
    image.canvas.height - 1,
    Math.max(0, Math.round(normalizedY * (image.canvas.height - 1))),
  );
  const context = image.canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D is not available in this browser.');
  const [r, g, b, a] = context.getImageData(x, y, 1, 1).data;
  if (a < 16) throw new Error('That pixel is transparent. Pick another spot.');
  const argb = argbFromRgb(r, g, b);
  const hct = Hct.fromInt(argb);
  return {
    argb,
    hex: hexFromArgb(argb).toLowerCase(),
    hct: {
      hue: Math.round(hct.hue * 100) / 100,
      chroma: Math.round(hct.chroma * 100) / 100,
      tone: Math.round(hct.tone * 100) / 100,
    },
  };
}
