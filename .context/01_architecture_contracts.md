# Architecture Contracts & System Diagrams

## Component Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BROWSER EXTENSION CLIENT                              │
│                                                                             │
│  ┌────────────────────────┐      ┌───────────────────────────────────────┐  │
│  │ Active Tab & DOM Extr. │  ──> │ Screen Capture & PII Filter           │  │
│  │ (content/extractor.ts) │      │ (services/privacyFilter.ts)           │  │
│  └────────────────────────┘      └───────────────────────────────────────┘  │
│               │                                      │                      │
│               │                                      ▼                      │
│               │                         ┌───────────────────────────┐       │
│               │                         │ Rust WASM Redactor        │       │
│               │                         │ (wasm-redactor / WASM)    │       │
│               │                         └───────────────────────────┘       │
│               │                                      │ (Sanitized Base64)   │
│               ▼                                      ▼                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Background Service Worker (background/serviceWorker.ts)               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ POST /api/v1/analyze
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GO REASONING SERVER BACKEND                          │
│                                                                             │
│  ┌────────────────────────┐      ┌───────────────────────────────────────┐  │
│  │ HTTP REST Ingestion    │  ──> │ VLM Perception & Layout Reasoner      │  │
│  │ (server-backend/main)  │      │ (processVLMReasoning Engine)          │  │
│  └────────────────────────┘      └───────────────────────────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ Action JSON Payload
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Execution Dispatcher -> Injected Synthetic Click/Type Event                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Schemas

### Ingestion Payload (`POST /api/v1/analyze`)
```json
{
  "user_goal": "Click submit button",
  "sanitized_image": "data:image/png;base64,iVBORw0KG...",
  "viewport": {
    "width": 1280,
    "height": 800,
    "devicePixelRatio": 1.0
  },
  "dom_elements": [
    {
      "id": "elem_1",
      "tag": "button",
      "selector": "#submit-btn",
      "text": "Submit Form",
      "bounds": { "x": 500, "y": 400, "width": 120, "height": 40 },
      "isInteractive": true,
      "isSensitive": false
    }
  ]
}
```

### Action Payload (`Response HTTP 200`)
```json
{
  "action": "click",
  "selector": "#submit-btn",
  "coordinates": [560, 420],
  "text": "",
  "confidence": 0.95,
  "reasoning": "Identified target submit button at center coordinates.",
  "latency_ms": 8
}
```
