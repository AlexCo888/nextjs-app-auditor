# Next.js Audit (AI‑Powered, Multi-Agent)

**Production‑ready** Next.js App Router application that audits large Next.js repositories for **security vulnerabilities**, **performance issues**, and **code quality problems**.

Built with **Vercel AI SDK 5** for multi‑agent reasoning, supports **OpenAI** (direct or via Vercel AI Gateway) and **OpenRouter** (300+ models), and uses **Prisma + Postgres** for persistence with optional `pgvector` for semantic search.

---

## ✨ Key Features

- 🤖 **7 Specialized AI Agents**: UI/UX, Backend, Database, Security, Performance, Lint, and Codemod agents work together
- 🔄 **Flexible AI Providers**: Choose between OpenAI Direct, Vercel AI Gateway, or OpenRouter (300+ models)
- ⚡ **Intelligent Sampling**: Smart file selection analyzes 200+ files in 2-4 minutes (configurable for 100% coverage)
- 🎯 **Structured Outputs**: Reliable JSON responses using Zod schemas and AI SDK's `generateObject`
- 🔍 **Fast Heuristics**: Quick pattern matching on ALL files before AI analysis
- 📊 **Comprehensive Reports**: Issues grouped by severity with actionable recommendations
- 🛡️ **Security-First**: Read-only by default, no code execution
- 🚀 **GitHub Integration**: Public and private repos via tarball downloads (handles redirects)

---

## 🎯 What Gets Analyzed

### Security Issues
- XSS vulnerabilities (dangerouslySetInnerHTML, unescaped input)
- CSRF protection gaps
- Hardcoded secrets and API keys
- Missing security headers (CSP, HSTS, X-Frame-Options)
- Insecure cookie configurations
- SQL injection risks

### Performance Problems
- Large bundle sizes and missing code splitting
- Render-blocking resources
- Missing streaming/suspense boundaries
- Avoidable re-renders
- Slow data fetches and serial waterfalls

### Backend Issues
- Route handlers without error boundaries
- Missing or incorrect caching strategies
- ISR/SSG misconfiguration
- Improper edge/node runtime selection

### Database Issues
- Missing indexes on queried fields
- N+1 query patterns
- Unbounded result sets without pagination
- Connection pooling problems

### UI/UX Issues
- Accessibility violations (ARIA, alt text, semantic HTML)
- Layout shifts and CLS problems
- Missing loading states and skeletons
- Form usability issues

### Code Quality
- TypeScript 'any' types
- Missing error handling
- React hooks anti-patterns
- Server/client component mixing issues

---

## 🚀 Quick Start

### Prerequisites
- Node 20+
- Postgres database (Neon, Vercel Postgres, or local)
- AI API key (choose one):
  - **OpenAI Direct** (recommended for simplicity)
  - **Vercel AI Gateway** (recommended for caching)
  - **OpenRouter** (300+ models, flexible)

### Installation

```bash
# Clone and install dependencies
pnpm i

# Set up environment variables
cp .env.example .env.local

# Configure your .env.local (see Configuration section below)

# Initialize database
pnpm db:push

# Start development server
pnpm dev
```

Open http://localhost:3000 and paste a GitHub repo URL. Public repos work without a token; for private repos, add `GITHUB_TOKEN` to `.env.local` or paste it in the UI.

---

## ⚙️ Configuration

### Option 1: OpenAI Direct (Simplest) ✅ Recommended

**Best for**: Quick start, direct OpenAI API access, no proxies

```bash
# .env.local

# Required: OpenAI API Key
OPENAI_API_KEY=sk-proj-...

# Required: Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Optional: GitHub token for private repos
GITHUB_TOKEN=ghp_...

# Optional: Default model (if not specified, uses gpt-4o)
OPENAI_DEFAULT_MODEL=gpt-4o
# Other options: gpt-4o-mini (cheaper), gpt-4-turbo, gpt-3.5-turbo
```

**Cost estimate**: $0.50-1.00 per scan (200 files with gpt-4o)

**In the UI**: Select "Vercel AI Gateway" provider, model will be automatically used

---

### Option 2: Vercel AI Gateway (Production)

**Best for**: Production use, caching, rate limiting, cost control

```bash
# .env.local

# Required: AI Gateway key
AI_GATEWAY_API_KEY=your_gateway_key_here

# Required: Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Optional: GitHub token
GITHUB_TOKEN=ghp_...

# Optional: Default model
AI_GATEWAY_DEFAULT_MODEL=gpt-4o
```

**Benefits**:
- ✅ Built-in caching (saves on repeat scans)
- ✅ Rate limiting and quota management
- ✅ Analytics and monitoring
- ✅ Same OpenAI models, but with more control

