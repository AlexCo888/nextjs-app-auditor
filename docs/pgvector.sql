-- Enable pgvector extension and create a simple chunks table
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS code_chunks (
  id TEXT PRIMARY KEY,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  file TEXT NOT NULL,
  start_line INT NOT NULL,
  end_line INT NOT NULL,
  embedding vector(1536) NOT NULL
);

-- HNSW index (requires pgvector >=0.5.0)
CREATE INDEX IF NOT EXISTS code_chunks_embedding_hnsw ON code_chunks USING hnsw (embedding vector_cosine_ops);
