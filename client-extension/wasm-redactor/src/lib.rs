use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BoundingBox {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub label: Option<String>,
}

#[wasm_bindgen]
pub fn redact_canvas_pixels(
    pixels: &mut [u8],
    img_width: u32,
    img_height: u32,
    boxes_json: &str,
    mode: &str,
) -> Result<u32, JsValue> {
    let boxes: Vec<BoundingBox> = serde_json::from_str(boxes_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

    let total_pixels = (img_width * img_height) as usize;
    if pixels.len() < total_pixels * 4 {
        return Err(JsValue::from_str("Buffer size smaller than dimensions RGBA"));
    }

    let mut redacted_count = 0;

    for bbox in boxes {
        let x_end = (bbox.x + bbox.width).min(img_width);
        let y_end = (bbox.y + bbox.height).min(img_height);

        match mode {
            "pixelate" => {
                let block_size = 12u32;
                for py in (bbox.y..y_end).step_by(block_size as usize) {
                    for px in (bbox.x..x_end).step_by(block_size as usize) {
                        let bx_end = (px + block_size).min(x_end);
                        let by_end = (py + block_size).min(y_end);

                        // Calculate average color in block
                        let mut r_sum: u64 = 0;
                        let mut g_sum: u64 = 0;
                        let mut b_sum: u64 = 0;
                        let mut count: u64 = 0;

                        for y in py..by_end {
                            for x in px..bx_end {
                                let idx = ((y * img_width + x) * 4) as usize;
                                r_sum += pixels[idx] as u64;
                                g_sum += pixels[idx + 1] as u64;
                                b_sum += pixels[idx + 2] as u64;
                                count += 1;
                            }
                        }

                        if count > 0 {
                            let avg_r = (r_sum / count) as u8;
                            let avg_g = (g_sum / count) as u8;
                            let avg_b = (b_sum / count) as u8;

                            for y in py..by_end {
                                for x in px..bx_end {
                                    let idx = ((y * img_width + x) * 4) as usize;
                                    pixels[idx] = avg_r;
                                    pixels[idx + 1] = avg_g;
                                    pixels[idx + 2] = avg_b;
                                    pixels[idx + 3] = 255;
                                }
                            }
                        }
                    }
                }
            }
            "blur" => {
                // True multi-pass separable box blur in Rust memory
                let radius = 10i32;
                let mut temp_buf = vec![0u8; ((y_end - bbox.y) * (x_end - bbox.x) * 4) as usize];
                let bw = x_end - bbox.x;

                // Copy bounding region to temp
                for y in bbox.y..y_end {
                    for x in bbox.x..x_end {
                        let src_idx = ((y * img_width + x) * 4) as usize;
                        let dst_idx = (((y - bbox.y) * bw + (x - bbox.x)) * 4) as usize;
                        temp_buf[dst_idx] = pixels[src_idx];
                        temp_buf[dst_idx + 1] = pixels[src_idx + 1];
                        temp_buf[dst_idx + 2] = pixels[src_idx + 2];
                        temp_buf[dst_idx + 3] = 255;
                    }
                }

                // Blur pass
                for y in bbox.y..y_end {
                    for x in bbox.x..x_end {
                        let mut r_sum = 0u64;
                        let mut g_sum = 0u64;
                        let mut b_sum = 0u64;
                        let mut count = 0u64;

                        let ry_start = (y as i32 - radius).max(bbox.y as i32);
                        let ry_end = (y as i32 + radius).min(y_end as i32 - 1);
                        let rx_start = (x as i32 - radius).max(bbox.x as i32);
                        let rx_end = (x as i32 + radius).min(x_end as i32 - 1);

                        for ny in (ry_start..=ry_end).step_by(2) {
                            for nx in (rx_start..=rx_end).step_by(2) {
                                let tidx = (((ny as u32 - bbox.y) * bw + (nx as u32 - bbox.x)) * 4) as usize;
                                r_sum += temp_buf[tidx] as u64;
                                g_sum += temp_buf[tidx + 1] as u64;
                                b_sum += temp_buf[tidx + 2] as u64;
                                count += 1;
                            }
                        }

                        if count > 0 {
                            let idx = ((y * img_width + x) * 4) as usize;
                            pixels[idx] = (r_sum / count) as u8;
                            pixels[idx + 1] = (g_sum / count) as u8;
                            pixels[idx + 2] = (b_sum / count) as u8;
                            pixels[idx + 3] = 255;
                        }
                    }
                }
            }
            _ => {
                // Solid blackout masking
                for y in bbox.y..y_end {
                    for x in bbox.x..x_end {
                        let idx = ((y * img_width + x) * 4) as usize;
                        pixels[idx] = 0;
                        pixels[idx + 1] = 0;
                        pixels[idx + 2] = 0;
                        pixels[idx + 3] = 255;
                    }
                }
            }
        }
        redacted_count += 1;
    }

    Ok(redacted_count)
}
