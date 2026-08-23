# Unified Task Matrix & Execution Board

## Phase 1: Context & Repository Scaffolding
- [x] **Task 1.1:** Scaffold `/client-extension` (React 19 + Vite + TypeScript) and `/server-backend` (Go REST engine).
- [x] **Task 1.2:** Implement `.gitignore` configured to track `.context/` memory matrix while ignoring build targets and secrets.
- [x] **Task 1.3:** Compile Rust WASM module (`wasm-redactor`) and integrate with Vite build script.
- [x] **Task 1.4:** Document initial component contracts and API schemas in `.context/01_architecture_contracts.md`.

## Phase 2: Client Screen Capture & State Extraction
- [x] **Task 2.1:** Configure Manifest V3 permissions (`activeTab`, `scripting`, `storage`).
- [x] **Task 2.2:** Build background service worker viewport screen capture pipeline.
- [x] **Task 2.3:** Build content script DOM tree extractor capturing interactive bounding rects while omitting raw PII text values.

## Phase 3: Privacy-Preserving Filter (Local Vision Processing)
- [x] **Task 3.1:** Implement dynamic PII bounding box detection for sensitive inputs (passwords, credit cards, emails, SSNs).
- [x] **Task 3.2:** Build multi-mode WASM redaction filter engine (solid blackout, pixelation, semantic blur).
- [x] **Task 3.3:** Add automatic JavaScript canvas fallback for zero-downtime execution.

## Phase 4: Server Integration & Action Loop
- [x] **Task 4.1:** Implement Go backend ingestion endpoint (`/api/v1/analyze`) with CORS headers and payload decoder.
- [x] **Task 4.2:** Build VLM perception reasoning engine returning standardized action JSON (`click`, `type`, `scroll`).
- [x] **Task 4.3:** Implement client-side DOM action dispatcher executing synthetic browser events on active web pages.
- [x] **Task 4.4:** Build React 19 popup UI panel with flat Red & Black theme, high-res image modal, and Copy Logs ledger.
- [ ] **Task 4.5:** Resolve Zen Browser Gecko synthetic click propagation on form submit buttons.
