import { ai } from '@/lib/ai/provider';
import { IssuesArraySchema } from './schemas';
import type { z } from 'zod';

export async function dbAgentAnalyze(context: { summary: string, schema: string }) {
  const prompt = `You are a database engineer reviewing Prisma & Postgres with pgvector.

Identify database and data access issues:
- Missing indexes on frequently queried fields
- N+1 query patterns (missing includes/select)
- Unbounded result sets without pagination
- Missing connection pooling configuration
- Unsafe raw SQL usage without parameterization
- Inefficient vector search queries
- Missing unique constraints
- Suboptimal data modeling (denormalization opportunities)
- Missing cascade deletes causing orphaned records
- Transaction isolation issues

For each issue found, provide:
- Clear title and description
- Severity level (critical, high, medium, low)
- Specific recommendation with Prisma examples`;

  const { object } = await ai.generateObject({
    schema: IssuesArraySchema,
    prompt: `${prompt}\n\n# SUMMARY\n${context.summary}\n# PRISMA SCHEMA\n${context.schema || '(No schema provided)'}`
  });
  
  return (object as z.infer<typeof IssuesArraySchema>).issues;
}
