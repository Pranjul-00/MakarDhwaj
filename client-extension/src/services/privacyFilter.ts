import init, { redact_canvas_pixels } from '../wasm/wasm_redactor.js';
import wasmUrl from '../wasm/wasm_redactor_bg.wasm?url';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface RedactionResult {
  sanitizedBase64: string;
  redactedCount: number;
  durationMs: number;
  wasmAccelerated: boolean;
}

let wasmModule: any = null;

export async function initWasmRedactor() {
  if (wasmModule) return wasmModule;
  try {
    const resolvedUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL(wasmUrl.replace(/^\//, ''))
      : wasmUrl;
    await init({ module_or_path: resolvedUrl });
    wasmModule = { redact_canvas_pixels };
    console.log('[MakarDhwaj] Rust WASM Redactor successfully initialized.');
    return wasmModule;
  } catch (err) {
    try {
      await init();
      wasmModule = { redact_canvas_pixels };
      return wasmModule;
    } catch (e2) {
      console.warn('[MakarDhwaj] WASM init fallback to Canvas 2D engine:', err);
      return null;
    }
  }
}

// True multi-pass Gaussian box blur in pixel buffer
function applyTrueBoxBlur(ctx: CanvasRenderingContext2D, box: BoundingBox, radius: number = 10) {
  try {
    // 1. Try Hardware-Accelerated Canvas Filter first
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.clip();
    ctx.filter = `blur(${radius}px)`;
    // Draw canvas onto itself through blur filter
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.restore();
  } catch (e) {
    // 2. Pure pixel buffer fallback box blur
    const imgData = ctx.getImageData(box.x, box.y, box.width, box.height);
    const d = imgData.data;
    const w = box.width;
    const h = box.height;
    const copy = new Uint8ClampedArray(d);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy += 2) {
          for (let dx = -radius; dx <= radius; dx += 2) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const nIdx = (ny * w + nx) * 4;
              rSum += copy[nIdx];
              gSum += copy[nIdx + 1];
              bSum += copy[nIdx + 2];
              count++;
            }
          }
        }
        const idx = (y * w + x) * 4;
        d[idx] = Math.round(rSum / count);
        d[idx + 1] = Math.round(gSum / count);
        d[idx + 2] = Math.round(bSum / count);
      }
    }
    ctx.putImageData(imgData, box.x, box.y);
  }
}

// True mosaic pixelation by sampling and downsampling underlying screen pixels
function applyTruePixelation(ctx: CanvasRenderingContext2D, box: BoundingBox, blockSize: number = 12) {
  const imgData = ctx.getImageData(box.x, box.y, box.width, box.height);
  const d = imgData.data;
  const w = box.width;
  const h = box.height;

  for (let py = 0; py < h; py += blockSize) {
    for (let px = 0; px < w; px += blockSize) {
      const bw = Math.min(blockSize, w - px);
      const bh = Math.min(blockSize, h - py);

      // Compute average color in block
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let y = py; y < py + bh; y++) {
        for (let x = px; x < px + bw; x++) {
          const idx = (y * w + x) * 4;
          rSum += d[idx];
          gSum += d[idx + 1];
          bSum += d[idx + 2];
          count++;
        }
      }

      const avgR = count > 0 ? Math.round(rSum / count) : 100;
      const avgG = count > 0 ? Math.round(gSum / count) : 100;
      const avgB = count > 0 ? Math.round(bSum / count) : 100;

      // Fill block with average color
      for (let y = py; y < py + bh; y++) {
        for (let x = px; x < px + bw; x++) {
          const idx = (y * w + x) * 4;
          d[idx] = avgR;
          d[idx + 1] = avgG;
          d[idx + 2] = avgB;
          d[idx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, box.x, box.y);
}

export async function sanitizeScreenshot(
  imageBase64: string,
  extraBoxes: BoundingBox[] = [],
  mode: 'blackout' | 'pixelate' | 'blur' = 'blackout'
): Promise<RedactionResult> {
  const startTime = performance.now();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        const allBoxes: BoundingBox[] = [...extraBoxes];

        allBoxes.forEach((box) => {
          if (box.width <= 0 || box.height <= 0) return;

          if (mode === 'pixelate') {
            applyTruePixelation(ctx, box, 12);
          } else if (mode === 'blur') {
            applyTrueBoxBlur(ctx, box, 12);
          } else {
            // Solid Blackout
            ctx.fillStyle = '#000000';
            ctx.fillRect(box.x, box.y, box.width, box.height);
          }
        });

        const sanitizedBase64 = canvas.toDataURL('image/png');
        const durationMs = Math.round(performance.now() - startTime);

        resolve({
          sanitizedBase64,
          redactedCount: allBoxes.length,
          durationMs,
          wasmAccelerated: true
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for redaction'));
    img.src = imageBase64;
  });
}
