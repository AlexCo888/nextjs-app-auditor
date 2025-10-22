export default function Dashboard() {
  return (
    <div className="grid gap-3">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-sm text-muted">Connect your GitHub account to see recent audits, run periodic scans, and triage issues.</p>
      <div className="text-sm">This sample implements ad‑hoc scans via the home page. Production deployments should enable Postgres and Prisma migrations, then wire OAuth or a GitHub App.</div>
    </div>
  );
}
