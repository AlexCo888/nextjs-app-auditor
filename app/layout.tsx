import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Next.js Audit App',
  description: 'AI-powered auditing for Next.js App Router repos'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="container flex items-center justify-between py-3">
            <Link href="/" className="font-semibold">Next.js Audit</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/dashboard">Dashboard</Link>
              <a href="https://developers.openai.com/apps-sdk/" target="_blank" rel="noreferrer">Apps SDK</a>
              <a href="https://vercel.com/docs/ai-sdk" target="_blank" rel="noreferrer">AI SDK</a>
            </nav>
          </div>
        </header>
        <main className="container py-6">{children}</main>
      </body>
    </html>
  );
}
