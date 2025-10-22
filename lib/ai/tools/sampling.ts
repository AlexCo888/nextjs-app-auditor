import micromatch from 'micromatch';
import { RuleHit } from './heuristics';

export type FileWithPriority = {
  path: string;
  content?: Buffer;
  isBinary: boolean;
  priority: number;
  reason: string;
};

/**
 * Intelligent file sampling strategy that prioritizes:
 * 1. Files flagged by heuristics (security issues, patterns)
 * 2. Entry points (API routes, page components)
 * 3. Critical infrastructure (auth, payments, data access)
 * 4. Large/complex files (likely to have issues)
 * 5. Stratified sampling across file types
 */
export function intelligentSampling(
  files: { path: string; content?: Buffer; isBinary: boolean }[],
  heuristics: RuleHit[],
  maxFiles = 50
): FileWithPriority[] {
  const scored: FileWithPriority[] = [];

  // Create a set of files flagged by heuristics
  const flaggedFiles = new Set(heuristics.map(h => h.file));

  for (const file of files) {
    if (file.isBinary || !file.content) continue;

    let priority = 0;
    const reasons: string[] = [];

    // Priority 1: Flagged by heuristics (10 points)
    if (flaggedFiles.has(file.path)) {
      priority += 10;
      reasons.push('heuristic-hit');
    }

    // Priority 2: API routes and server actions (8 points)
    if (micromatch.isMatch(file.path, ['**/app/**/route.ts', '**/app/**/route.js', '**/pages/api/**/*'])) {
      priority += 8;
      reasons.push('api-route');
    }

    // Priority 3: Page components (7 points)
    if (micromatch.isMatch(file.path, ['**/app/**/page.tsx', '**/app/**/page.jsx', '**/pages/**/*.tsx'])) {
      priority += 7;
      reasons.push('page-component');
    }

    // Priority 4: Layout components (6 points)
    if (micromatch.isMatch(file.path, ['**/app/**/layout.tsx', '**/app/**/layout.jsx', '**/app/layout.*'])) {
      priority += 6;
      reasons.push('layout');
    }

    // Priority 5: Auth/Security files (9 points)
    if (micromatch.isMatch(file.path, ['**/*auth*', '**/*login*', '**/*password*', '**/*token*', '**/*session*'], { nocase: true })) {
      priority += 9;
      reasons.push('auth-security');
    }

    // Priority 6: Data access/DB files (7 points)
    if (micromatch.isMatch(file.path, ['**/prisma/**/*', '**/lib/db/**/*', '**/*database*', '**/*query*'], { nocase: true })) {
      priority += 7;
      reasons.push('data-access');
    }

    // Priority 7: Middleware (8 points)
    if (micromatch.isMatch(file.path, ['**/middleware.ts', '**/middleware.js', '**/_middleware.*'])) {
      priority += 8;
      reasons.push('middleware');
    }

    // Priority 8: Configuration files (5 points)
    if (micromatch.isMatch(file.path, ['**/next.config.*', '**/tailwind.config.*', '**/tsconfig.json'])) {
      priority += 5;
      reasons.push('config');
    }

    // Priority 9: Large files (may have complexity) - up to 5 points
    const sizeKb = file.content.length / 1024;
    if (sizeKb > 10) {
      const sizeBonus = Math.min(5, Math.floor(sizeKb / 10));
      priority += sizeBonus;
      if (sizeBonus > 0) reasons.push(`large-file-${Math.floor(sizeKb)}kb`);
    }

    // Priority 10: Lib/utils (4 points)
    if (micromatch.isMatch(file.path, ['**/lib/**/*.ts', '**/utils/**/*.ts'])) {
      priority += 4;
      reasons.push('lib-util');
    }

    // Priority 11: Components (3 points)
    if (micromatch.isMatch(file.path, ['**/components/**/*.tsx', '**/components/**/*.jsx'])) {
      priority += 3;
      reasons.push('component');
    }

    scored.push({
      ...file,
      priority,
      reason: reasons.join(',') || 'standard'
    });
  }

  // Sort by priority descending
  scored.sort((a, b) => b.priority - a.priority);

  // Stratified sampling: ensure diversity of file types
  const selected: FileWithPriority[] = [];
  const typeQuotas: Record<string, number> = {
    'api-route': Math.floor(maxFiles * 0.25),      // 25% API routes
    'page-component': Math.floor(maxFiles * 0.20), // 20% pages
    'auth-security': Math.floor(maxFiles * 0.15),  // 15% auth
    'data-access': Math.floor(maxFiles * 0.10),    // 10% data
    'middleware': 2,                                // At least 2 middleware
    'layout': 2,                                    // At least 2 layouts
    'heuristic-hit': Infinity                       // Always include flagged files
  };

  // First pass: fill quotas for high-priority types
  for (const file of scored) {
    if (selected.length >= maxFiles) break;
    
    const primaryType = file.reason.split(',')[0];
    const quota = typeQuotas[primaryType] ?? 0;
    const currentCount = selected.filter(f => f.reason.includes(primaryType)).length;
    
    if (currentCount < quota) {
      selected.push(file);
    }
  }

  // Second pass: fill remaining slots with highest priority files
  for (const file of scored) {
    if (selected.length >= maxFiles) break;
    if (!selected.includes(file)) {
      selected.push(file);
    }
  }

  console.log('[sampling] Selected files:', {
    total: files.length,
    sampled: selected.length,
    distribution: selected.reduce((acc, f) => {
      const type = f.reason.split(',')[0];
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });

  return selected.slice(0, maxFiles);
}
