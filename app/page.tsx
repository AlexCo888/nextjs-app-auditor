'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const PROVIDER_LABELS: Record<'vercel' | 'openrouter', string> = {
  vercel: 'Vercel AI Gateway',
  openrouter: 'OpenRouter'
};

export default function Page() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/vercel/next.js');
  const [ref, setRef] = useState('');
  const [token, setToken] = useState('');
  const [provider, setProvider] = useState<'vercel' | 'openrouter'>('vercel');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  async function runScan() {
    setError(null);
    setLoading(true);
    setResult(null);
    setProgress('Starting scan...');

    try {
      // Use streaming endpoint to prevent timeouts on long scans
      const params = new URLSearchParams({ stream: 'true' });
      const res = await fetch(`/api/ingest?${params}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          repoUrl, 
          ref: ref || undefined, 
          githubToken: token || undefined, 
          provider,
          model: model || undefined // Include model for cache key
        })
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(json.error || 'Scan failed');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response stream available');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data:')) continue;
          
          try {
            const data = JSON.parse(line.slice(5));
            
            if (data.type === 'progress') {
              setProgress(data.message || `${data.stage} - ${data.percent}%`);
            } else if (data.type === 'result') {
              setResult(data.result);
              setProgress('Scan complete!');
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Scan failed');
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE message:', line, parseError);
          }
        }
      }
    } catch (e: any) {
      console.error('Scan error:', e);
      setError(e.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Audit a GitHub repo (read-only)</CardTitle>
          <CardDescription>We download a tarball of the repository at the specified ref, build a code graph, run heuristics and multi‑agent analysis, then return a report.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm">GitHub Repo URL</span>
            <input value={repoUrl} onChange={e=>setRepoUrl(e.target.value)} className="w-full border rounded p-2" placeholder="https://github.com/owner/repo"/>
          </label>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-sm">Ref (branch or tag, optional)</span>
              <input value={ref} onChange={e=>setRef(e.target.value)} className="w-full border rounded p-2" placeholder="main"/>
            </label>
            <label className="grid gap-1">
              <span className="text-sm">GitHub token (optional, increases rate limits)</span>
              <input value={token} onChange={e=>setToken(e.target.value)} className="w-full border rounded p-2" placeholder="ghp_..."/>
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-sm">Model (optional, e.g., openai/gpt-4o, anthropic/claude-3.5-sonnet)</span>
            <input value={model} onChange={e=>setModel(e.target.value)} className="w-full border rounded p-2" placeholder="Uses provider default if empty"/>
            <span className="text-xs text-muted">💡 Changing the model will bypass cache and run a fresh scan</span>
          </label>
          <div className="flex gap-3 mt-2">
            <Button onClick={runScan} variant="primary" isLoading={loading}>Run audit</Button>
            <span className="text-sm text-muted">Default mode is read-only. Write operations are disabled unless explicitly enabled in env.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-sm font-medium">Model provider:</span>
            <div className="flex gap-2">
              {(['vercel', 'openrouter'] as const).map(option => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={provider === option ? 'primary' : 'default'}
                  onClick={() => setProvider(option)}
                  disabled={loading}
                >
                  {PROVIDER_LABELS[option]}
                </Button>
              ))}
            </div>
            <span className="text-xs text-muted">
              OpenRouter defaults to model `z-ai/glm-4.6` via provider `baseten/fp4`. Ensure the server sets `OPENROUTER_API_KEY` (and optionally `OPENROUTER_HTTP_REFERER` / `OPENROUTER_APP_NAME`).
            </span>
          </div>
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
          {loading && progress && (
            <div className="rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900 mt-2">
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="font-medium">Scanning in progress...</span>
              </div>
              <div className="mt-1 text-xs">{progress}</div>
              <div className="mt-2 text-xs text-blue-700">
                ⏱️ Large scans may take 5-15 minutes. Progress updates will keep you informed.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Report</CardTitle>
            <CardDescription>
              {result.repo.owner}/{result.repo.repo} — {result.stats.files} files, {result.stats.chunks} chunks — Provider: {PROVIDER_LABELS[result.provider as 'vercel' | 'openrouter'] ?? result.provider} — Model: {result.model}{result.openrouterProvider ? ` (${result.openrouterProvider})` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="text-sm text-muted">Started: {new Date(result.startedAt).toLocaleString()} - Finished: {new Date(result.finishedAt).toLocaleString()}</div>
            {Array.isArray(result.warnings) && result.warnings.length > 0 && (
              <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                <div className="font-medium">Warnings</div>
                <ul className="list-disc pl-5 mt-1">
                  {result.warnings.map((w: string, idx: number) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-3">
              {result.issues?.map((i: any) => (
                <div key={i.id} className="border rounded p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{i.title}</div>
                    <span className="text-xs rounded px-2 py-1 border">{i.type} · {i.severity}</span>
                  </div>
                  <p className="text-sm mt-1">{i.description}</p>
                  {i.recommendation && <p className="text-sm mt-2"><span className="font-medium">Recommendation:</span> {i.recommendation}</p>}
                  {i.codemod && (
                    <div className="mt-2">
                      <div className="text-xs font-mono">Codemod: {i.codemod.name}</div>
                      <div className="text-xs font-mono bg-gray-50 border rounded p-2 mt-1">{i.codemod.command}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <a
              href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(result, null, 2))}`}
              download="audit-report.json"
              className="btn btn-ghost"
            >Download JSON</a>
            {result.markdown && (
              <a
                href={`data:text/markdown;charset=utf-8,${encodeURIComponent(result.markdown)}`}
                download="audit-report.md"
                className="btn btn-ghost"
              >Download Markdown</a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
