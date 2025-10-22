/**
 * Progress streaming utilities for real-time audit feedback
 */

export type ProgressStage = 
  | 'initializing'
  | 'downloading'
  | 'extracting'
  | 'sampling'
  | 'parsing'
  | 'heuristics'
  | 'analyzing'
  | 'synthesizing'
  | 'complete'
  | 'error';

export type ProgressUpdate = {
  stage: ProgressStage;
  progress: number; // 0-100
  message: string;
  details?: {
    filesProcessed?: number;
    totalFiles?: number;
    chunksCreated?: number;
    issuesFound?: number;
    currentAgent?: string;
    agentsComplete?: number;
    totalAgents?: number;
  };
  partialResults?: {
    issues?: any[];
    stats?: any;
  };
  error?: string;
  timestamp: string;
};

export class ProgressStream {
  private callbacks: Set<(update: ProgressUpdate) => void> = new Set();

  subscribe(callback: (update: ProgressUpdate) => void) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  emit(update: Omit<ProgressUpdate, 'timestamp'>) {
    const fullUpdate: ProgressUpdate = {
      ...update,
      timestamp: new Date().toISOString()
    };
    
    this.callbacks.forEach(callback => {
      try {
        callback(fullUpdate);
      } catch (err) {
        console.error('[ProgressStream] Callback error:', err);
      }
    });
  }

  // Convenience methods
  stage(stage: ProgressStage, progress: number, message: string, details?: ProgressUpdate['details']) {
    this.emit({ stage, progress, message, details });
  }

  error(message: string, error: string) {
    this.emit({ stage: 'error', progress: 0, message, error });
  }

  complete(message: string, partialResults?: ProgressUpdate['partialResults']) {
    this.emit({ stage: 'complete', progress: 100, message, partialResults });
  }
}

/**
 * Create a streaming text encoder for Server-Sent Events
 */
export function createSSEStream() {
  const encoder = new TextEncoder();
  
  return new TransformStream({
    transform(chunk: ProgressUpdate, controller) {
      const data = `data: ${JSON.stringify(chunk)}\n\n`;
      controller.enqueue(encoder.encode(data));
    }
  });
}

/**
 * Helper to calculate overall progress from multiple stages
 */
export function calculateProgress(stage: ProgressStage, substageProgress: number = 0): number {
  const stageWeights: Record<ProgressStage, { start: number; weight: number }> = {
    initializing: { start: 0, weight: 5 },
    downloading: { start: 5, weight: 10 },
    extracting: { start: 15, weight: 10 },
    sampling: { start: 25, weight: 5 },
    parsing: { start: 30, weight: 10 },
    heuristics: { start: 40, weight: 5 },
    analyzing: { start: 45, weight: 40 },  // Longest stage
    synthesizing: { start: 85, weight: 10 },
    complete: { start: 100, weight: 0 },
    error: { start: 0, weight: 0 }
  };

  const { start, weight } = stageWeights[stage];
  return Math.min(100, start + (weight * substageProgress / 100));
}
