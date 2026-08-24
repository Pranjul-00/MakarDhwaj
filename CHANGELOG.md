# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Initial Development Phase

### Added
- **Core Vision Agent**: Initialized privacy-preserving on-device vision agent prototype.
- **Browser Extension**: Built the client-side browser extension with Manifest V3 compatibility, supporting Chrome and Firefox-based browsers (Gecko/Zen). Added toolbar icons and keyboard shortcuts.
- **Popup UI Dashboard**: Created a React 19 + Tailwind popup with a minimalist, high-contrast "Red and Black" theme. Includes a high-res image modal, "Copy Logs" button, and expandable execution telemetry.
- **On-Device Privacy Filters (Rust/WASM)**: Implemented highly optimized redaction algorithms (true optical Gaussian blur, multi-block pixelation, and solid blackout) using a Rust WebAssembly crate. This redacts sensitive PII directly in memory before any data leaves the device.
- **Backend Reasoning Server**: Built a Go HTTP backend with an ingestion endpoint (`/api/v1/analyze`) to receive sanitized images and DOM metadata, returning actionable UI commands.
- **Interactive Test Playground**: Added an isolated `/test` environment (served directly by the Go backend on port 8080) for safely testing the agent's extraction and clicking capabilities.
- **Telemetry & Logging**: Added detailed background worker telemetry logging and a cross-browser fallback method for screen capture.
- **CI/CD & Governance**: Set up GitHub Actions for automated testing (gofmt, clippy). Added `AGENTS.md` for AI contribution rules and a `.context/` system for tracking session handoffs, bugs, and task dependencies.

### Changed
- **DOM Extractor Architecture**: Upgraded the content script extractor to support a full pointer/mouse event cascade, form submission tracking, and visual target highlighting.
- **WASM Build Pipeline**: Updated WASM URL resolution in Vite to securely load via `chrome.runtime.getURL` and added TypeScript type declarations.

### Fixed
- **Firefox Xray Vision Bypass**: Fixed a critical security boundary issue in Firefox by injecting scripts directly into the main-world DOM, allowing the extension to correctly invoke native page scripts.
- **Synthetic Click Propagation**: Resolved issues where synthetic clicks failed to trigger `wrappedJSObject` handlers and form submission banners (with ongoing investigation for Zen Browser specifics).
- **Playground Event Handling**: Switched to DOM Level 3 capturing listeners in the test playground for more accurate interaction simulation.
- **Code Quality**: Fixed `clippy` checked division lints and applied `gofmt` across the backend.
