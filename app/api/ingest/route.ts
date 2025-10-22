import { NextRequest } from 'next/server';
import { downloadRepoTarball, extractFilesFromTar, getCommitSha } from '@/lib/ai/tools/github';
import { runFullAudit } from '@/lib/ai/agents/coordinator';
import { getDefaultModelForProvider, getOpenRouterProvider } from '@/lib/ai/provider';
import { ProgressStream, createSSEStream, calculateProgress } from '@/lib/ai/tools/streaming';
import { getCachedScan, cacheScanResult } from '@/lib/ai/tools/cache';

export const runtime = 'nodejs';
export const maxDuration = 900; // 15 minutes (increase if needed for very large scans)

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const streaming = url.searchParams.get('stream') === 'true';

  // If not streaming, use legacy JSON response
  if (!streaming) {
    return handleLegacyRequest(req);
  }

  // Streaming response with SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = (data: any) => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    writer.write(encoder.encode(message)).catch(console.error);
  };

  // Start processing in background
  (async () => {
    let writerClosed = false;
    try {
      const { repoUrl, ref: refInput, githubToken, provider: providerInput, model: modelInput } = await req.json();
      const provider = providerInput === 'openrouter' ? 'openrouter' : 'vercel';
      const providerModel = modelInput || getDefaultModelForProvider(provider);
      const routerProvider = provider === 'openrouter' ? getOpenRouterProvider() : null;
      
      let owner: string | undefined;
      let repo: string | undefined;
      let ref = typeof refInput === 'string' && refInput.trim() ? refInput.trim() : undefined;
      
      try {
        const urlObj = new URL(repoUrl.startsWith('http') ? repoUrl : `https://${repoUrl}`);
        const segments = urlObj.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean).map(decodeURIComponent);
        if (segments.length >= 2) {
          [owner, repo] = segments;
          if (!ref && segments[2] === 'tree' && segments.length >= 4) {
            ref = segments.slice(3).join('/');
          }
        }
      } catch {
        throw new Error('Invalid GitHub URL');
      }
      
      repo = repo?.replace(/\.git$/i, '');
      if (!owner || !repo) {
        throw new Error('Invalid GitHub URL');
      }
      
      const token = typeof githubToken === 'string' && githubToken.trim() ? githubToken.trim() : process.env.GITHUB_TOKEN;
      const forceRefresh = url.searchParams.get('refresh') === 'true';
      
      // Create progress stream
      const progressStream = new ProgressStream();
      progressStream.subscribe((update) => {
        sendEvent(update);
      });
      
      // Fetch commit SHA for caching
      progressStream.stage('initializing', 5, 'Fetching commit information...');
      const commitSha = await getCommitSha({ owner, repo, ref, token });
      
      // Check cache (model-aware: same commit + same model = cache hit)
      if (commitSha && !forceRefresh) {
        progressStream.stage('initializing', 8, `Checking cache for ${provider}/${providerModel}...`);
        const cached = await getCachedScan(owner, repo, commitSha, provider, providerModel);
        if (cached) {
          progressStream.complete('Returning cached results', {
            stats: cached.stats,
            issues: cached.issues.slice(0, 10)
          });
          sendEvent({ type: 'result', result: { ...cached, fromCache: true } });
          await writer.close();
          writerClosed = true;
          return;
        } else {
          progressStream.stage('initializing', 10, `No cache for ${provider}/${providerModel}, running fresh scan...`);
        }
      }
      
      // Download phase
      progressStream.stage('downloading', calculateProgress('downloading', 0), 'Downloading repository...');
      const tar = await downloadRepoTarball({ owner, repo, ref, token });
      
      // Extract phase
      progressStream.stage('extracting', calculateProgress('extracting', 0), 'Extracting files...');
      const files = await extractFilesFromTar(tar as any);
      progressStream.stage('extracting', calculateProgress('extracting', 100), `Extracted ${files.length} files`);
      
      const prismaSchema = files.find(f => f.path.endsWith('prisma/schema.prisma'))?.content?.toString('utf-8');
      
      // Run audit with progress
      const result = await runFullAudit({ 
        repo: { owner, repo, ref }, 
        files, 
        prismaSchema, 
        provider,
        progressStream 
      });
      
      // Cache the result
      if (commitSha) {
        await cacheScanResult(result, commitSha);
      }
      
      // Send final result
      sendEvent({ type: 'result', result: { ...result, fromCache: false } });
      
    } catch (e: any) {
      console.error('[ingest] Streaming error', e);
      sendEvent({ 
        type: 'error', 
        error: e.message || String(e),
        timestamp: new Date().toISOString()
      });
    } finally {
      // Only close writer if not already closed
      if (!writerClosed) {
        try {
          await writer.close();
        } catch (err) {
          // Writer already closed, ignore
          console.log('[ingest] Writer already closed');
        }
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Legacy non-streaming handler
async function handleLegacyRequest(req: NextRequest) {
  try {
    const { repoUrl, ref: refInput, githubToken, provider: providerInput } = await req.json();
    const provider = providerInput === 'openrouter' ? 'openrouter' : 'vercel';
    const providerModel = getDefaultModelForProvider(provider);
    const routerProvider = provider === 'openrouter' ? getOpenRouterProvider() : null;
    
    console.log('[ingest] Received request', {
      repoUrl,
      refInput,
      githubTokenProvided: Boolean(githubToken),
      provider,
      model: providerModel,
      routerProvider: routerProvider ?? undefined
    });
    
    let owner: string | undefined;
    let repo: string | undefined;
    let ref = typeof refInput === 'string' && refInput.trim() ? refInput.trim() : undefined;
    
    try {
      const url = new URL(repoUrl.startsWith('http') ? repoUrl : `https://${repoUrl}`);
      const segments = url.pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean).map(decodeURIComponent);
      if (segments.length >= 2) {
        [owner, repo] = segments;
        if (!ref && segments[2] === 'tree' && segments.length >= 4) {
          ref = segments.slice(3).join('/');
        }
      }
    } catch {
      // ignore; will fall through to validation below
    }
    
    repo = repo?.replace(/\.git$/i, '');
    if (!owner || !repo) {
      return Response.json({ error: 'Invalid GitHub URL' }, { status: 400 });
    }
    
    const token = typeof githubToken === 'string' && githubToken.trim() ? githubToken.trim() : process.env.GITHUB_TOKEN;
    
    const tar = await downloadRepoTarball({ owner, repo, ref, token });
    const files = await extractFilesFromTar(tar as any);
    const prismaSchema = files.find(f => f.path.endsWith('prisma/schema.prisma'))?.content?.toString('utf-8');
    const result = await runFullAudit({ repo: { owner, repo, ref }, files, prismaSchema, provider });
    
    return Response.json({ ok: true, result });
  } catch (e: any) {
    console.error('[ingest] POST error', e);
    return Response.json({ error: e.message || String(e) }, { status: 500 });
  }
}
