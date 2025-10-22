import { ai } from '@/lib/ai/provider';
import { IssuesArraySchema } from './schemas';
import type { z } from 'zod';

export async function uiuxAgentAnalyze(context: { summary: string, codeSamples: string[] }) {
  const prompt = `You are a senior UI/UX engineer auditing a Next.js App Router project.

Identify concrete UX issues:
- Accessibility violations (missing ARIA labels, alt text, semantic HTML)
- Layout shifts and CLS problems
- Navigation issues (broken links, confusing routing)
- Missing loading states, skeletons, or suspense boundaries
- Form usability (validation, error messages, focus management)
- Color contrast and readability issues
- Mobile responsiveness problems
- Focus trap issues in modals/dialogs

For each issue found, provide:
- Clear title and description
- Severity level (critical, high, medium, low)
- Actionable recommendation with code examples where possible`;

  const { object } = await ai.generateObject({
    schema: IssuesArraySchema,
    prompt: `${prompt}\n\n# SUMMARY\n${context.summary}\n# SAMPLES\n${context.codeSamples.slice(0,6).join('\n\n---\n')}`
  });
  
  return (object as z.infer<typeof IssuesArraySchema>).issues;
}
