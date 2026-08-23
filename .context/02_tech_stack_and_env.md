# Tech Stack & Runtime Environment

## Runtimes & Dependencies
- **Client Runtime:** Node v26.7.0 / Browser ES2022 / WebGPU / WebAssembly (WASM)
- **Extension Architecture:** Chrome Extension Manifest V3 (React 19 + Vite 6 + Tailwind CSS)
- **Client ML & WASM:** `@huggingface/transformers` v3.3 / ONNX Runtime Web / Rust `wasm-bindgen` (Rust 1.97 / target `wasm32-unknown-unknown`)
- **Server Runtime:** Go 1.22.5 (Linux x86_64)
- **Server Architecture:** Go `net/http` high-concurrency ingestion server

## Environment Variables (.env Schema)
- `PORT`: (Server) HTTP listening port (Default: `8080`)
- `VLM_ENDPOINT`: (Server Optional) Cloud Vision-Language Model endpoint URL
- `VLM_API_KEY`: (Server Optional) Cloud VLM authentication secret key (Do not commit to git)