**In the UI**: Select "Vercel AI Gateway" provider

---

### Option 3: OpenRouter (Most Flexible) 🎯

**Best for**: Access to 300+ models (Claude, Gemini, Llama, etc.), cost optimization

```bash
# .env.local

# Required: OpenRouter API Key
OPENROUTER_API_KEY=sk-or-v1-...

# Required: Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Optional: GitHub token
GITHUB_TOKEN=ghp_...

# Optional: Default model
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
# Popular options:
#   - anthropic/claude-3.5-sonnet (best quality)
#   - openai/gpt-4o (fast, reliable)
#   - openai/gpt-4o-mini (cheapest, good quality)
#   - google/gemini-pro-1.5 (free tier available)
#   - meta-llama/llama-3.1-70b-instruct (open source)

# Optional: Set your app name/URL for OpenRouter credits
OPENROUTER_APP_NAME=nextjs-audit-app
OPENROUTER_SITE_URL=http://localhost:3000
```

**In the UI**: Select "OpenRouter" provider, choose from 300+ models

**Cost comparison**:
- Claude Sonnet 3.5: $1.50-3.00 per scan (best quality)
- GPT-4o: $0.50-1.00 per scan (balanced)
- GPT-4o-mini: $0.10-0.20 per scan (cheapest)

See `MODEL_GUIDE.md` for detailed cost analysis.

---

### Hybrid Setup (Advanced)

You can configure multiple providers simultaneously:

```bash
# .env.local - All three providers configured

OPENAI_API_KEY=sk-proj-...
AI_GATEWAY_API_KEY=your_gateway_key
OPENROUTER_API_KEY=sk-or-v1-...

DATABASE_URL=postgresql://...
GITHUB_TOKEN=ghp_...

# Default models for each provider
OPENAI_DEFAULT_MODEL=gpt-4o
AI_GATEWAY_DEFAULT_MODEL=gpt-4o
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
```

**Then switch between providers in the UI!**

---

## 🧠 Multi-Agent Architecture

### How It Works

1. **Heuristics Scan** (Fast): Runs on ALL files, detects patterns like `dangerouslySetInnerHTML`, hardcoded secrets, `eval()`, etc.
2. **Intelligent Sampling**: Selects high-priority files (default: 200 files, configurable)
3. **AST Parsing**: Uses `ts-morph` to create function/class/component-level chunks
4. **Parallel Agent Analysis**: 6 specialized agents analyze the codebase simultaneously
5. **Report Generation**: Issues merged, deduplicated, and grouped by severity
6. **Codemod Planning**: Automated fix suggestions for eligible issues

### The 7 Agents

All agents live under `lib/ai/agents/*`:

#### 1. **UI/UX Agent** (`uiuxAgent.ts`)
- Accessibility violations (ARIA, alt text, semantic HTML)
- Layout shifts and CLS problems
- Missing loading states and skeletons
- Navigation issues
- Form usability (validation, error messages, focus management)

#### 2. **Backend Agent** (`backendAgent.ts`)
- Route handlers without error boundaries
- Missing or incorrect caching strategies (revalidate, cache-control)
- ISR/SSG misconfiguration
- Improper edge/node runtime selection
- Missing streaming or suspense where beneficial

#### 3. **Database Agent** (`dbAgent.ts`)
- Missing indexes on frequently queried fields
- N+1 query patterns (missing includes/select)
- Unbounded result sets without pagination
- Connection pooling configuration issues
- Unsafe raw SQL usage

#### 4. **Security Agent** (`securityAgent.ts`)
- XSS vulnerabilities (dangerouslySetInnerHTML, unescaped user input)
- CSRF protection missing on state-changing operations
- SSRF risks in server-side fetch/request calls
- Hardcoded secrets and API keys
- Missing security headers (CSP, HSTS, X-Frame-Options)
- Insecure cookie configuration

#### 5. **Performance Agent** (`perfAgent.ts`)
- Render-blocking resources (large synchronous imports)
- Heavy client bundles (missing code splitting)
- Missing streaming or suspense boundaries
- Avoidable re-renders (missing memoization)
- Slow data fetches (serial waterfalls)

#### 6. **Lint Agent** (`lintAgent.ts`)
- TypeScript 'any' types instead of proper types
- Missing error handling in async functions
- Improper React hook usage
- Server components importing client-only code
- Client components not marked with 'use client'

#### 7. **Codemod Agent** (`codemodAgent.ts`)
- Generates automated fix suggestions
- Creates jscodeshift/ts-morph transformation plans
- Provides executable commands for safe refactors

