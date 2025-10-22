# Agents & Prompts

This document is designed to be read by LLMs and humans.

## Overall Pattern

We follow **Vercel AI SDK 5** agentic practices:
- Deterministic task definitions with clear JSON outputs
- Tool calling for data/IO
- Loop control from the coordinator layer (limit steps, escalate only when needed)

## Coordinator

Input: repository info + extracted files  
Actions:
1. Build AST chunks (ts-morph)
2. Run heuristics
3. Prepare context (summary + samples)
4. Call each agent with its dedicated prompt
5. Merge + deduplicate issues
6. Generate codemod plans

Stop condition: All agents complete once. Production deployments can add loops to converge on top issues or to expand context adaptively.

## Agent Contracts

Agents MUST output a JSON array of objects with `{title, description, recommendation}` plus optional fields.

### UI/UX Agent
Focus: Accessibility, SSR/CSR balance, skeletons, link targets, focus management, route transitions.

### Backend Agent
Focus: Route handlers, cache/revalidate, streaming/suspense, runtime (edge/node), error boundaries.

### DB Agent
Focus: Prisma schema, indexes, connection pooling, vector search (`pgvector`).

### Security Agent
Focus: XSS, CSRF, SSRF, CSP, cookie flags, stale dependencies, secret leakage.

### Performance Agent
Focus: Bundle size, hydration cost, memoization, virtualization, image optimization.

### Lint Agent
Focus: Modern React/TypeScript practices, App Router idioms, anti‑patterns.

### Codemod Agent
Focus: Non‑destructive transforms. Prefer **jscodeshift** or **ts-morph**. Include guards and commands:

```
npx jscodeshift -t transforms/fix-dangerous-html.ts src
```

## Context7

When available, agents may request up‑to‑date documentation snippets via the Context7 MCP server to ground recommendations. The **Docs Agent** consolidates and deduplicates references before attaching them to issues.
