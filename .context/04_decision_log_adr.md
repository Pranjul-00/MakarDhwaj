# Architectural Decision Records (ADR Log)

## Decision Log

### ADR 001: Rust WebAssembly Offloading for Image Redaction
- **Status:** Accepted & Implemented
- **Context:** Sanitizing full-resolution viewport screenshots (e.g. 1920x1080 RGBA buffers) in pure JavaScript causes main-thread frame drops and browser UI latency.
- **Decision:** Compile a high-performance Rust crate (`wasm-redactor`) to WebAssembly (`wasm32-unknown-unknown`) using `wasm-pack`. Pixel manipulation occurs directly in WASM linear memory.
- **Consequences:** Near-zero processing latency (<15ms per frame) and zero UI thread freeze.

### ADR 002: Dual DOM Structural Metadata + Sanitized Visual Payload Pipeline
- **Status:** Accepted & Implemented
- **Context:** Vision-Language Models perform significantly better at web automation when provided with both visual context and structural DOM element coordinates.
- **Decision:** Extract interactive DOM bounding boxes alongside sanitized base64 visual frames. Unsanitized text input values (passwords, credit cards) are redacted locally before transmission.
- **Consequences:** Backend receives layout metadata without risk of PII data leak.

### ADR 003: Version Control Inclusion of `.context/` Directory
- **Status:** Accepted & Implemented
- **Context:** Project involves 5-6 collaborators requiring synchronized project architecture state and task dependency tracking.
- **Decision:** Do NOT place `.context/` in `.gitignore`. Commit `.context/` state files directly to Git tracking while guarding against API keys or secret leakage.
- **Consequences:** Seamless collaborator handoffs and zero context drift across sessions.