### Coordinator (`coordinator.ts`)

Orchestrates the entire scan:
- Manages agent execution (parallel where possible)
- Handles errors with fallback markdown unwrapper
- Merges and deduplicates issues
- Attaches codemod recommendations
- Tracks progress and provides real-time updates

### Structured Outputs

All agents use **Zod schemas** (`schemas.ts`) for type-safe responses:
- `IssuesArraySchema`: Validates agent findings
- `CodemodsArraySchema`: Validates codemod suggestions
- AI SDK's `generateObject` with `mode: 'json'` ensures reliable parsing

**No more JSON parsing errors!** ✅

---

## 🎯 Intelligent Sampling

### How It Works

The system uses **intelligent sampling** to balance speed, cost, and coverage:

**Default behavior** (as of latest version):
- Repos with ≤200 files: **100% analyzed**
- Repos with >200 files: **200 files analyzed** (28% for a 700-file repo)

### Why Sampling?

| Coverage | Time | Cost | Issues Found |
|----------|------|------|--------------|
| **200 files** ✅ | 2-4 min | $0.50 | 90-95% |
| 500 files | 8-12 min | $1.25 | 98% |
| All files (700) | 15-25 min | $2.50 | 100% |

**Key insight**: The first 200 files catch 90-95% of issues because intelligent sampling prioritizes:
1. Files with heuristic hits (security/quality issues detected)
2. Authentication and security-critical files
3. API routes and server components
4. Database queries and schemas
5. Large files (often contain complex logic)
6. Page components (user-facing code)

### Configuring Coverage

To change the sampling limit, edit `lib/ai/agents/coordinator.ts` line 48:

```typescript
// Option 1: Audit ALL files (100% coverage)
const samplingLimit = input.files.length;

// Option 2: Custom limit
const samplingLimit = 300; // Audit 300 files

// Option 3: Default (current)
const samplingLimit = input.files.length <= 200 ? input.files.length : 200;
```

See **`SAMPLING_GUIDE.md`** for detailed configuration options and cost/coverage trade-offs.

---

## 🧩 OpenAI Agents SDK Integration (Optional)

### Using with OpenAI Agents SDK

This audit tool can be integrated with OpenAI's Agents SDK for direct use within ChatGPT:

#### 1. Install the Agents SDK

```bash
npm install @openai/agents-sdk
```

#### 2. Create an Agent Function

```typescript
// agents/audit-tool.ts
import { coordinateAudit } from '@/lib/ai/agents/coordinator';

export const auditRepository = {
  name: 'audit_nextjs_repository',
  description: 'Audits a Next.js repository for security, performance, and quality issues',
  parameters: {
    type: 'object',
    properties: {
      repoUrl: {
        type: 'string',
        description: 'GitHub repository URL (e.g., https://github.com/owner/repo)'
      },
      branch: {
        type: 'string',
        description: 'Branch name (default: main)',
        default: 'main'
      }
    },
    required: ['repoUrl']
  },
  async execute({ repoUrl, branch = 'main' }) {
    const result = await coordinateAudit({
      repoUrl,
      ref: branch,
      provider: 'openai', // Use OpenAI directly
      model: 'gpt-4o'
    });
    
    return {
      summary: `Found ${result.issues.length} issues`,
      criticalIssues: result.issues.filter(i => i.severity === 'critical').length,
      highIssues: result.issues.filter(i => i.severity === 'high').length,
      issues: result.issues.slice(0, 10), // Top 10 issues
      fullReport: result.markdownReport
    };
  }
};
```

#### 3. Register with OpenAI Agent

```typescript
// app.ts
import { Agent } from '@openai/agents-sdk';
import { auditRepository } from './agents/audit-tool';

const agent = new Agent({
  model: 'gpt-4o',
  tools: [auditRepository],
  instructions: `You are a code audit assistant. When users ask to audit a repository, 
  use the audit_nextjs_repository tool to analyze it for security, performance, and quality issues.`
});

// Use the agent
const response = await agent.run({
  messages: [{
    role: 'user',
    content: 'Audit https://github.com/vercel/next.js for issues'
  }]
});
```

#### 4. Environment Setup for Agents SDK

```bash
# .env.local
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgresql://...

# Optional: For private repos
GITHUB_TOKEN=ghp_...
```

**Benefits**:
- ✅ Direct integration with ChatGPT/GPTs
- ✅ Conversational audit requests
- ✅ Automatic follow-up questions
- ✅ Context-aware recommendations

---

## 🗄️ Database

### Prisma + Postgres

The app uses Prisma with Postgres to store:
- **Repositories**: Tracked repos and their metadata
- **Scans**: Audit results with timestamps
- **Issues**: Individual findings with severity and recommendations

