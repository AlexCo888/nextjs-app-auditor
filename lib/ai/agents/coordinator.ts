import { uiuxAgentAnalyze } from './uiuxAgent';
import { backendAgentAnalyze } from './backendAgent';
import { dbAgentAnalyze } from './dbAgent';
import { securityAgentAnalyze } from './securityAgent';
import { perfAgentAnalyze } from './perfAgent';
import { lintAgentAnalyze } from './lintAgent';
import { codemodAgentPlan } from './codemodAgent';
import { buildCodeGraph } from '@/lib/ai/tools/codegraph';
import { runHeuristics } from '@/lib/ai/tools/heuristics';
import { intelligentSampling } from '@/lib/ai/tools/sampling';
import { RepoRef, Issue, ScanResult } from './types';
import { getAIProvider, setAIProvider, getDefaultModelForProvider, getOpenRouterProvider } from '@/lib/ai/provider';
import { buildMarkdownReport } from '@/lib/ai/report';
import { ProgressStream, calculateProgress } from '@/lib/ai/tools/streaming';
import pLimit from 'p-limit';

export async function runFullAudit(input: {
  repo: RepoRef,
  files: { path: string; content?: Buffer; isBinary: boolean }[],
  prismaSchema?: string,
  provider?: 'vercel' | 'openrouter',
  progressStream?: ProgressStream
}): Promise<ScanResult> {
  const targetProvider = input.provider ?? 'vercel';
  const prevProvider = getAIProvider();
  setAIProvider(targetProvider);
  try {
    const startedAt = new Date().toISOString();
    const modelId = getDefaultModelForProvider(targetProvider);
    const routerProvider = targetProvider === 'openrouter' ? getOpenRouterProvider() : null;
    const progress = input.progressStream;
    
    progress?.stage('initializing', 5, 'Starting audit...', {
      totalFiles: input.files.length
    });
    
    // Run heuristics first (fast, on all files)
    progress?.stage('heuristics', calculateProgress('heuristics', 0), 'Running security heuristics...');
    const heuristics = runHeuristics(input.files);
    progress?.stage('heuristics', calculateProgress('heuristics', 100), `Found ${heuristics.length} heuristic matches`);
    
    // Intelligent sampling: select high-priority files to analyze
    progress?.stage('sampling', calculateProgress('sampling', 0), 'Selecting high-priority files...');
    // Use all files if total is reasonable, otherwise use intelligent sampling
    // For full audit: set to input.files.length
    // For balanced: 100-200 files
    // For fast: 50 files
    const samplingLimit = input.files.length <= 900 ? input.files.length : 900;
    const sampledFiles = intelligentSampling(input.files, heuristics, samplingLimit);
    console.log(`[coordinator] Sampled ${sampledFiles.length} files from ${input.files.length} total (limit: ${samplingLimit})`);
    progress?.stage('sampling', calculateProgress('sampling', 100), `Selected ${sampledFiles.length} files for analysis`);
    
    // Build code graph only for sampled files (100x faster)
    progress?.stage('parsing', calculateProgress('parsing', 0), 'Parsing code with ts-morph...');
    const chunks = buildCodeGraph(sampledFiles);
    const sampleChunks = chunks;
    const sampleTexts = sampleChunks.map(c => `// ${c.file}:${c.startLine}-${c.endLine}\n${c.text}`);
    progress?.stage('parsing', calculateProgress('parsing', 100), `Created ${chunks.length} code chunks`, {
      chunksCreated: chunks.length
    });

    // Context7 docs (optional)
    let docsSnippets: any[] = [];
    try {
      const { getContext7Docs } = await import('@/lib/context7/client');
      const libs = ['Next.js', 'Vercel AI SDK', targetProvider === 'openrouter' ? 'OpenRouter API' : 'OpenAI Apps SDK'];
      for (const lib of libs) {
        const list = await getContext7Docs(lib);
        docsSnippets.push(...list.slice(0, 5));
      }
    } catch {}

    const summary = `Files: ${input.files.length}, Chunks:${chunks.length}, Heuristics:${heuristics.length}`;

    // Fan out to agents in parallel with concurrency control
    progress?.stage('analyzing', calculateProgress('analyzing', 0), 'Running AI agents in parallel...', {
      totalAgents: 6,
      agentsComplete: 0
    });
    
    const limit = pLimit(3);
    let completedAgents = 0;
    
    const agentWrapper = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      try {
        const result = await fn();
        completedAgents++;
        progress?.stage('analyzing', calculateProgress('analyzing', (completedAgents / 6) * 100), 
          `Completed ${name} agent (${completedAgents}/6)`, {
          totalAgents: 6,
          agentsComplete: completedAgents,
          currentAgent: name
        });
        return result;
      } catch (err: any) {
        console.error(`[coordinator] ${name} agent failed:`, err);
        completedAgents++;
        
        // Fallback: Try to extract JSON from markdown-wrapped response
        if (err?.cause?.text || err?.text) {
          const text = err.cause?.text || err.text;
          console.log(`[coordinator] Attempting to unwrap markdown from ${name} agent...`);
          
          try {
            // Remove markdown code block wrappers (```json ... ``` or ``` ... ```)
            let cleaned = text.trim();
            if (cleaned.startsWith('```')) {
              cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
            }
            
            // Try to parse the cleaned JSON
            const parsed = JSON.parse(cleaned);
            console.log(`[coordinator] Successfully unwrapped ${name} agent response`);
            completedAgents--;  // Undo the increment since we're retrying
            return parsed as T;
          } catch (parseErr) {
            console.error(`[coordinator] Failed to unwrap ${name} agent response:`, parseErr);
          }
        }
        
        throw err;
      }
    };
    
    const [uxJson, beJson, dbJson, secJson, perfJson, lintJson] = await Promise.all([
      limit(() => agentWrapper('UI/UX', () => uiuxAgentAnalyze({ summary, codeSamples: sampleTexts }))),
      limit(() => agentWrapper('Backend', () => backendAgentAnalyze({ summary, codeSamples: sampleTexts }))),
      limit(() => agentWrapper('Database', () => dbAgentAnalyze({ summary, schema: input.prismaSchema ?? '' }))),
      limit(() => agentWrapper('Security', () => securityAgentAnalyze({ summary, ruleHits: heuristics.map(h => `${h.rule} ${h.file}:${h.line}`) }))),
      limit(() => agentWrapper('Performance', () => perfAgentAnalyze({ summary, codeSamples: sampleTexts }))),
      limit(() => agentWrapper('Lint', () => lintAgentAnalyze({
        list: sampleChunks.map(c => ({
          file: c.file,
          text: c.text
        }))
      })))
    ]);

    // Parse agent outputs (supports both structured objects and legacy text)
    progress?.stage('synthesizing', calculateProgress('synthesizing', 0), 'Processing agent results...');
    const warnings: string[] = [];
    
    function normalizeAgentOutput(agent: string, raw: unknown): unknown[] {
      // If already an array (structured output), return it
      if (Array.isArray(raw)) {
        return raw;
      }
      
      // Legacy text output - parse as JSON
      if (typeof raw !== 'string' || !raw || raw.trim().length === 0) {
        warnings.push(`${agent}: empty response from model`);
        return [];
      }
      
      const attempts: { label: string; text: string }[] = [];
      const trimmed = raw.trim();
      attempts.push({ label: 'raw', text: trimmed });
      const start = trimmed.indexOf('[');
      const end = trimmed.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        const slice = trimmed.slice(start, end + 1);
        if (slice !== trimmed) attempts.push({ label: 'array-slice', text: slice });
      }
      
      let lastError: Error | null = null;
      for (const attempt of attempts) {
        try {
          const parsed = JSON.parse(attempt.text);
          if (Array.isArray(parsed)) {
            if (attempt.label !== 'raw') {
              warnings.push(`${agent}: parsed after ${attempt.label} extraction`);
            }
            return parsed;
          }
          warnings.push(`${agent}: parsed JSON was not an array (received ${typeof parsed})`);
          return [];
        } catch (err) {
          lastError = err as Error;
        }
      }
      warnings.push(`${agent}: failed to parse JSON (${lastError?.message ?? 'unknown error'})`);
      console.warn(`[coordinator] Failed to parse ${agent} response`, typeof raw === 'string' ? trimmed.slice(0, 500) : raw);
      return [];
    }
    
    const issues: Issue[] = [];
    for (const [type, raw] of [['ux', uxJson], ['backend', beJson], ['db', dbJson], ['security', secJson], ['performance', perfJson], ['lint', lintJson]] as const) {
      const arr = normalizeAgentOutput(type, raw);
      for (const it of arr) {
        const severity = (it as { severity?: string }).severity ?? 'medium';
        issues.push({
          id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
          type: type as Issue['type'],
          severity: (severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low' || severity === 'info') ? severity : 'medium',
          title: (it as { title?: string }).title ?? 'Issue',
          description: (it as { description?: string }).description ?? '',
          recommendation: (it as { recommendation?: string }).recommendation,
          docs: (it as { docs?: { title: string; url: string }[] }).docs
        });
      }
    }

    // Codemod planner

    // Attach some docs to each issue if available
    if (docsSnippets.length > 0) {
      for (const issue of issues) {
        issue.docs = (issue.docs ?? []).concat(
          docsSnippets.slice(0, 3).map((d: any) => ({ title: d.title, url: d.url }))
        );
      }
    }

    const codemodsJson = await codemodAgentPlan({ issues });
    const codemods = normalizeAgentOutput('codemod', codemodsJson);
    for (const cm of codemods) {
      const codemodData = cm as { issueTitle?: string; codemod?: { name: string; command: string; description: string; transform?: string } };
      if (codemodData.issueTitle && codemodData.codemod) {
        const idx = issues.findIndex(i => i.title === codemodData.issueTitle);
        if (idx >= 0) {
          issues[idx].codemod = codemodData.codemod;
        }
      }
    }

    if (warnings.length > 0) {
      issues.push({
        id: `general-${Math.random().toString(36).slice(2, 8)}`,
        type: 'general',
        severity: 'low',
        title: 'Agent response warnings',
        description: warnings.join('; '),
        recommendation: 'Review model outputs or rerun the audit after the provider stabilises.'
      });
    }

    progress?.stage('synthesizing', calculateProgress('synthesizing', 100), 
      `Found ${issues.length} issues`, {
      issuesFound: issues.length
    });
    
    const finishedAt = new Date().toISOString();
    const result: ScanResult = {
      repo: input.repo,
      startedAt, finishedAt,
      stats: {
        files: input.files.length,
        chunks: chunks.length,
        heuristics: heuristics.length,
        agents: 6,
        sampledFiles: sampledFiles.length
      },
      issues,
      provider: targetProvider,
      model: modelId,
      openrouterProvider: routerProvider,
      markdown: '',
      warnings
    };
    
    result.markdown = buildMarkdownReport(result);
    
    progress?.complete('Audit complete!', {
      issues: issues.slice(0, 10), // Send first 10 for preview
      stats: result.stats
    });
    
    return result;
  } finally {
    setAIProvider(prevProvider);
  }
}
