import { ai } from '@/lib/ai/provider';

// This agent would call Context7 MCP in production to fetch official docs snippets based on libraries used.
// Here we LLM-summarize provided doc snippets to keep the interface consistent.
export async function docsAgentSummarize(snippets: string[]) {
  const prompt = `Summarize the following documentation snippets to support code review recommendations.
Return JSON: [{title, snippet, link?}] and deduplicate overlapping content.`;
  const { text } = await ai.generateText({
    prompt: `${prompt}\n\n${snippets.slice(0,8).join('\n\n---\n')}`
  });
  return text;
}
