import express from 'express';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { downloadRepoTarball, extractFilesFromTar } from '@/lib/ai/tools/github';
import { runFullAudit } from '@/lib/ai/agents/coordinator';

// Minimal MCP server exposing audit tools and a widget template for ChatGPT Apps SDK.
const app = express();

const server = new McpServer({
  name: 'nextjs-audit-mcp',
  version: '1.0.0'
});

// UI widget template (Apps SDK renders this)
const widgetUri = 'ui://widget/audit.html';

server.tool('scan_repo', {
  title: 'Scan a GitHub repo',
  description: 'Downloads a GitHub tarball (read-only) and runs a multi-agent audit. Returns a summary that the component can render.',
  inputSchema: z.object({
    repoUrl: z.string().url(),
    ref: z.string().optional(),
    token: z.string().optional()
  }),
  // OpenAI Apps SDK specific metadata
  _meta: {
    'openai/outputTemplate': widgetUri,
    'openai/widgetAccessible': true
  }
}, async (input) => {
  const m = input.repoUrl.match(/github.com\/(.+?)\/(.+?)(?:$|\.|\/)/i);
  if (!m) throw new Error('Invalid GitHub URL');
  const owner = m[1]; const repo = m[2];
  const tar = await downloadRepoTarball({ owner, repo, ref: input.ref, token: input.token });
  const files = await extractFilesFromTar(tar as any);
  const result = await runFullAudit({ repo: { owner, repo, ref: input.ref }, files });
  return {
    content: [{
      type: 'json',
      json: result
    }]
  };
});

// Expose the widget bundle as a resource
server.resource('audit_widget', new ResourceTemplate(widgetUri, { list: undefined }), async (uri) => {
  return {
    contents: [{
      uri: widgetUri,
      mimeType: 'text/html+skybridge',
      text: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      body { font: 14px/1.4 system-ui, sans-serif; padding: 8px; }
      .issue { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; margin: 8px 0; }
      .chip { display:inline-block; padding: 2px 6px; border: 1px solid #e5e7eb; border-radius: 999px; font-size: 12px; }
    </style>
  </head>
  <body>
    <div id="root">Waiting for audit data…</div>
    <script type="module">
      // Component bridge passes the tool result via postMessage
      window.addEventListener('message', (ev) => {
        const data = ev.data?.result || ev.data; // Apps SDK typically sends { result }
        if (!data) return;
        const r = data;
        const el = document.getElementById('root');
        el.innerHTML = \`
          <div><strong>\${r.repo.owner}/\${r.repo.repo}</strong> — \${r.stats.files} files, \${r.stats.chunks} chunks</div>
          <div>Issues: \${r.issues.length}</div>
          \${r.issues.slice(0, 50).map(i => \`
            <div class="issue">
              <div><strong>\${i.title}</strong></div>
              <div class="chip">\${i.type} · \${i.severity}</div>
              <p>\${i.description ?? ''}</p>
              \${i.recommendation ? '<div><em>Recommendation:</em> '+i.recommendation+'</div>' : ''}
            </div>
          \`).join('')}
        \`;
      }, { once: true });
    </script>
  </body>
</html>`
    }]
  };
});

const transport = new StreamableHTTPServerTransport({ path: '/mcp' });
await server.connect(transport);

app.use(transport.expressMiddleware());

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
app.listen(port, () => {
  console.log(`MCP server listening on :${port} (path /mcp)`);
});
