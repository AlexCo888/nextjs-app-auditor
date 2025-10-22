import { ai } from '@/lib/ai/provider';
import { IssuesArraySchema } from './schemas';
import type { z } from 'zod';

export async function perfAgentAnalyze(context: { summary: string, codeSamples: string[] }) {
  const prompt = `You are a performance engineer for Next.js on Vercel.

Identify performance issues:
- Render-blocking resources (large synchronous imports, blocking scripts)
- Heavy client bundles (missing code splitting, unused dependencies)
- Missing streaming or suspense boundaries for async data
- Avoidable re-renders (missing memoization, unstable deps)
- Slow data fetches (missing parallel fetching, serial waterfalls)
- Unoptimized images (missing next/image, wrong formats)
- Missing static generation opportunities (should be SSG not SSR)
- Large third-party scripts without optimization
- Inefficient state management causing excessive renders
- Missing virtualization for long lists
- Hydration mismatches slowing TTI
- Heavy computation on main thread

For each issue found, provide:
- Clear title and description
- Severity level (high for user-facing perf, medium for optimization)
- Specific recommendation with Next.js patterns and code examples
- Expected performance impact`;

  const { object } = await ai.generateObject({
    schema: IssuesArraySchema,
    prompt: `${prompt}\n\n# SUMMARY\n${context.summary}\n# SAMPLES\n${context.codeSamples.slice(0,6).join('\n\n---\n')}`
  });
  
  return (object as z.infer<typeof IssuesArraySchema>).issues;
}
