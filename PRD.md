# Product Requirements Document (PRD) – Next.js Audit

## 1. Objective

Build an AI‑powered auditor for large Next.js App Router repositories that surfaces security vulnerabilities, performance issues, and bad practices, with codemod suggestions. Integrate with ChatGPT Apps SDK via MCP and render results with widgets.

## 2. Users

- **Staff engineers / tech leads** running periodic audits
- **Security and performance teams** enforcing standards
- **IC engineers** wanting pointed, fix‑ready recommendations

## 3. Key Features

1. **Repo ingestion (READ)** via GitHub tarballs with optional auth
2. **Code understanding**: AST chunking, heuristics, semantic embeddings
3. **Multi‑agent analysis** with typed outputs and LLMs via AI Gateway
4. **Codemod suggestions** with safe transforms
5. **Reports**: JSON export + ChatGPT inline widget
6. **Observability**: traces via Langfuse (OpenTelemetry)
7. **Scalability**: stateless web tier, Postgres for state

## 4. Non‑Goals

- Automatic code rewrites in the default flow (write can be enabled explicitly)
- Full SCA (dependency CVE) scanning – out of scope of this MVP

## 5. Architecture

- **Frontend**: Next.js App Router, Tailwind, minimal shadcn‑style components.
- **Server**: Edge for chat streaming; Node for GitHub + ts-morph; AI SDK 5.
- **MCP Server**: TypeScript SDK, Express + Streamable HTTP transport.
- **Persistence**: Prisma + Postgres (`Repo`, `Scan`, `Issue`).
- **Embeddings**: OpenAI via Vercel AI Gateway. Optional `pgvector` store.

## 6. Performance & Scale

- Limit tarball size (100MB default), ignore heavy folders (`node_modules`, `.next`, `dist`).
- Concurrency with p‑limit for agent fan‑out.
- Cache embeddings and agent outputs per commit SHA (future rev).

## 7. Security

- Read‑only default. All write operations behind `ALLOW_WRITE=true`.
- Secret handling via environment variables only.
- Prompt‑injection mitigations: instruction anchoring and minimal context exposure.

## 8. Telemetry

- Optional Langfuse tracing via OpenTelemetry exporter.
- Track cost, latency, error rates per agent and per scan.

## 9. Acceptance Criteria

- Run locally; scan a public repo; return a JSON report with at least 10 issues.
- MCP server callable from ChatGPT Apps SDK; widget renders report.
- Works against Next.js core repo (subset due to size guard).
