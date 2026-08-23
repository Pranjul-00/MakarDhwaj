# Project Manifest & Mission Objectives

## Core Mission
Build a privacy-preserving, on-device visual perception browser agent. The agent performs hardware-accelerated local inference (WebGPU / WASM) directly inside a browser extension to detect and redact Personally Identifiable Information (PII) before transmitting sanitized visual context to a server-side Vision-Language Model (VLM) reasoning engine.

## Acceptance Criteria & KPIs
- [x] **Privacy Redaction (20%):** Zero PII leakage (passwords, emails, phone numbers, SSNs, credit card numbers) using dynamic WASM/WebGPU image filtering.
- [x] **VLM Perception & Layout Accuracy (25%):** Server reasoning engine accurately interprets sanitized page layout and DOM metadata.
- [x] **Redaction Boundary Precision (20%):** Clean, localized masking without censoring critical UI action targets.
- [x] **Resource Overhead (20%):** Fluid main thread; offloading image processing to Rust WebAssembly.
- [x] **End-to-End Latency (15%):** Fast local transformation (<15ms) and low backend payload latency.

## Non-Negotiable Domain Rules
- **Rule 1 (Zero Local PII Leakage):** Unsanitized screenshots MUST NEVER be transmitted over network sockets or HTTP APIs.
- **Rule 2 (No Main Thread Deadlocks):** Heavy pixel operations MUST run inside WASM memory or WebWorkers/WebGPU buffers.
- **Rule 3 (Collaborator Tracked Context):** The `.context` matrix MUST NOT be gitignored and MUST be tracked in git for team collaboration.
- **Rule 4 (Strict Git Push Permission):** No git pushes to remote repositories without explicit user authorization.
