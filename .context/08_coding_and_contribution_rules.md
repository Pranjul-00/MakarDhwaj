# Coding & Contribution Rules

## Authority

Mandatory contract for every human contributor and AI coding agent.

- **MUST / MUST NOT:** Merge-blocking requirement.
- **SHOULD / SHOULD NOT:** Default; explain exceptions in pull request.
- **MAY:** Optional.

Priority:

1. Privacy and security rules in `00_project_manifest.md`
2. Explicit project-owner instructions preserving those invariants
3. Architecture and API contracts in `01_architecture_contracts.md`
4. This contract
5. Tool and language conventions

Agents MUST stop and ask when instructions conflict. Privacy invariants may change only through an explicit project decision and ADR, never as a feature side effect.

## AI Workflow

Before editing, agents MUST:

1. Read every `.context/*.md` file in numeric order.
2. Inspect `git status`, current branch, relevant code, configuration, and tests.
3. Create or use one task-specific branch; never edit directly on `main`.
4. Preserve all unrelated and pre-existing contributor work.

During work, agents MUST:

- Limit changes to requested scope.
- Prefer smallest coherent solution; avoid speculative abstractions.
- Never fabricate APIs, files, test results, benchmarks, or completion claims.
- Never overwrite, revert, delete, or broadly reformat unrelated work.
- Never expose secrets or sensitive payloads in tools, logs, fixtures, screenshots, comments, or chat.
- Ask before changing dependencies, permissions, endpoints, schemas, privacy behavior, security boundaries, or architecture.
- Ask when ambiguity could affect privacy, user data, architecture, or substantial existing work.

After editing, agents MUST:

1. Review full diff.
2. Run relevant available verification gates.
3. Report changed files, checks, failures, skipped checks, and risks truthfully.
4. Update `.context/` when implementation reality changed.

AI-generated code receives no trust exemption.

## Git Workflow

### Protected `main`

- MUST NOT edit, commit, push, force-push, rewrite, or delete `main`.
- Every change MUST reach `main` through a pull request.
- Relevant checks MUST pass before merge.
- Review conversations MUST be resolved before merge.
- At least one approval SHOULD be required; urgent exceptions need project-owner approval.
- GitHub branch protection SHOULD enforce PR-only merges, checks, and blocked force pushes.
- AI agents MUST receive explicit authorization before any push, PR creation, merge, or other remote mutation.

### Task branches

Every feature, fix, refactor, test, documentation change, experiment, or maintenance task MUST use one short-lived branch created from current `main`.

```text
feature/local-face-redaction
fix/gecko-submit-click
refactor/vlm-transport-layer
test/pii-leakage-suite
docs/coding-rules
chore/add-ci
```

- One branch contains one coherent change.
- Long-lived personal branches MUST NOT replace task branches.
- Unrelated work uses another branch.
- Conflicts are resolved on task branch, never on `main`.
- Shared or dirty worktrees MUST NOT be cleaned by discarding contributor work.
- Merged branches SHOULD be deleted.

### Commits and pull requests

- Commits MUST be focused; Conventional Commit subjects SHOULD be used: `feat`, `fix`, `test`, `docs`, `refactor`, or `chore`.
- Commits MUST NOT contain secrets, `.env` files, generated bundles, compiled binaries, or unrelated edits.
- Shared published history MUST NOT be rewritten without coordination.
- Pull requests MUST explain problem, approach, privacy impact, tests, performance impact, remaining risks, and context changes.
- UI changes SHOULD include visual evidence.
- Squash merge SHOULD be used for a clean task-level history.

## Privacy and Security

Privacy failures are release blockers.

- Unsanitized screenshots, raw image buffers, PII, sensitive input values, passwords, tokens, cookies, and sensitive DOM content MUST NEVER cross a network boundary.
- Sanitization MUST finish successfully before network code can access a payload.
- Detection, model, WASM, canvas, encoding, or sanitization failure MUST block transmission.
- A fallback is allowed only when it provides equal or stronger privacy.
- Screenshots and sensitive payloads MUST NOT enter logs, analytics, crash reports, persistent storage, fixtures, source control, or `.context/`.
- Tests MUST use synthetic PII, never real personal data.
- Secrets MUST use ignored environment configuration.
- New telemetry, third-party services, model providers, endpoints, permissions, or remote resources require project-owner approval and documented privacy review.
- Extension permissions MUST remain least-privilege.
- DOM selectors, messages, model output, server responses, and actions are untrusted input.
- Actions MUST use an allowlist; reject unknown actions.
- Remote scripts, `eval`, and equivalent dynamic code execution are forbidden.

Suspected leakage stops feature work. Block transmission, record issue in `06_error_and_edge_case_log.md`, add regression coverage, then fix.

## Architecture Boundaries

