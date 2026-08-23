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
- **Status:** Open for investigation.
- **Next Steps:** Evaluate `chrome.debugger` API, `browser.tabs.executeScript({ code: "document.querySelector('...').click()" })`, or dedicated pointer event injection.
