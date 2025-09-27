export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="en">
<body className="min-h-screen antialiased">
<div className="mx-auto max-w-6xl p-6">
<header className="mb-6">
<h1 className="text-2xl font-bold">AccessMate Dashboard</h1>
<p className="text-sm text-gray-600">Runs, findings, and PRs</p>
</header>
{children}
</div>
</body>
</html>
);
}