- Content scripts: DOM structure extraction and page action dispatch.
- Privacy services: sensitive-region detection and sanitization orchestration.
- Rust WASM, WebWorkers, or WebGPU: heavy pixel/model work.
- Background service worker: capture, sanitized transport, and action coordination.
- React popup: presentation and user interaction only.
- Go handlers: transport; reasoning logic remains independently testable.
- Network code accepts sanitized artifacts only. Raw and sanitized states SHOULD use distinct types.
- Cross-boundary data MUST be typed, runtime-validated, privacy-classified, and synchronized across contracts.
- Heavy processing MUST NOT block browser UI thread.
- Architecture changes require an ADR in `04_decision_log_adr.md`.

## Language Rules

### TypeScript, React, browser extension

- Keep TypeScript strict mode enabled.
- Avoid `any`, non-null assertions, and unchecked casts; explain necessary exceptions.
- Validate DOM, message, storage, network, and model data at runtime.
- Handle browser API failures and rejected promises explicitly.
- Clean up listeners, timers, workers, object URLs, and resources.
- Isolate and document Chrome versus Firefox/Zen behavior.
- Keep React rendering side-effect free; business/privacy logic belongs in services.
- Preserve accessibility, keyboard behavior, focus, labels, and contrast.
- Distinguish CSS pixels from device pixels explicitly.

### Rust and WebAssembly

- Validate buffers, dimensions, coordinates, bounds, and arithmetic overflow.
- Untrusted input MUST NOT panic; avoid `unwrap()` and `expect()` on runtime paths.
- Unsafe Rust requires unavoidable need, narrow scope, documentation, and review.
- Clip regions safely; handle empty, zero-size, overlapping, malformed, and high-DPI cases.
- WASM errors MUST be explicit and privacy-safe.
- Algorithm changes require focused tests; performance claims require benchmarks.

### Go server

- Format with `gofmt`.
- Set HTTP read, write, idle, and header timeouts.
- Limit request bodies before decoding; validate requests before reasoning.
- Return stable JSON errors without secrets or sensitive payloads.
- Never log images, full DOM payloads, authorization values, API keys, or PII.
- Keep CORS as narrow as supported extension behavior permits.
- Validate, confidence-check, and allowlist reasoning output.
- Keep transport, reasoning, configuration, and providers separate.
- Protect concurrent state and test it when introduced.

## Dependencies and Configuration

- Runtime dependency additions/removals require project-owner approval.
- Prefer existing dependencies and platform APIs when safe.
- Dependencies need clear purpose, maintained source, compatible license, and acceptable footprint.
- Commit package-manager lockfiles; never commit generated bundles or binaries.
- Use dedicated branches and checks for dependency upgrades.
- Keep `.context/02_tech_stack_and_env.md` aligned with repository configuration.
- Document environment variable names only; never real secret values.

## Verification Gates

Run checks relevant to changed areas. Never hide failures by weakening checks.

```bash
cd client-extension
npm run build

cd client-extension/wasm-redactor
cargo fmt --check
cargo clippy -- -D warnings
cargo test

cd server-backend
gofmt -l .
go vet ./...
go test ./...
```

`gofmt -l .` passes only with no output. Client lint/test commands do not currently exist; agents MUST NOT claim they passed.

Relevant work MUST verify applicable risks: synthetic PII recall/precision, redaction boundaries, fail-closed transmission, Chrome and Firefox/Zen behavior, high-DPI coordinates, malformed/oversized input, navigation races, missing scripts, and model/WASM failure.

Benchmarks MUST record hardware, browser, build mode, input size, sample count, metric, and result. Estimates MUST NOT be stated as measured facts.

## Definition of Done

Work is complete only when:

- Requested behavior works without unrelated scope.
- Privacy and architecture invariants hold.
- Relevant checks and manual browser verification pass.
- Important new behavior and failure paths have coverage where tooling exists.
- Diagnostics remain useful and non-sensitive.
- KPI and performance claims have reproducible evidence.
- Documentation and `.context/` match actual implementation.
- Diff review finds no unresolved critical issue.
- Branch and pull-request rules are satisfied.

Skipped checks MUST be reported with reason, risk, and exact follow-up.

## Context Maintenance

- `.context/` remains tracked and describes verified current reality.
- Completed tasks and KPI claims require evidence.
- Decisions go to `04_decision_log_adr.md`.
- Failures and regressions go to `06_error_and_edge_case_log.md`.
- End-of-session state goes to `07_session_handoff.md`.
- Secrets, real PII, credentials, and screenshots never enter `.context/`.

## Stop and Ask

AI agents require explicit direction before:

- Any push, PR creation/merge, or remote mutation.
- Dependency changes.
- Permission, endpoint, telemetry, authentication, CORS, schema, stored-data, privacy, redaction, or action-capability changes.
- Destructive operations, material deletion, history rewriting, or discarding uncommitted work.
- Broad redesign outside requested scope.
- Any use of real user data in tests, demonstrations, debugging, or evaluation.

When uncertain: preserve data, preserve privacy, keep scope narrow, ask.
