import { Project, SourceFile, SyntaxKind } from 'ts-morph';

/**
 * Import graph analysis for identifying hot files and dependency patterns
 * Helps prioritize which files to analyze based on their importance in the codebase
 */

export type ImportNode = {
  file: string;
  imports: string[]; // Files this file imports
  importedBy: string[]; // Files that import this file
  importCount: number; // Total number of imports (out-degree)
  importedByCount: number; // How many files import this (in-degree)
  score: number; // Importance score
};

export type ImportGraph = {
  nodes: Map<string, ImportNode>;
  hotFiles: string[]; // Files with high in-degree (imported by many)
  entryPoints: string[]; // Files with low in-degree but high out-degree
  isolatedFiles: string[]; // Files with no imports/exports
};

/**
 * Build an import dependency graph from source files
 */
export function buildImportGraph(
  files: { path: string; content?: Buffer; isBinary: boolean }[]
): ImportGraph {
  const project = new Project({ 
    useInMemoryFileSystem: true,
    compilerOptions: { 
      allowJs: true,
      moduleResolution: 99, // NodeNext
      resolveJsonModule: true
    }
  });

  // Add all files to project
  const sourceFiles: SourceFile[] = [];
  for (const f of files) {
    if (f.isBinary || !f.content) continue;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f.path)) continue;
    const sf = project.createSourceFile(f.path, f.content.toString('utf-8'), { overwrite: true });
    sourceFiles.push(sf);
  }

  const nodes = new Map<string, ImportNode>();

  // Initialize nodes
  for (const sf of sourceFiles) {
    const path = sf.getFilePath();
    nodes.set(path, {
      file: path,
      imports: [],
      importedBy: [],
      importCount: 0,
      importedByCount: 0,
      score: 0
    });
  }

  // Build import relationships
  for (const sf of sourceFiles) {
    const path = sf.getFilePath();
    const node = nodes.get(path)!;

    // Get all import declarations
    const importDecls = sf.getImportDeclarations();
    for (const importDecl of importDecls) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // Try to resolve the import
      const resolved = resolveImport(moduleSpecifier, path, sourceFiles);
      if (resolved) {
        node.imports.push(resolved);
        node.importCount++;

        const targetNode = nodes.get(resolved);
        if (targetNode) {
          targetNode.importedBy.push(path);
          targetNode.importedByCount++;
        }
      }
    }

    // Also check dynamic imports and require calls
    sf.forEachDescendant(node => {
      // import('...')
      if (node.getKind() === SyntaxKind.CallExpression) {
        const callExpr = node as any;
        const expr = callExpr.getExpression();
        if (expr.getText() === 'import' || expr.getText() === 'require') {
          const args = callExpr.getArguments();
          if (args.length > 0 && args[0].getKind() === SyntaxKind.StringLiteral) {
            const modulePath = args[0].getLiteralText();
            const resolved = resolveImport(modulePath, path, sourceFiles);
            if (resolved && !node.imports.includes(resolved)) {
              node.imports.push(resolved);
              node.importCount++;
              const targetNode = nodes.get(resolved);
              if (targetNode && !targetNode.importedBy.includes(path)) {
                targetNode.importedBy.push(path);
                targetNode.importedByCount++;
              }
            }
          }
        }
      }
    });
  }

  // Calculate importance scores
  // Score = (importedByCount * 2) + importCount
  // Files imported by many others are more important
  for (const node of nodes.values()) {
    node.score = (node.importedByCount * 2) + node.importCount;
  }

  // Identify hot files (high in-degree)
  const hotFiles = Array.from(nodes.values())
    .filter(n => n.importedByCount >= 3)
    .sort((a, b) => b.importedByCount - a.importedByCount)
    .slice(0, 20)
    .map(n => n.file);

  // Identify entry points (low in-degree, high out-degree)
  const entryPoints = Array.from(nodes.values())
    .filter(n => n.importedByCount <= 1 && n.importCount >= 3)
    .sort((a, b) => b.importCount - a.importCount)
    .slice(0, 10)
    .map(n => n.file);

  // Identify isolated files
  const isolatedFiles = Array.from(nodes.values())
    .filter(n => n.importCount === 0 && n.importedByCount === 0)
    .map(n => n.file);

  console.log('[importGraph] Analysis complete', {
    totalFiles: nodes.size,
    hotFiles: hotFiles.length,
    entryPoints: entryPoints.length,
    isolatedFiles: isolatedFiles.length
  });

  return {
    nodes,
    hotFiles,
    entryPoints,
    isolatedFiles
  };
}

/**
 * Resolve an import path to an absolute file path
 */
function resolveImport(
  moduleSpecifier: string,
  fromFile: string,
  sourceFiles: SourceFile[]
): string | null {
  // Skip node_modules and external imports
  if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
    return null;
  }

  // Simple resolution (doesn't handle all edge cases)
  const fromDir = fromFile.split('/').slice(0, -1).join('/');
  let resolved = moduleSpecifier;

  // Handle relative paths
  if (moduleSpecifier.startsWith('./') || moduleSpecifier.startsWith('../')) {
    const parts = fromDir.split('/');
    const importParts = moduleSpecifier.split('/');

    for (const part of importParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }

    resolved = parts.join('/');
  }

  // Try different extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (sourceFiles.some(sf => sf.getFilePath() === candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Get files sorted by importance (for prioritized analysis)
 */
export function getFilesByImportance(graph: ImportGraph, limit?: number): string[] {
  const sorted = Array.from(graph.nodes.values())
    .sort((a, b) => b.score - a.score)
    .map(n => n.file);

  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Find circular dependencies
 */
export function findCircularDependencies(graph: ImportGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(file: string, path: string[]): void {
    if (recursionStack.has(file)) {
      // Found a cycle
      const cycleStart = path.indexOf(file);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }

    if (visited.has(file)) {
      return;
    }

    visited.add(file);
    recursionStack.add(file);
    path.push(file);

    const node = graph.nodes.get(file);
    if (node) {
      for (const imported of node.imports) {
        dfs(imported, [...path]);
      }
    }

    recursionStack.delete(file);
  }

  for (const file of graph.nodes.keys()) {
    if (!visited.has(file)) {
      dfs(file, []);
    }
  }

  return cycles;
}

/**
 * Enhance sampling with import graph analysis
 */
export function enrichSamplingWithImportGraph(
  files: { path: string; content?: Buffer; isBinary: boolean }[],
  graph: ImportGraph,
  baseScore: Map<string, number>
): Map<string, number> {
  const enriched = new Map(baseScore);

  for (const file of files) {
    if (file.isBinary || !file.content) continue;

    const node = graph.nodes.get(file.path);
    if (node) {
      const currentScore = enriched.get(file.path) || 0;
      // Add importance score from import graph
      enriched.set(file.path, currentScore + node.score);
    }
  }

  return enriched;
}
