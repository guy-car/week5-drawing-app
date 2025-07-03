import { BASE_CANVAS_SIZE } from '../constants/canvas';
import { Skia, ImageFormat } from '@shopify/react-native-skia';

interface ExportOpts { 
  resize?: number; 
  format?: 'png'|'jpeg'; 
  quality?: number; 
}

// We only need to tell developers about the missing `scaleTo` once.
let warnedScaleToMissing = false;

export const exportCanvas = async (
  canvasRef: any,
  opts: ExportOpts = {}
): Promise<string | null> => {
  const { resize = 256, format = 'png', quality = 0.6 } = opts;
  if (!canvasRef.current) return null;
  const img     = canvasRef.current.makeImageSnapshot();
  const factor  = resize / BASE_CANVAS_SIZE;
  // Some Skia versions (including the Expo 53 bundle) don't expose `scaleTo` on `SkImage` yet.
  // If it's unavailable we skip resizing and log a warning so the app doesn't crash.
  let scaled = img;
  if (factor < 1) {
    if (typeof (img as any).scaleTo === 'function') {
      scaled = (img as any).scaleTo(factor);
    } else {
      if (__DEV__ && !warnedScaleToMissing) {
        console.info('Skia: img.scaleTo not available – exporting at original resolution (Expo SDK < 54)');
        warnedScaleToMissing = true;
      }
    }
  }
  const bytes   = scaled.encodeToBytes(format === 'jpeg' ? ImageFormat.JPEG : ImageFormat.PNG, quality * 100);
  const b64     = bytes.reduce((d: string, b: number) => d + String.fromCharCode(b), '');
  return `data:image/${format};base64,${btoa(b64)}`;
}; 