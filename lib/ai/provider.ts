import { streamText as baseStreamText, generateText as baseGenerateText, generateObject as baseGenerateObject, embedMany, embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export type AIProviderName = 'vercel' | 'openrouter';

const DEFAULT_VERCEL_MODEL = process.env.AI_GATEWAY_DEFAULT_MODEL ?? 'moonshotai/kimi-k2-0905';
const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_DEFAULT_MODEL ?? 'z-ai/glm-4.6';
const DEFAULT_OPENROUTER_PROVIDER = process.env.OPENROUTER_DEFAULT_PROVIDER ?? null;

let activeProvider: AIProviderName = 'vercel';
let cachedOpenRouter:
  | ReturnType<typeof createOpenAI>
  | null = null;

function ensureOpenRouter() {
  if (cachedOpenRouter) return cachedOpenRouter;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter provider selected but OPENROUTER_API_KEY is not configured on the server.');
  }
  const headers: Record<string, string> = {};
  const referer = process.env.OPENROUTER_HTTP_REFERER ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const title = process.env.OPENROUTER_APP_NAME ?? 'nextjs-audit-app';
  headers['HTTP-Referer'] = referer;
  headers['X-Title'] = title;
  if (DEFAULT_OPENROUTER_PROVIDER) {
    headers['X-OpenRouter-Provider'] = DEFAULT_OPENROUTER_PROVIDER;
  }
  cachedOpenRouter = createOpenAI({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    headers
  });
  return cachedOpenRouter;
}

function resolveModel(model?: any) {
  if (activeProvider === 'openrouter') {
    const client = ensureOpenRouter();
    if (model && typeof model !== 'string') return model;
    const requested = typeof model === 'string' ? model : undefined;
    const id = !requested || requested === DEFAULT_VERCEL_MODEL ? DEFAULT_OPENROUTER_MODEL : requested;
    return client(id);
  }
  if (typeof model === 'undefined' || model === null) return DEFAULT_VERCEL_MODEL;
  return model;
}

export function setAIProvider(provider: AIProviderName) {
  activeProvider = provider;
}

export function getAIProvider(): AIProviderName {
  return activeProvider;
}

export function getDefaultModelForProvider(provider: AIProviderName) {
  return provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_VERCEL_MODEL;
}

export function getOpenRouterProvider() {
  return DEFAULT_OPENROUTER_PROVIDER;
}

export const ai = {
  generateText: (params: any) => {
    const { model, ...rest } = params ?? {};
    return baseGenerateText({
      ...rest,
      model: resolveModel(model)
    });
  },
  generateObject: (params: any) => {
    const { model, ...rest } = params ?? {};
    return baseGenerateObject({
      ...rest,
      model: resolveModel(model),
      mode: 'json' // Force JSON output mode (prevents markdown wrapping)
    });
  },
  streamText: (params: any) => {
    const { model, ...rest } = params ?? {};
    return baseStreamText({
      ...rest,
      model: resolveModel(model)
    });
  },
  embedMany,
  embed
};

export { createOpenAI as openai };
