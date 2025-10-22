import { ai } from '@/lib/ai/provider';
import { IssuesArraySchema, type IssueOutput } from './schemas';
import type { z } from 'zod';

export async function backendAgentAnalyze(context: { summary: string, codeSamples: string[] }) {
  const prompt = `You are a senior backend engineer auditing a Next.js App Router project.

Identify server-side problems:
- Route handlers without proper error boundaries
- Missing or incorrect caching strategies (revalidate, cache-control)
- ISR/SSG misconfiguration
- Missing streaming or suspense where beneficial
- Improper edge/node runtime selection
- Excessive bundle size due to dynamic imports
- Missing error handling in async operations

For each issue found, provide:
- Clear title and description
- Severity level (critical, high, medium, low)
- Actionable recommendation`;

  const { object } = await ai.generateObject({
    schema: IssuesArraySchema,
    prompt: `${prompt}\n\n# SUMMARY\n${context.summary}\n# SAMPLES\n${context.codeSamples.slice(0,6).join('\n\n---\n')}`
  });
  
  return (object as z.infer<typeof IssuesArraySchema>).issues;
}