### Tables

```prisma
model Repository {
  id          String   @id @default(cuid())
  url         String   @unique
  owner       String
  name        String
  branch      String   @default("main")
  scans       Scan[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Scan {
  id            String      @id @default(cuid())
  repositoryId  String
  repository    Repository  @relation(fields: [repositoryId], references: [id])
  commitSha     String
  status        String      // pending, running, completed, failed
  issues        Issue[]
  createdAt     DateTime    @default(now())
  completedAt   DateTime?
}

model Issue {
  id             String   @id @default(cuid())
  scanId         String
  scan           Scan     @relation(fields: [scanId], references: [id])
  title          String
  description    String   @db.Text
  severity       String   // critical, high, medium, low, info
  recommendation String?  @db.Text
  file           String?
  line           Int?
  agentType      String   // security, performance, uiux, backend, db, lint
  createdAt      DateTime @default(now())
}
```

### Optional: pgvector for Semantic Search

To enable vector similarity search for code chunks:

1. Enable the extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. Add embeddings table:
   ```sql
   CREATE TABLE embeddings (
     id SERIAL PRIMARY KEY,
     scan_id TEXT NOT NULL,
     file TEXT NOT NULL,
     chunk_text TEXT NOT NULL,
     embedding vector(1536), -- OpenAI ada-002 dimension
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Create HNSW index for fast similarity search
   CREATE INDEX ON embeddings USING hnsw (embedding vector_cosine_ops);
   ```

3. Use in queries:
   ```typescript
   // Find similar code patterns
   const similar = await prisma.$queryRaw`
     SELECT file, chunk_text, 
            1 - (embedding <=> ${queryEmbedding}::vector) as similarity
     FROM embeddings
     WHERE scan_id = ${scanId}
     ORDER BY embedding <=> ${queryEmbedding}::vector
     LIMIT 10
   `;
   ```

---

## 🔐 GitHub Integration

### Read-Only by Default

The app fetches repository **tarballs** via GitHub REST API:
- ✅ Read-only access (no code execution)
- ✅ Handles 302 redirects automatically
- ✅ Supports public repos without authentication
- ✅ Private repos with `GITHUB_TOKEN`

### GitHub Token Setup

For private repos or higher rate limits:

```bash
# .env.local
GITHUB_TOKEN=ghp_...
```

Or paste directly in the UI (per-scan).

### Write Capabilities (Optional)

Write operations (PRs, commits) are **disabled by default**. To enable:

```bash
# .env.local
ALLOW_WRITE=true
GITHUB_TOKEN=ghp_... # Must have repo write scope
```

**Required permissions**:
- `repo` scope for private repos
- `public_repo` for public repos
- Additional scopes for PR creation/commits

---

## 📦 Available Scripts

### Development
```bash
pnpm dev              # Start Next.js dev server (http://localhost:3000)
pnpm build            # Build for production
pnpm start            # Run production build
pnpm lint             # Run ESLint
pnpm type-check       # Run TypeScript type checking
```

### Database
```bash
pnpm db:push          # Push Prisma schema to database
pnpm db:studio        # Open Prisma Studio (database GUI)
pnpm db:generate      # Generate Prisma Client
pnpm db:migrate       # Create and apply migrations
```

### MCP Server (Optional)
```bash
pnpm mcp:dev          # Start MCP server for Apps SDK integration
```

---

## 📚 Documentation

This project includes comprehensive documentation:

### Quick Reference
- **`README.md`** (this file) - Setup and usage guide
- **`.env.example`** - Environment variable template

### Configuration Guides
- **`MODEL_GUIDE.md`** - AI model comparison, costs, and recommendations
  - Detailed cost analysis for GPT-4, Claude, Gemini, etc.
  - Quality vs. cost trade-offs
  - Model selection guide for different use cases
  
- **`SAMPLING_GUIDE.md`** - File sampling configuration
  - How intelligent sampling works
  - Coverage vs. speed vs. cost trade-offs
  - Configuration examples for different repo sizes

### Bug Fixes & Root Causes
- **`BUGFIXES.md`** - All resolved issues and their fixes
  - GitHub 302 redirect handling
  - Provider mixing resolution
  - JSON parsing error fixes
  - Array schema validation fixes
  
- **`ROOT_CAUSE_ANALYSIS.md`** - Deep dive into JSON parsing issues
  - Why markdown wrapping occurred
  - How `mode: 'json'` solves it
  - Schema structure requirements

### Agent Documentation
- **`AGENTS.md`** - Agent architecture and patterns
  - Vercel AI SDK 5 best practices
  - Tool calling patterns
  - Coordinator loop control
  - Context7 MCP integration

