import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export type Context7Snippet = { title: string; url: string; snippet: string };

/**
 * Connects to a Context7 MCP server and fetches docs for a given library.
 * Provide CONTEXT7_MCP_URL and optional CONTEXT7_API_KEY in the environment.
 */
export async function getContext7Docs(libraryName: string): Promise<Context7Snippet[]> {
  const url = process.env.CONTEXT7_MCP_URL;
  if (!url) return [];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (process.env.CONTEXT7_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.CONTEXT7_API_KEY}`;
  }
  const client = new Client({ name: 'nextjs-audit-context7', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers }
  });
  await client.connect(transport);

  // Discover library id
  const resolve = await client.callTool({
    name: 'resolve-library-id',
    arguments: { libraryName }
  } as any);

  const libId = (resolve as any)?.content?.[0]?.text ?? (resolve as any)?.content?.[0]?.json?.id;
  if (!libId) return [];

  const docs = await client.callTool({
    name: 'get-library-docs',
    arguments: { libraryId: libId }
  } as any);

  // Normalize
  const content = (docs as any)?.content ?? [];
  const items: Context7Snippet[] = [];
  for (const part of content) {
    if (part.type === 'json' && Array.isArray(part.json)) {
      for (const j of part.json) {
        if (j.title && j.url && j.snippet) items.push(j as Context7Snippet);
      }
    }
  }
  return items;
}
