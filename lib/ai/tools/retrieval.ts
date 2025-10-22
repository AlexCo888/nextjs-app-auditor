import { cosine } from './embeddings';

export function topK(
  queryEmbedding: number[],
  items: { id: string; embedding: number[] }[],
  k = 8
) {
  const scored = items.map(it => ({ id: it.id, score: cosine(queryEmbedding, it.embedding) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
