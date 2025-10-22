# Security Notes

- Default mode is **read‑only**. The app fetches repository tarballs; no scripts are executed.
- Avoid scanning untrusted, massive repos without size caps.
- LLM prompts are grounded and minimal to reduce injection risk. Never pass untrusted code directly as instructions.
- If enabling write actions (PRs), use a separate GitHub App with **least privilege** (contents:write only for selected repos). Prefer opening PRs on forks.
- Log redaction: Do not persist access tokens. Pass them via headers only.
