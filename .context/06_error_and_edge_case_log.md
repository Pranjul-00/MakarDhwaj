# Error & Edge Case Debugging Ledger

## Debugging Ledger

### Issue 001: Chrome Content Script Unloaded / Disconnected Tab Context
- **Symptom:** `chrome.tabs.sendMessage` throws `Could not establish connection. Receiving end does not exist.` on freshly opened tabs prior to content script initialization.
- **Root Cause:** Content scripts are injected at `document_end`, but background service worker may attempt message dispatch immediately.
- **Fix:** Background worker wraps message dispatch in a try/catch block and dynamically injects `src/content/extractor.js` via `chrome.scripting.executeScript` before retrying message.

### Issue 002: Canvas Context 2D Memory Overflow on High DPI Display Screens
- **Symptom:** Display Scaling (e.g. 2x Retina / 4K displays) results in coordinate misalignment between CSS layout pixels and physical canvas pixels.
- **Root Cause:** Bounding client rects return CSS pixel dimensions, while canvas screen capture returns raw device pixel resolution.
- **Fix:** Multiply DOM bounding box dimensions by `window.devicePixelRatio` before passing to WASM redaction buffer.

### Issue 003: Zen / Firefox Gecko Synthetic Event Propagation
- **Symptom:** Extension dispatches `CLICK` action to button, visual highlight border flashes, but web page `handleSubmit` banner is not triggered in Zen Browser.
- **Root Cause:** The backend response and documented API use the `action` field, while the content executor checked a nonexistent `type` field. It then returned success even though no action branch ran.
- **Fix:** Validate and allowlist the response payload using the documented `action` field, invoke one native `HTMLElement.click()`, reject unsupported actions, and remove test-page-specific success hooks and duplicate submit events.
- **Status:** Fix implemented on `fix/action-contract-zen`; manual Zen validation pending.

### Issue 004: High-Severity Transitive `sharp` Advisory
- **Symptom:** `npm audit` reports two high-severity findings: `sharp <0.35.0` and its direct parent `@huggingface/transformers`.
- **Root Cause:** The locked `@huggingface/transformers` dependency resolves `sharp@0.34.5`, affected by inherited libvips advisories grouped under `GHSA-f88m-g3jw-g9cj`.
- **Status:** Open; npm reports no automatic fix. No audit gate is enabled while the locked dependency has no compatible fixed resolution.
- **Next Steps:** Track an upstream `@huggingface/transformers` resolution using `sharp >=0.35.0`; verify browser bundle exposure before upgrading on a dedicated dependency branch.
