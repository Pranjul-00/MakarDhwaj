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
      console.warn('[MakarDhwaj] WASM init fallback to Canvas 2D:', err);
      return null;
    }
  }
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
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        const allBoxes: BoundingBox[] = [...extraBoxes];

        // Combine WASM / JS canvas redaction algorithm
        let usedWasm = false;
        const wasm = await initWasmRedactor();

        if (wasm && typeof wasm.redact_canvas_pixels === 'function') {
          try {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const boxesJson = JSON.stringify(allBoxes);
            wasm.redact_canvas_pixels(
              imgData.data,
              canvas.width,
              canvas.height,
              boxesJson,
              mode
            );
            ctx.putImageData(imgData, 0, 0);
            usedWasm = true;
          } catch (wasmErr) {
            console.warn('[MakarDhwaj WASM Error, falling back to 2D]:', wasmErr);
          }
        }

        // Pure Canvas 2D fallback when WASM is not loaded
        if (!usedWasm) {
          allBoxes.forEach((box) => {
            if (mode === 'pixelate') {
              const blockSize = 12;
              for (let py = box.y; py < box.y + box.height; py += blockSize) {
                for (let px = box.x; px < box.x + box.width; px += blockSize) {
                  const w = Math.min(blockSize, box.x + box.width - px);
                  const h = Math.min(blockSize, box.y + box.height - py);
                  ctx.fillStyle = '#27272a';
                  ctx.fillRect(px, py, w, h);
                }
              }
            } else if (mode === 'blur') {
              ctx.fillStyle = '#52525b';
              ctx.fillRect(box.x, box.y, box.width, box.height);
            } else {
              // Solid Blackout
              ctx.fillStyle = '#000000';
              ctx.fillRect(box.x, box.y, box.width, box.height);
            }
          });
        }

        const sanitizedBase64 = canvas.toDataURL('image/png');
        const durationMs = Math.round(performance.now() - startTime);

        resolve({
          sanitizedBase64,
          redactedCount: allBoxes.length,
          durationMs,
          wasmAccelerated: usedWasm
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for redaction'));
    img.src = imageBase64;
  });
}
