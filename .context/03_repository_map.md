# Repository Map

## Directory Structure & Module Descriptions
- `.context/`: Living state memory matrix tracked in Git
  - `00_project_manifest.md`: Vision, project goals, KPIs, non-negotiable domain rules
  - `01_architecture_contracts.md`: System diagrams, sequence models, REST payload schemas
  - `02_tech_stack_and_env.md`: Runtime configurations, package manager setups, `.env` schema
  - `03_repository_map.md`: Living file tree with module descriptions
  - `04_decision_log_adr.md`: Architectural Decision Records (ADRs)
  - `05_task_dependency_board.md`: Epic tasks, completion status, dependency graph
  - `06_error_and_edge_case_log.md`: Debugging ledger and edge-case regression guardrails
  - `07_session_handoff.md`: Cross-session memory snapshot and next immediate steps
- `client-extension/`: Chrome Extension client codebase (React 19 + Vite 6 + WASM + WebGPU/Transformers)
  - `manifest.json`: Manifest V3 extension configuration
  - `vite.config.ts`: Multi-entry build configuration
  - `package.json`: Node dependencies & build scripts
  - `wasm-redactor/`: Rust WebAssembly crate (`src/lib.rs` pixel redaction engine)
  - `src/background/serviceWorker.ts`: Viewport screen capture, event loop coordinator, API client
  - `src/content/extractor.ts`: DOM bounding box extraction and synthetic event dispatcher
  - `src/services/privacyFilter.ts`: PII detection & WASM canvas pixel redaction module
  - `src/popup/`: React 19 control panel UI (App.tsx, main.tsx, index.css)
  - `dist/`: Production extension bundle output
- `server-backend/`: Go Vision-Language Model reasoning engine
  - `go.mod`: Go module manifest
  - `main.go`: Concurrent REST server listening on `:8080` (`/api/v1/analyze`, `/health`)
  - `vlm-server`: Executable compiled binary
