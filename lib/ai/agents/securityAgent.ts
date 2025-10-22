import { ai } from '@/lib/ai/provider';
import { IssuesArraySchema } from './schemas';
import type { z } from 'zod';

export async function securityAgentAnalyze(context: { summary: string, ruleHits: string[] }) {
  const prompt = `You are an application security engineer auditing a Next.js App Router project.

Analyze the rule hits and identify security vulnerabilities:
- XSS vulnerabilities (dangerouslySetInnerHTML, unescaped user input)
- CSRF protection missing on state-changing operations
- SSRF risks in server-side fetch/request calls
- Secrets hardcoded in source code
- Missing security headers (CSP, HSTS, X-Frame-Options)
- Insecure cookie configuration (missing httpOnly, secure, sameSite)
- SQL injection risks in raw queries
- Path traversal vulnerabilities
- Weak authentication/authorization patterns
- Exposed API keys or tokens
- Missing rate limiting on sensitive endpoints
- Insecure file uploads

For each vulnerability, provide:
- Clear title and description
- Severity level (critical for exploitable issues, high for serious risks)
- Specific remediation steps with code examples
- Security best practices references

IMPORTANT: Use the rule hits as evidence to ground your findings.

RETURN FORMAT: You MUST return a valid JSON object with an 'issues' array. Each issue must have: title, description, severity, recommendation. Do NOT return markdown, explanatory text, or anything other than the JSON object matching the schema.`;

  const { object } = await ai.generateObject({
    schema: IssuesArraySchema,
    prompt: `${prompt}\n\n# SUMMARY\n${context.summary}\n# RULE-HITS\n${context.ruleHits.length > 0 ? context.ruleHits.join('\n') : '(No heuristic hits found)'}`
  });
  
  return (object as z.infer<typeof IssuesArraySchema>).issues;
}
