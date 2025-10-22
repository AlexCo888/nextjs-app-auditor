import { prisma } from '@/lib/db/prisma';
import { embedChunks, cosine } from './embeddings';
import { CodeChunk } from './codegraph';

/**
 * Vector database utilities for semantic code search with pgvector
 * Enables agents to query: "Find all authentication handlers" and get relevant code
 */

export type VectorChunk = {
  id: string;
  repoOwner: string;
  repoName: string;
  file: string;
  startLine: number;
  endLine: number;
  text: string;
  embedding: number[];
  similarity?: number;
};

/**
 * Store code chunks with embeddings in pgvector
 */
export async function storeChunksWithEmbeddings(
  chunks: CodeChunk[],
  repoOwner: string,
  repoName: string
): Promise<number> {
  if (chunks.length === 0) return 0;

  try {
    // Generate embeddings for all chunks
    const embeddings = await embedChunks(chunks);
    
    // Store in database using raw SQL for pgvector support
    const values = chunks.map((chunk, idx) => {
      const embedding = embeddings[idx];
      return `(
        '${chunk.id.replace(/'/g, "''")}',
        '${repoOwner.replace(/'/g, "''")}',
        '${repoName.replace(/'/g, "''")}',
        '${chunk.file.replace(/'/g, "''")}',
        ${chunk.startLine},
        ${chunk.endLine},
        '[${embedding.join(',')}]'::vector
      )`;
    }).join(',\n');

    const sql = `
      INSERT INTO code_chunks (id, repo_owner, repo_name, file, start_line, end_line, embedding)
      VALUES ${values}
      ON CONFLICT (id) DO UPDATE SET
        embedding = EXCLUDED.embedding,
        file = EXCLUDED.file,
        start_line = EXCLUDED.start_line,
        end_line = EXCLUDED.end_line
    `;

    await prisma.$executeRawUnsafe(sql);
    
    console.log('[vectors] Stored embeddings', {
      owner: repoOwner,
      repo: repoName,
      chunks: chunks.length
    });

    return chunks.length;
  } catch (err) {
    console.error('[vectors] Error storing embeddings:', err);
    return 0;
  }
}

/**
 * Semantic search for code chunks using natural language queries
 */
export async function semanticSearch(
  query: string,
  repoOwner?: string,
  repoName?: string,
  limit: number = 10
): Promise<VectorChunk[]> {
  try {
    // Generate embedding for query
    const { embeddings } = await embedChunks([{ id: 'query', text: query }]);
    const queryEmbedding = embeddings[0];

    // Build WHERE clause for repo filtering
    let whereClause = '';
    if (repoOwner && repoName) {
      whereClause = `WHERE repo_owner = '${repoOwner.replace(/'/g, "''")}' AND repo_name = '${repoName.replace(/'/g, "''")}'`;
    } else if (repoOwner) {
      whereClause = `WHERE repo_owner = '${repoOwner.replace(/'/g, "''")}'`;
    }

    // Perform vector similarity search
    const sql = `
      SELECT 
        id,
        repo_owner,
        repo_name,
        file,
        start_line,
        end_line,
        1 - (embedding <=> '[${queryEmbedding.join(',')}]'::vector) as similarity
      FROM code_chunks
      ${whereClause}
      ORDER BY embedding <=> '[${queryEmbedding.join(',')}]'::vector
      LIMIT ${limit}
    `;

    const results: any[] = await prisma.$queryRawUnsafe(sql);

    console.log('[vectors] Semantic search', {
      query: query.substring(0, 50),
      results: results.length,
      topSimilarity: results[0]?.similarity
    });

    return results.map(r => ({
      id: r.id,
      repoOwner: r.repo_owner,
      repoName: r.repo_name,
      file: r.file,
      startLine: r.start_line,
      endLine: r.end_line,
      text: '', // Text not stored in vector DB, fetch separately if needed
      embedding: [],
      similarity: parseFloat(r.similarity)
    }));
  } catch (err) {
    console.error('[vectors] Semantic search error:', err);
    return [];
  }
}

/**
 * Find similar code chunks (useful for detecting duplicates or patterns)
 */
export async function findSimilarChunks(
  chunkId: string,
  limit: number = 5
): Promise<VectorChunk[]> {
  try {
    // Get the chunk's embedding
    const chunk: any = await prisma.$queryRawUnsafe(`
      SELECT embedding FROM code_chunks WHERE id = '${chunkId.replace(/'/g, "''")}'
    `);

    if (!chunk || !chunk[0]) {
      return [];
    }

    // Find similar chunks
    const results: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        id,
        repo_owner,
        repo_name,
        file,
        start_line,
        end_line,
        1 - (embedding <=> embedding) as similarity
      FROM code_chunks
      WHERE id != '${chunkId.replace(/'/g, "''")}'
      ORDER BY embedding <=> (SELECT embedding FROM code_chunks WHERE id = '${chunkId.replace(/'/g, "''")}')
      LIMIT ${limit}
    `);

    return results.map(r => ({
      id: r.id,
      repoOwner: r.repo_owner,
      repoName: r.repo_name,
      file: r.file,
      startLine: r.start_line,
      endLine: r.end_line,
      text: '',
      embedding: [],
      similarity: parseFloat(r.similarity)
    }));
  } catch (err) {
    console.error('[vectors] Find similar error:', err);
    return [];
  }
}

/**
 * Delete embeddings for a specific repo (cleanup)
 */
export async function deleteRepoEmbeddings(
  repoOwner: string,
  repoName: string
): Promise<number> {
  try {
    const result: any = await prisma.$executeRawUnsafe(`
      DELETE FROM code_chunks 
      WHERE repo_owner = '${repoOwner.replace(/'/g, "''")}' 
      AND repo_name = '${repoName.replace(/'/g, "''")}'
    `);

    console.log('[vectors] Deleted repo embeddings', {
      owner: repoOwner,
      repo: repoName,
      deleted: result
    });

    return result;
  } catch (err) {
    console.error('[vectors] Delete error:', err);
    return 0;
  }
}

/**
 * Get vector database statistics
 */
export async function getVectorStats() {
  try {
    const stats: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_chunks,
        COUNT(DISTINCT (repo_owner || '/' || repo_name)) as unique_repos,
        pg_size_pretty(pg_total_relation_size('code_chunks')) as table_size
      FROM code_chunks
    `);

    return {
      totalChunks: parseInt(stats[0]?.total_chunks || '0'),
      uniqueRepos: parseInt(stats[0]?.unique_repos || '0'),
      tableSize: stats[0]?.table_size || '0 bytes'
    };
  } catch (err) {
    console.error('[vectors] Stats error:', err);
    return null;
  }
}

/**
 * Initialize pgvector extension and tables (run once during setup)
 */
export async function initializeVectorDB() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS code_chunks (
        id TEXT PRIMARY KEY,
        repo_owner TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        file TEXT NOT NULL,
        start_line INT NOT NULL,
        end_line INT NOT NULL,
        embedding vector(1536) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS code_chunks_embedding_hnsw 
      ON code_chunks USING hnsw (embedding vector_cosine_ops)
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS code_chunks_repo_idx 
      ON code_chunks (repo_owner, repo_name)
    `);

    console.log('[vectors] Vector database initialized');
    return true;
  } catch (err) {
    console.error('[vectors] Initialization error:', err);
    return false;
  }
}
