# AI Contributor Entry Point

These instructions apply to every AI coding agent working anywhere in this repository.

Before inspecting, planning, or changing project code, read every Markdown file in `.context/` in numeric order. Treat `.context/08_coding_and_contribution_rules.md` as the mandatory contribution contract and follow all `MUST` and `MUST NOT` rules.

Minimum operating rules:

- Preserve the privacy boundary: unsanitized screenshots, PII, secrets, and sensitive DOM data never leave the client and never enter logs or source control.
- Fail closed when sanitization or privacy validation fails.
- Inspect relevant code, `git status`, and current branch before editing.
- Create or use one short-lived task branch before editing; never edit, commit, or push directly on `main`.
- Never push any branch, open a pull request, merge, or alter remote state without explicit user authorization.
- Preserve unrelated and pre-existing contributor changes.
- Do not add dependencies or change permissions, endpoints, schemas, privacy behavior, or security boundaries without explicit approval.
- Run relevant verification gates and report results truthfully. Never invent passing tests, benchmarks, or completion claims.
- Update relevant `.context/` files when implementation reality changes.
- Stop and ask when ambiguity could affect privacy, architecture, user data, or substantial existing work.

If any short instruction conflicts with `.context/08_coding_and_contribution_rules.md`, follow the stricter safe rule and ask the user when needed.
