import { prisma } from '@/lib/db/prisma';
import { ScanResult } from '@/lib/ai/agents/types';

/**
 * Cache utilities for SHA-based scan result caching
 * Enables instant results for repeated scans of the same commit
 */

export type CacheOptions = {
  maxAge?: number; // Maximum age in milliseconds (default: 7 days)
  forceRefresh?: boolean; // Skip cache and force new scan
};

/**
 * Check if a scan exists for the given repo and commit SHA
 * Cache key includes: owner + repo + commitSha + provider + model
 * This ensures different models produce fresh results
 */
export async function getCachedScan(
  owner: string,
  repo: string,
  commitSha: string | null | undefined,
  provider: string,
  model: string,
  options: CacheOptions = {}
): Promise<ScanResult | null> {
  if (!commitSha || options.forceRefresh) {
    return null;
  }

  try {
    // Find repo
    const repoRecord = await prisma.repo.findUnique({
      where: { owner_name: { owner, name: repo } }
    });

    if (!repoRecord) {
      return null;
    }

    const maxAge = options.maxAge ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
    const cutoffDate = new Date(Date.now() - maxAge);

    // Find most recent scan for this commit + provider + model combination
    const scan = await prisma.scan.findFirst({
      where: {
        repoId: repoRecord.id,
        commitSha: commitSha,
        provider: provider,
        model: model,
        createdAt: {
          gte: cutoffDate
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        issues: true,
        repo: true
      }
    });

    if (!scan) {
      return null;
    }

    console.log('[cache] Hit! Found cached scan', {
      scanId: scan.id,
      commitSha,
      provider,
      model,
      age: Date.now() - scan.createdAt.getTime(),
      issueCount: scan.issues.length
    });

    // Reconstruct ScanResult from database
    const result: ScanResult = {
      repo: {
        owner: scan.repo.owner,
        repo: scan.repo.name,
        ref: scan.repo.ref ?? undefined
      },
      startedAt: scan.startedAt.toISOString(),
      finishedAt: scan.finishedAt.toISOString(),
      stats: scan.stats as Record<string, number>,
      issues: scan.issues.map(issue => ({
        id: issue.id,
        type: issue.type as any,
        severity: issue.severity as any,
        title: issue.title,
        description: issue.description,
        file: issue.file ?? undefined,
        line: issue.line ?? undefined,
        recommendation: issue.recommendation ?? undefined,
        codemod: issue.codemodName ? {
          name: issue.codemodName,
          command: issue.codemodCommand ?? '',
          description: issue.codemodCommand ?? ''
        } : undefined
      })),
      provider: scan.provider as 'vercel' | 'openrouter',
      model: scan.model ?? 'unknown',
      markdown: '', // Will be regenerated if needed
      warnings: []
    };

    return result;
  } catch (err) {
    console.error('[cache] Error retrieving cached scan:', err);
    return null;
  }
}

/**
 * Save a scan result to the database cache
 */
export async function cacheScanResult(
  result: ScanResult,
  commitSha: string | null | undefined
): Promise<void> {
  if (!commitSha) {
    console.log('[cache] Skipping cache save (no commit SHA)');
    return;
  }

  try {
    // Upsert repo
    const repoRecord = await prisma.repo.upsert({
      where: {
        owner_name: {
          owner: result.repo.owner,
          name: result.repo.repo
        }
      },
      create: {
        owner: result.repo.owner,
        name: result.repo.repo,
        ref: result.repo.ref
      },
      update: {
        ref: result.repo.ref
      }
    });

    // Create scan
    const scanRecord = await prisma.scan.create({
      data: {
        repoId: repoRecord.id,
        commitSha: commitSha,
        startedAt: new Date(result.startedAt),
        finishedAt: new Date(result.finishedAt),
        stats: result.stats,
        provider: result.provider,
        model: result.model,
        issues: {
          create: result.issues.map(issue => ({
            type: issue.type,
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            file: issue.file,
            line: issue.line,
            recommendation: issue.recommendation,
            codemodName: issue.codemod?.name,
            codemodCommand: issue.codemod?.command
          }))
        }
      }
    });

    console.log('[cache] Saved scan to database', {
      scanId: scanRecord.id,
      commitSha,
      issueCount: result.issues.length
    });
  } catch (err) {
    console.error('[cache] Error saving scan to database:', err);
    // Don't throw - caching is optional
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    const [totalScans, totalIssues, repoCount] = await Promise.all([
      prisma.scan.count(),
      prisma.issue.count(),
      prisma.repo.count()
    ]);

    return {
      totalScans,
      totalIssues,
      repoCount,
      avgIssuesPerScan: totalScans > 0 ? totalIssues / totalScans : 0
    };
  } catch (err) {
    console.error('[cache] Error getting cache stats:', err);
    return null;
  }
}

/**
 * Clear old cached scans (cleanup utility)
 */
export async function clearOldScans(olderThan: number = 30 * 24 * 60 * 60 * 1000) {
  try {
    const cutoffDate = new Date(Date.now() - olderThan);
    
    const deleted = await prisma.scan.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    console.log('[cache] Cleared old scans', {
      deletedCount: deleted.count,
      olderThan: `${olderThan / (24 * 60 * 60 * 1000)} days`
    });

    return deleted.count;
  } catch (err) {
    console.error('[cache] Error clearing old scans:', err);
    return 0;
  }
}
