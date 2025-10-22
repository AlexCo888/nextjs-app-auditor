import { z } from 'zod';

/**
 * Shared Zod schemas for structured agent outputs
 * This eliminates JSON parsing failures by using AI SDK's generateObject
 */

export const IssueOutputSchema = z.object({
  title: z.string().describe('Short, descriptive title of the issue'),
  description: z.string().describe('Detailed explanation of the problem'),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional().default('medium'),
  recommendation: z.string().optional().describe('Actionable steps to fix the issue'),
  file: z.string().optional().describe('File path where the issue was found'),
  line: z.number().optional().describe('Line number where the issue was found'),
  evidence: z.array(z.string()).optional().describe('Code snippets or specific examples'),
  docs: z.array(z.object({
    title: z.string(),
    url: z.string().url()
  })).optional().describe('Links to relevant documentation')
});

// Wrap in object because JSON Schema spec requires root to be an object, not an array
export const IssuesArraySchema = z.object({
  issues: z.array(IssueOutputSchema).describe('Array of issues found during analysis')
});

export const CodemodOutputSchema = z.object({
  issueTitle: z.string().describe('Title of the issue this codemod addresses'),
  codemod: z.object({
    name: z.string().describe('Name of the codemod transform'),
    command: z.string().describe('Command to run the codemod'),
    description: z.string().describe('What the codemod does'),
    transform: z.string().optional().describe('Path to transform file if applicable')
  })
});

// Wrap in object because JSON Schema spec requires root to be an object, not an array
export const CodemodsArraySchema = z.object({
  codemods: z.array(CodemodOutputSchema).describe('Array of codemods to apply')
});

export type IssueOutput = z.infer<typeof IssueOutputSchema>;
export type CodemodOutput = z.infer<typeof CodemodOutputSchema>;
