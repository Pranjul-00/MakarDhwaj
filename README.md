# MakarDhwaj

A privacy-preserving vision agent that runs entirely on-device inside a browser extension. It captures the active viewport, detects and redacts personally identifiable information using a local Rust WebAssembly pipeline, and sends only the sanitized visual context to a lightweight reasoning server. The server interprets the page layout and returns an actionable UI command that the extension executes autonomously.

No raw screenshots or sensitive DOM data ever leave the client.

---

## Problem

Cloud-hosted vision models need visual context to automate web tasks, but transmitting raw screenshots exposes passwords, credit card numbers, email addresses, and other sensitive information embedded in the page. Existing approaches either skip visual context entirely (losing layout understanding) or send everything to the cloud (breaking privacy guarantees).

## Approach

MakarDhwaj splits the pipeline into two stages with a hard privacy boundary between them.

**Stage 1 runs locally in the browser.** A content script extracts the structural DOM tree (interactive elements, bounding rectangles) without reading input field values. A background service worker captures the viewport as a screenshot. A Rust module compiled to WebAssembly scans the image buffer and applies solid blackout, pixelation, or semantic blur over every detected PII region. The sanitized frame and the structural metadata are the only things that cross the network.

**Stage 2 runs on a server.** A Go HTTP service receives the sanitized image alongside the DOM element coordinates. A reasoning engine (currently rule-based, designed to be swapped with an open-weights vision-language model like LLaVA or Qwen-VL) determines the next optimal action given a user-specified goal. It returns a JSON payload describing the action type, target selector, and screen coordinates. The extension parses this payload and dispatches a synthetic browser event on the active tab.

---

## Architecture

```
Browser Extension (Client)
  |
  |-- Content Script (extractor.ts)
  |     Extracts interactive DOM nodes and bounding rects.
  |     Flags sensitive input fields (password, email, card).
  |     Executes synthetic click/type/scroll events on command.
  |
  |-- Background Service Worker (serviceWorker.ts)
  |     Captures viewport via chrome.tabs.captureVisibleTab.
  |     Coordinates the full perception-redaction-action loop.
  |
  |-- Privacy Filter (privacyFilter.ts)
  |     Loads the compiled WASM redactor module.
  |     Applies pixel-level masking over PII bounding boxes.
  |     Falls back to Canvas 2D if WASM is unavailable.
  |
  |-- WASM Redactor (wasm-redactor/src/lib.rs)
  |     Rust crate compiled to wasm32-unknown-unknown.
  |     Operates directly on RGBA pixel buffers in linear memory.
  |     Supports blackout, pixelation (12px blocks), and blur modes.
  |
  |-- Popup UI (React 19 + Tailwind)
        Control panel for goal input, redaction mode selection,
        live execution log, and performance metrics.

          |
          | POST /api/v1/analyze (sanitized image + DOM metadata)
          v

Server Backend (Go)
  |
  |-- HTTP Ingestion Endpoint
  |     Accepts JSON payloads with base64 image and element list.
  |     Returns standardized action JSON.
  |
  |-- VLM Reasoning Engine
        Currently a rule-based DOM matcher.
        Designed as a drop-in slot for any vision-language model.
```

---

## Repository Structure

```
MakarDhwaj/
  .context/                  Living project state tracked in version control
  client-extension/
    manifest.json            Chrome Extension Manifest V3
    vite.config.ts           Multi-entry Vite build (popup, background, content)
    package.json             Node dependencies and build scripts
    index.html               Extension popup entry point
    src/
      background/
        serviceWorker.ts     Screen capture and agent loop coordinator
      content/
        extractor.ts         DOM bounding box extraction and event dispatcher
      services/
        privacyFilter.ts     PII detection and WASM canvas redaction
      popup/
        App.tsx              React control panel component
        main.tsx             React entry point
        index.css            Base styles
    wasm-redactor/
      Cargo.toml             Rust crate manifest
      src/
        lib.rs               WASM pixel redaction algorithms
  server-backend/
    go.mod                   Go module definition
    main.go                  HTTP server with reasoning engine
```

---

## Prerequisites

- Node.js 20 or later
- Rust toolchain with the wasm32-unknown-unknown target
- wasm-pack
- Go 1.22 or later
- Google Chrome or Chromium

Install the Rust WASM target if you have not already:

