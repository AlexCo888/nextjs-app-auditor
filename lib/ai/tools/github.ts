import { Readable } from 'node:stream';
import { request } from 'undici';
import * as zlib from 'node:zlib';
import tar from 'tar-stream';

export type RepoRef = { owner: string; repo: string; ref?: string };
export type RepoFile = { path: string; size: number; isBinary: boolean; content?: Buffer };

/**
 * Fetch the commit SHA for a given ref (branch, tag, or HEAD)
 */
export async function getCommitSha({ owner, repo, ref, token }: RepoRef & { token?: string }): Promise<string | null> {
  try {
    const refPath = ref || 'HEAD';
    const endpoint = `https://api.github.com/repos/${owner}/${repo}/commits/${refPath}`;
    const headers: Record<string, string> = {
      'User-Agent': 'nextjs-audit-app',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    console.log('[github] Fetching commit SHA', { owner, repo, ref: refPath });
    
    const res = await request(endpoint, { 
      method: 'GET', 
      headers,
      maxRedirections: 5
    } as any);
    
    if (res.statusCode !== 200) {
      console.error('[github] Failed to fetch commit SHA', { status: res.statusCode });
      return null;
    }

    const body = await res.body.text();
    const data = JSON.parse(body);
    const sha = data.sha;

    console.log('[github] Got commit SHA', { sha: sha.substring(0, 8) });
    return sha;
  } catch (err) {
    console.error('[github] Error fetching commit SHA:', err);
    return null;
  }
}

export async function downloadRepoTarball({ owner, repo, ref, token }: RepoRef & { token?: string }) {
  const encodedRef = ref ? encodeURIComponent(ref) : 'HEAD';
  const endpoint = `https://api.github.com/repos/${owner}/${repo}/tarball/${encodedRef}`;
  const headers: Record<string, string> = {
    'User-Agent': 'nextjs-audit-app',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const maskToken = (value?: string | null) => {
    if (!value) return 'none';
    if (value.length <= 8) return `${value[0]}***${value[value.length - 1]}`;
    return `${value.slice(0, 4)}***${value.slice(-4)}`;
  };
  console.log('[github] Requesting tarball', {
    owner,
    repo,
    ref: ref ?? 'HEAD',
    endpoint,
    tokenMask: maskToken(token)
  });
  
  // GitHub API returns 302 redirect to actual tarball location
  // We need to follow redirects manually
  const res = await request(endpoint, { 
    method: 'GET', 
    headers,
    maxRedirections: 5 // Follow up to 5 redirects
  } as any);
  
  if (res.statusCode !== 200) {
    const bodySnippet = await readBodySnippet(res.body);
    console.error('[github] Tarball request failed', {
      owner,
      repo,
      ref: ref ?? 'HEAD',
      endpoint,
      status: res.statusCode,
      bodySnippet
    });
    throw new Error(`GitHub tarball request failed: ${res.statusCode}`);
  }
  return res.body; // Readable stream
}

export async function extractFilesFromTar(readable: Readable, maxBytes = 100 * 1024 * 1024) {
  // GitHub tarballs are gzip-compressed
  const gunzip = zlib.createGunzip();
  const extract = tar.extract();
  const files: RepoFile[] = [];

  let total = 0;

  const IGNORES = [
    '**/node_modules/**',
    '**/.next/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**'
  ];
  const micromatch = (await import('micromatch')).default;
  const { isBinary } = await import('istextorbinary');

  const done = new Promise<void>((resolve, reject) => {
    extract.on('entry', async function(header: any, stream: any, next: any) {
      try {
        if (header.type === 'file') {
          const path = header.name.split('/').slice(1).join('/'); // remove base dir
          if (!path || IGNORES.some(p => micromatch.isMatch(path, p))) {
            stream.resume();
            return next();
          }
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => { chunks.push(c); total += c.length; if (total > maxBytes) { stream.destroy(new Error('Tarball too large')); } });
          stream.on('end', async () => {
            const buf = Buffer.concat(chunks);
            const binary = isBinary(path, buf);
            files.push({ path, size: buf.length, isBinary: Boolean(binary), content: binary ? undefined : buf });
            next();
          });
          stream.on('error', reject);
        } else {
          stream.resume();
          next();
        }
      } catch (e) {
        reject(e);
      }
    });
    extract.on('finish', () => resolve());
    extract.on('error', reject);
  });

  readable.pipe(gunzip).pipe(extract);
  await done;
  return files;
}

async function readBodySnippet(stream: Readable, limit = 4096) {
  let collected = '';
  try {
    for await (const chunk of stream) {
      const part = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      const remaining = limit - collected.length;
      collected += remaining >= part.length ? part : part.slice(0, remaining);
      if (collected.length >= limit) break;
    }
  } catch (err) {
    console.error('[github] Failed to read error body', err);
  }
  return collected;
}
