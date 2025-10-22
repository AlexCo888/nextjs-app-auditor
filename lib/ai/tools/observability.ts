import { Langfuse } from 'langfuse';

/**
 * Langfuse observability integration for tracing AI operations
 * Tracks cost, latency, errors, and quality metrics for all agent calls
 */

let langfuseClient: Langfuse | null = null;

/**
 * Initialize Langfuse client (call once at startup)
 */
export function initializeLangfuse() {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    console.log('[observability] Langfuse not configured (skipping initialization)');
    return null;
  }

  try {
    langfuseClient = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
      flushAt: 1, // Flush after each event in development
      flushInterval: 1000 // Flush every second
    });

    console.log('[observability] Langfuse initialized', { baseUrl });
    return langfuseClient;
  } catch (err) {
    console.error('[observability] Failed to initialize Langfuse:', err);
    return null;
  }
}

/**
 * Get or initialize Langfuse client
 */
export function getLangfuse(): Langfuse | null {
  if (!langfuseClient) {
    return initializeLangfuse();
  }
  return langfuseClient;
}

/**
 * Trace an entire audit scan
 */
export function createAuditTrace(params: {
  repoOwner: string;
  repoName: string;
  ref?: string;
  userId?: string;
}) {
  const client = getLangfuse();
  if (!client) return null;

  try {
    const trace = client.trace({
      name: 'audit_scan',
      metadata: {
        repo: `${params.repoOwner}/${params.repoName}`,
        ref: params.ref || 'HEAD'
      },
      userId: params.userId,
      tags: ['audit', 'scan']
    });

    return trace;
  } catch (err) {
    console.error('[observability] Error creating trace:', err);
    return null;
  }
}

/**
 * Create a span for an agent execution
 */
export function createAgentSpan(params: {
  trace: any;
  agentName: string;
  input: any;
}) {
  if (!params.trace) return null;

  try {
    const span = params.trace.span({
      name: `agent_${params.agentName}`,
      metadata: {
        agent: params.agentName
      },
      input: params.input
    });

    return span;
  } catch (err) {
    console.error('[observability] Error creating span:', err);
    return null;
  }
}

/**
 * Create a generation event for an LLM call
 */
export function createGeneration(params: {
  trace: any;
  name: string;
  model: string;
  input: any;
  provider?: string;
}) {
  if (!params.trace) return null;

  try {
    const generation = params.trace.generation({
      name: params.name,
      model: params.model,
      input: params.input,
      metadata: {
        provider: params.provider || 'vercel'
      }
    });

    return generation;
  } catch (err) {
    console.error('[observability] Error creating generation:', err);
    return null;
  }
}

/**
 * End a span or generation with results
 */
export function endObservation(observation: any, params: {
  output?: any;
  error?: string;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  cost?: number;
}) {
  if (!observation) return;

  try {
    observation.end({
      output: params.output,
      statusMessage: params.error ? 'error' : 'success',
      level: params.error ? 'ERROR' : 'DEFAULT',
      usage: params.tokens ? {
        promptTokens: params.tokens.prompt,
        completionTokens: params.tokens.completion,
        totalTokens: params.tokens.total
      } : undefined,
      metadata: {
        cost: params.cost,
        error: params.error
      }
    });
  } catch (err) {
    console.error('[observability] Error ending observation:', err);
  }
}

/**
 * Log a score/metric for an observation
 */
export function scoreObservation(params: {
  traceId: string;
  name: string;
  value: number;
  comment?: string;
}) {
  const client = getLangfuse();
  if (!client) return;

  try {
    client.score({
      traceId: params.traceId,
      name: params.name,
      value: params.value,
      comment: params.comment
    });
  } catch (err) {
    console.error('[observability] Error scoring observation:', err);
  }
}

/**
 * Flush all pending events (call before shutdown)
 */
export async function flushLangfuse() {
  const client = getLangfuse();
  if (!client) return;

  try {
    await client.flushAsync();
    console.log('[observability] Langfuse events flushed');
  } catch (err) {
    console.error('[observability] Error flushing Langfuse:', err);
  }
}

/**
 * Wrapper for traced agent execution
 */
export async function withAgentTracing<T>(
  trace: any,
  agentName: string,
  input: any,
  fn: () => Promise<T>
): Promise<T> {
  const span = createAgentSpan({ trace, agentName, input });
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    if (span) {
      endObservation(span, {
        output: result,
        tokens: { total: 0 } // Will be populated by actual LLM calls
      });
    }

    console.log(`[observability] ${agentName} completed in ${duration}ms`);
    return result;
  } catch (err: any) {
    const duration = Date.now() - startTime;

    if (span) {
      endObservation(span, {
        error: err.message || String(err)
      });
    }

    console.error(`[observability] ${agentName} failed after ${duration}ms:`, err);
    throw err;
  }
}

/**
 * Calculate estimated cost for a model call
 */
export function calculateCost(params: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  // Pricing per 1M tokens (as of 2025)
  const pricing: Record<string, { prompt: number; completion: number }> = {
    'gpt-4': { prompt: 30, completion: 60 },
    'gpt-4-turbo': { prompt: 10, completion: 30 },
    'gpt-4o': { prompt: 2.5, completion: 10 },
    'gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
    'claude-3-opus': { prompt: 15, completion: 75 },
    'claude-3-sonnet': { prompt: 3, completion: 15 },
    'claude-3-haiku': { prompt: 0.25, completion: 1.25 },
    'gemini-pro': { prompt: 0.5, completion: 1.5 }
  };

  // Find matching pricing (fallback to GPT-3.5 pricing)
  let modelPricing = pricing['gpt-3.5-turbo'];
  for (const [key, value] of Object.entries(pricing)) {
    if (params.model.toLowerCase().includes(key)) {
      modelPricing = value;
      break;
    }
  }

  const promptCost = (params.promptTokens / 1_000_000) * modelPricing.prompt;
  const completionCost = (params.completionTokens / 1_000_000) * modelPricing.completion;

  return promptCost + completionCost;
}

/**
 * Track audit metrics
 */
export function trackAuditMetrics(params: {
  traceId: string;
  filesAnalyzed: number;
  chunksCreated: number;
  issuesFound: number;
  duration: number;
  cached: boolean;
}) {
  const client = getLangfuse();
  if (!client) return;

  try {
    // Track key metrics as scores
    scoreObservation({
      traceId: params.traceId,
      name: 'files_analyzed',
      value: params.filesAnalyzed,
      comment: `Analyzed ${params.filesAnalyzed} files`
    });

    scoreObservation({
      traceId: params.traceId,
      name: 'issues_found',
      value: params.issuesFound,
      comment: `Found ${params.issuesFound} issues`
    });

    scoreObservation({
      traceId: params.traceId,
      name: 'duration_seconds',
      value: params.duration / 1000,
      comment: `Completed in ${(params.duration / 1000).toFixed(2)}s`
    });

    if (params.cached) {
      scoreObservation({
        traceId: params.traceId,
        name: 'cache_hit',
        value: 1,
        comment: 'Result served from cache'
      });
    }
  } catch (err) {
    console.error('[observability] Error tracking metrics:', err);
  }
}