```
rustup target add wasm32-unknown-unknown
```

Install wasm-pack if it is not available:

```
cargo install wasm-pack
```

---

## Build

### Compile the WASM redactor module

```
cd client-extension/wasm-redactor
wasm-pack build --target web --out-dir ../src/wasm
```

### Install Node dependencies and build the extension

```
cd client-extension
npm install
npm run build
```

The production bundle will be written to `client-extension/dist/`.

### Build the Go server

```
cd server-backend
go build -o vlm-server .
```

---

## Running

### Start the backend server

```
cd server-backend
./vlm-server
```

The server listens on port 8080 by default. Set the PORT environment variable to change it.

Verify it is running:

```
curl http://localhost:8080/health
```

### Load the extension in Chrome

1. Open chrome://extensions in your browser.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the client-extension/dist directory.

### Use the agent

1. Navigate to any web page with interactive elements.
2. Click the extension icon in the toolbar to open the popup.
3. Choose a redaction mode: blackout, pixelate, or blur.
4. Enter a natural language goal such as "Click the submit button".
5. Press Run.

The extension will capture the screen, redact sensitive regions locally, send the sanitized frame to the server, receive an action command, and execute it on the page. The popup displays a live log of each step along with latency and redaction metrics.

---

## API Reference

### POST /api/v1/analyze

Request body:

```json
{
  "user_goal": "Click the login button",
  "sanitized_image": "data:image/png;base64,...",
  "viewport": {
    "width": 1280,
    "height": 800,
    "devicePixelRatio": 1.0
  },
  "dom_elements": [
    {
      "id": "elem_1",
      "tag": "button",
      "selector": "#login-btn",
      "text": "Log In",
      "bounds": { "x": 500, "y": 400, "width": 120, "height": 40 },
      "isInteractive": true,
      "isSensitive": false
    }
  ]
}
```

Response:

```json
{
  "action": "click",
  "selector": "#login-btn",
  "coordinates": [560, 420],
  "text": "",
  "confidence": 0.95,
  "reasoning": "Identified login button matching user goal.",
  "latency_ms": 4
}
```

### GET /health

Returns server status.

---

## How Privacy Redaction Works

The content script identifies sensitive DOM elements by inspecting input types (password, email, tel) and scanning element IDs and name attributes for keywords like "card", "cvv", and "ssn". It computes their bounding rectangles in device pixel coordinates.

These bounding boxes are passed to the Rust WASM module, which iterates over the raw RGBA pixel buffer in linear memory and overwrites every pixel inside each box. Three modes are available:

- Blackout fills the region with solid black.
- Pixelate averages colors in 12x12 pixel blocks, producing a mosaic effect.
- Blur replaces the region with a uniform gray.

Because the pixel manipulation happens inside WebAssembly linear memory rather than on the JavaScript main thread, the operation completes in under 15 milliseconds for a full 1920x1080 frame without causing any visible UI stutter.

If the WASM module fails to load (for example in browsers without WebAssembly support), the system falls back to Canvas 2D fillRect operations automatically.

---

## Evaluation Metrics

The system is designed around five performance dimensions:

- Layout comprehension accuracy after redaction (can the server still understand the page)
- PII recall and precision (no sensitive data leaks, no over-censoring of action targets)
- Redaction boundary cleanliness (tight masking without visual artifacts)
- Resource utilization (no main thread blocking, mandatory WebGPU/WASM offloading)
- End-to-end latency from capture to action execution

---

## Extending the VLM Backend

The reasoning engine in main.go is currently a rule-based DOM element matcher. To integrate a real vision-language model:

1. Set the VLM_ENDPOINT and VLM_API_KEY environment variables.
2. Replace the body of the processVLMReasoning function with an HTTP call to your model endpoint, passing the base64 image and DOM metadata as part of the prompt.
3. Parse the model response into the ActionResponse struct.

Compatible models include LLaVA, Qwen-VL, InternVL, or any cloud vision API that accepts image inputs and returns structured JSON.

---

## Contributing

This project is actively developed by a team of collaborators. The .context directory at the repository root contains living project state files (architecture contracts, task boards, decision logs, session handoffs) that are tracked in version control. Update these files whenever you make structural changes.

Do not commit API keys, secret tokens, or .env files. The .gitignore is already configured to exclude these.

---

## License

This project is not yet licensed. All rights reserved by the contributors.
