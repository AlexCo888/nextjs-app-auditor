import { z } from 'zod';

export type RepoRef = { owner: string; repo: string; ref?: string };

export type Issue = {
  id: string;
  type: 'security' | 'performance' | 'ux' | 'backend' | 'db' | 'lint' | 'general';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file?: string;
  line?: number;
  codeFrame?: string;
  recommendation?: string;
  codemod?: { name: string; command: string; description: string; transform?: string };
  docs?: { title: string; url: string }[];
  evidence?: string[]; // snippets or rule hits
};

export type ScanResult = {
  repo: RepoRef;
  startedAt: string;
  finishedAt: string;
  stats: Record<string, number>;
  issues: Issue[];
  embeddings?: number;
  provider: 'vercel' | 'openrouter';
  model: string;
  openrouterProvider?: string | null;
  markdown: string;
  warnings?: string[];
};

export const ScanRequestSchema = z.object({
  repoUrl: z.string().url(),
  ref: z.string().optional(),
  githubToken: z.string().optional(),
  provider: z.enum(['vercel', 'openrouter']).optional()
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;