---

## 🛡️ Security & Privacy

### Security Features

- ✅ **Read-only by default**: Never executes code from repositories
- ✅ **No arbitrary code execution**: Only parses and analyzes
- ✅ **Constrained prompts**: Agents use strict prompts to prevent injection
- ✅ **Zod validation**: All AI outputs validated with type-safe schemas
- ✅ **Secure token handling**: GitHub tokens never logged or exposed
- ✅ **HTTPS only**: All external API calls use HTTPS

### Privacy Considerations

- Repository code is sent to AI providers (OpenAI/OpenRouter) for analysis
- Use self-hosted models or Azure OpenAI for sensitive codebases
- Scan results stored in your Postgres database only
- No telemetry or analytics sent to third parties

### Prompt Injection Protection

Agents are instructed with:
- Direct, constrained prompts
- Explicit output format requirements (JSON schemas)
- No code execution capabilities
- Validation guardrails on all outputs

### Best Practices

1. **For public repos**: Use any provider
2. **For private repos**: Consider:
   - Azure OpenAI (SOC 2, HIPAA compliant)
   - Self-hosted models via OpenRouter
   - Vercel AI Gateway with data retention policies
3. **For sensitive code**: 
   - Review privacy policies of your chosen AI provider
   - Use providers with zero data retention
   - Consider on-premise deployment

See **`SECURITY.md`** for operational security guidelines.

---

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# - OPENAI_API_KEY or OPENROUTER_API_KEY
# - DATABASE_URL
# - GITHUB_TOKEN (optional)
```

### Docker

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY . .
RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
```

```bash
docker build -t nextjs-audit .
docker run -p 3000:3000 --env-file .env.local nextjs-audit
```

### Environment Variables for Production

```bash
# Production .env
NODE_ENV=production
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-proj-...
GITHUB_TOKEN=ghp_...

# Optional: Redis for caching
REDIS_URL=redis://...

# Optional: Observability
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. JSON Parsing Errors
**Fixed!** Ensure you have the latest code with:
- `mode: 'json'` in `lib/ai/provider.ts`
- Object-wrapped schemas in `lib/ai/agents/schemas.ts`

#### 2. GitHub 302 Redirects
**Fixed!** The app now follows redirects automatically with `maxRedirections: 5`.

#### 3. Rate Limiting
Use OpenRouter with multiple fallback models:
```typescript
models: [
  'openai/gpt-4o',           // Primary
  'anthropic/claude-3-haiku', // Fallback
  'google/gemini-pro'         // Fallback 2
]
```

#### 4. Database Connection Issues
Ensure your `DATABASE_URL` includes SSL for cloud databases:
```
postgresql://user:pass@host:5432/db?sslmode=require
```

#### 5. Slow Scans
- Reduce sampling limit (see `SAMPLING_GUIDE.md`)
- Use faster models (gpt-4o-mini instead of claude-3.5-sonnet)
- Enable database caching

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Use Zod for all data validation
- Add tests for new agents
- Update documentation for config changes
- Keep agent prompts focused and constrained

---

## 📄 License

MIT License - see LICENSE file for details.

**Third-party components**: Check licenses of any components you add (shadcn/ui, etc.).

---

## 🙏 Acknowledgments

Built with:
- [Vercel AI SDK 5](https://sdk.vercel.ai/) - Agentic AI framework
- [Next.js 15](https://nextjs.org/) - React framework
- [Prisma](https://www.prisma.io/) - Database ORM
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [ts-morph](https://ts-morph.com/) - TypeScript AST manipulation
- [OpenRouter](https://openrouter.ai/) - Unified LLM API
- [shadcn/ui](https://ui.shadcn.com/) - UI components

---

## 📞 Support

- 📖 **Documentation**: See guides in repo root
- 🐛 **Bug Reports**: [Open an issue](https://github.com/yourusername/nextjs-audit-app/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/nextjs-audit-app/discussions)
- 📧 **Email**: your-email@example.com

---

## 🗺️ Roadmap

- [ ] UI configuration for sampling limits
- [ ] Support for monorepos (Nx, Turborepo)
- [ ] Custom agent creation via config files
- [ ] Automated PR creation with fixes
- [ ] CI/CD integration (GitHub Actions, GitLab CI)
- [ ] Support for other frameworks (Remix, SvelteKit, Nuxt)
- [ ] Real-time collaboration features
- [ ] Custom heuristic rules via UI
- [ ] Integration with Sentry, Datadog, etc.

---

**Star ⭐ this repo if you find it useful!**
