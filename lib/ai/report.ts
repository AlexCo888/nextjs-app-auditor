import { Issue, ScanResult } from '@/lib/ai/agents/types';

function formatIssue(issue: Issue, index: number): string {
  const lines: string[] = [];
  lines.push(`### ${index + 1}. ${issue.title}`);
  lines.push(`- **Type:** ${issue.type}`);
  lines.push(`- **Severity:** ${issue.severity}`);
  if (issue.file) {
    const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
    lines.push(`- **Location:** ${location}`);
  }
  if (issue.evidence && issue.evidence.length > 0) {
    lines.push(`- **Evidence:** ${issue.evidence.join('; ')}`);
  }
  lines.push('');
  if (issue.description) {
    lines.push(issue.description.trim());
    lines.push('');
  }
  if (issue.recommendation) {
    lines.push(`**Recommendation:** ${issue.recommendation.trim()}`);
    lines.push('');
  }
  if (issue.docs && issue.docs.length > 0) {
    lines.push('**References:**');
    for (const doc of issue.docs) {
      lines.push(`- [${doc.title}](${doc.url})`);
    }
    lines.push('');
  }
  if (issue.codemod) {
    lines.push('**Suggested Codemod:**');
    lines.push('');
    lines.push('```bash');
    lines.push(issue.codemod.command);
    lines.push('```');
    if (issue.codemod.description) {
      lines.push('');
      lines.push(issue.codemod.description.trim());
    }
    lines.push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function buildMarkdownReport(result: ScanResult): string {
  const { repo, stats, provider, model, openrouterProvider, issues, warnings } = result;
  const lines: string[] = [];

  lines.push(`# Audit Report: ${repo.owner}/${repo.repo}`);
  lines.push('');
  lines.push(`- **Reference:** ${repo.ref ?? 'HEAD'}`);
  lines.push(`- **Started:** ${new Date(result.startedAt).toLocaleString()}`);
  lines.push(`- **Finished:** ${new Date(result.finishedAt).toLocaleString()}`);
  lines.push(`- **Provider:** ${provider}`);
  lines.push(`- **Model:** ${model}${openrouterProvider ? ` (${openrouterProvider})` : ''}`);
  lines.push('');
  lines.push('## Repository Stats');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | ---: |');
  for (const [key, value] of Object.entries(stats)) {
    lines.push(`| ${key} | ${value} |`);
  }
  lines.push('');

  if (warnings && warnings.length > 0) {
    lines.push('> **Warnings:**');
    for (const warn of warnings) {
      lines.push(`> - ${warn}`);
    }
    lines.push('');
  }

  if (issues.length === 0) {
    lines.push('## Findings');
    lines.push('');
    lines.push('No issues were detected in the analysed samples. Consider increasing sampling parameters or rerunning if this is unexpected.');
    return lines.join('\n');
  }

  const order: Issue['type'][] = ['security', 'performance', 'backend', 'ux', 'db', 'lint', 'general'];
  const grouped = new Map<Issue['type'], Issue[]>();
  for (const issue of issues) {
    const bucket = grouped.get(issue.type) ?? [];
    bucket.push(issue);
    grouped.set(issue.type, bucket);
  }

  lines.push('## Findings');
  lines.push('');

  const sortedTypes = Array.from(grouped.keys()).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  for (const type of sortedTypes) {
    const list = grouped.get(type) ?? [];
    if (list.length === 0) continue;
    lines.push(`### ${type.toUpperCase()} (${list.length})`);
    lines.push('');
    list.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
    list.forEach((issue, idx) => {
      lines.push(formatIssue(issue, idx));
      lines.push('');
    });
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function severityRank(severity: Issue['severity']): number {
  switch (severity) {
    case 'critical': return 5;
    case 'high': return 4;
    case 'medium': return 3;
    case 'low': return 2;
    case 'info': return 1;
    default: return 0;
  }
}
