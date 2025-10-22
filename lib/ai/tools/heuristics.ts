export type RuleHit = { rule: string; file: string; line: number; message: string; evidence?: string };

export function runHeuristics(files: { path: string; content?: Buffer; isBinary: boolean }[]): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const f of files) {
    if (f.isBinary || !f.content) continue;
    const text = f.content.toString('utf-8');

    // Security: detecting dangerouslySetInnerHTML without sanitization
    if (text.includes('dangerouslySetInnerHTML')) {
      const line = text.split('\n').findIndex(l => l.includes('dangerouslySetInnerHTML')) + 1;
      hits.push({ rule: 'react-dangerouslySetInnerHTML', file: f.path, line, message: 'Use of dangerouslySetInnerHTML detected. Ensure sanitization.', evidence: 'dangerouslySetInnerHTML' });
    }
    // Security: eval
    if (/\beval\s*\(/.test(text)) {
      const line = text.split('\n').findIndex(l => /\beval\s*\(/.test(l)) + 1;
      hits.push({ rule: 'no-eval', file: f.path, line, message: 'Use of eval is dangerous and should be removed.' });
    }
    // Next.js performance: large images without next/image
    if (/\.(png|jpg|jpeg|gif|webp)/i.test(f.path) && f.path.includes('/public/')) {
      hits.push({ rule: 'large-asset-public', file: f.path, line: 1, message: 'Large binary asset under public/. Prefer CDN or next/image with optimization.' });
    }
    // Performance/react: un-memoized expensive map with inline components (heuristic)
    if (/map\(\(.*\)\s*=>\s*<\w+/s.test(text) && text.length > 5000) {
      const line = text.split('\n').findIndex(l => /map\(\(.*\)\s*=>\s*<\w+/.test(l)) + 1;
      hits.push({ rule: 'inline-component-in-map', file: f.path, line, message: 'Rendering JSX in array.map in a large component. Consider memoization or virtualization.' });
    }
    // Next.js API: GET handlers missing cache control (edge)
    if (f.path.startsWith('app/') && f.path.endsWith('/route.ts') && text.includes('export async function GET')) {
      if (!/revalidate|cache-control|headers\(\)\.set\(['"]cache-control/.test(text)) {
        const line = text.split('\n').findIndex(l => l.includes('export async function GET')) + 1;
        hits.push({ rule: 'api-no-cache-control', file: f.path, line, message: 'API route missing explicit caching. Add Cache-Control or revalidate where appropriate.' });
      }
    }
  }
  return hits;
}
