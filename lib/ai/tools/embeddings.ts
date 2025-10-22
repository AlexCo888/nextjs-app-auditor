import { ai } from '@/lib/ai/provider';

export async function embedChunks(chunks: { id: string; text: string }[]) {
  const values = chunks.map(c => c.text.slice(0, 8192)); // clip overly long
  const { embeddings } = await ai.embedMany({
    model: 'openai/text-embedding-3-small',
    values
  });
  return embeddings;
}

export function cosine(a: number[], b: number[]) {
  let dot = 0, na=0, nb=0;
  for (let i=0;i<a.length;i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
