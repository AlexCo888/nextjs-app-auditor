import { ai } from '@/lib/ai/provider';
import { CodemodsArraySchema } from './schemas';
import type { z } from 'zod';

export async function codemodAgentPlan(context: { issues: any[] }) {
  const prompt = `You are a codemod author. For each issue that can be automatically fixed, propose a concrete transformation.

For automatable issues, create:
- A descriptive codemod name (e.g., "add-missing-alt-text", "fix-async-error-handling")
- Executable command using jscodeshift or ts-morph
- Clear description of what the codemod does
- Safety guards and validation steps

Best practices:
- Use NON-DESTRUCTIVE transforms (always preserve original behavior)
- Add guards to prevent incorrect transformations
- Include dry-run capability
- Test transforms don't break existing code
- Provide rollback instructions

Command format:
\`npx jscodeshift -t transforms/your-transform.ts src/**/*.tsx\`
or
\`npx ts-node scripts/your-refactor.ts\`

Only create codemods for issues that are:
- Mechanical and repetitive
- Safe to automate
- Follow clear patterns`;

  // Limit issues to prevent token overflow
  const issuesSummary = context.issues.slice(0, 20).map(i => ({
    title: i.title,
    description: i.description?.substring(0, 200),
    type: i.type
  }));

  const { object } = await ai.generateObject({
    schema: CodemodsArraySchema,
    prompt: `${prompt}\n\n# ISSUES TO ADDRESS\n${JSON.stringify(issuesSummary, null, 2)}`
  });
  
  return (object as z.infer<typeof CodemodsArraySchema>).codemods;
}
