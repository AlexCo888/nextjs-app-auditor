import { ai } from '@/lib/ai/provider';
import { IssuesArraySchema } from './schemas';
import type { z } from 'zod';

export async function lintAgentAnalyze(context: { list: {file: string, text: string}[] }) {
  const prompt = `You are a code quality engineer auditing modern React/Next.js (App Router) and TypeScript code.

Identify code quality issues and anti-patterns:
- Using 'any' type instead of proper TypeScript types
- Missing error handling in async functions
- Improper use of React hooks (wrong dependencies, hooks in conditionals)
- Server components importing client-only code
- Client components not marked with 'use client'
- Outdated Next.js patterns (pages router patterns in app router)
- Missing key props in mapped components
- Inefficient useEffect usage (should be event handlers)
- Console.log statements in production code
- Unused imports or variables
- Magic numbers without constants
- Overly complex functions (>50 lines)
- Missing JSDoc for exported functions
- Improper async/await patterns
- Race conditions in state updates

For each issue found, provide:
- Clear title and description
- File path where issue occurs
- Severity level (low for style issues, medium for bugs)
- Specific refactoring recommendation with example`;

  const samples = context.list.slice(0, 8).map(f => `// FILE: ${f.file}\n${f.text.substring(0,2000)}`).join('\n\n');
  
  const { object } = await ai.generateObject({
    schema: IssuesArraySchema,
    prompt: `${prompt}\n\n# CODE SAMPLES\n${samples}`
  });
  
  return (object as z.infer<typeof IssuesArraySchema>).issues;
}
