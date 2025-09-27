import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'AccessMate Dashboard',
  description: 'Monitor accessibility runs, findings, and remediation PRs.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          <header className="rounded-2xl bg-white/70 p-6 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <h1 className="text-3xl font-semibold tracking-tight text-brand-700">AccessMate Dashboard</h1>
              <p className="text-sm text-slate-600">Runs, findings, and PRs at a glance</p>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
