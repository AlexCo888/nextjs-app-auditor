import { Project, SyntaxKind } from 'ts-morph';

export type CodeChunk = {
  id: string;
  file: string;
  kind: 'function' | 'class' | 'module' | 'component' | 'code';
  name?: string;
  text: string;
  startLine: number;
  endLine: number;
};

export function buildCodeGraph(files: { path: string; content?: Buffer; isBinary: boolean }[]): CodeChunk[] {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: true } });
  for (const f of files) {
    if (f.isBinary || !f.content) continue;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f.path)) continue;
    project.createSourceFile(f.path, f.content.toString('utf-8'), { overwrite: true });
  }
  const chunks: CodeChunk[] = [];
  for (const sf of project.getSourceFiles()) {
    const sourceText = sf.getFullText();
    const add = (kind: CodeChunk['kind'], name: string | undefined, start: number, end: number) => {
      const startLine = sf.getLineAndColumnAtPos(start).line;
      const endLine = sf.getLineAndColumnAtPos(end).line;
      const text = sourceText.slice(start, end);
      const id = `${sf.getBaseName()}:${startLine}-${endLine}`;
      chunks.push({ id, file: sf.getFilePath(), kind, name, text, startLine, endLine });
    };

    sf.forEachDescendant(node => {
      if (node.getKind() === SyntaxKind.FunctionDeclaration) {
        const n: any = node;
        add('function', n.getName?.(), n.getStart(), n.getEnd());
      }
      if (node.getKind() === SyntaxKind.ClassDeclaration) {
        const n: any = node;
        add('class', n.getName?.(), n.getStart(), n.getEnd());
      }
      if (node.getKind() === SyntaxKind.VariableStatement) {
        // Capture React component-ish const Foo = () => { ... }
        const text = node.getText();
        if (/=\s*\(?\s*[\w]*\s*=>|function\s*\(/.test(text) && text.length > 80) {
          add('component', undefined, node.getStart(), node.getEnd());
        }
      }
    });

    // Fallback: big file segment
    if (chunks.filter(c => c.file === sf.getFilePath()).length === 0) {
      const text = sf.getFullText();
      const endLine = sf.getLineAndColumnAtPos(sf.getEnd()).line;
      const id = `${sf.getBaseName()}:1-${endLine}`;
      chunks.push({ id, file: sf.getFilePath(), kind: 'code', text, startLine: 1, endLine });
    }
  }
  return chunks;
}
