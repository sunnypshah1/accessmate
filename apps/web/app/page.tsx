export const revalidate = 0;

type RunSummary = {
  id: string;
  projectId: string;
  status: string;
  createdAt: string;
};

async function fetchRuns(): Promise<RunSummary[]> {
  const baseUrl = process.env.API_URL ?? 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}/v1/runs`, {
      cache: 'no-store',
      headers: { 'accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = (await response.json()) as { runs?: RunSummary[] };
    return data.runs ?? [];
  } catch (error) {
    console.error('Failed to load runs', error);
    return [];
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default async function Page() {
  const runs = await fetchRuns();

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <section>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Recent Analysis Runs</h1>
          <span className="text-sm text-gray-500">Showing {runs.length} run(s)</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          {runs.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
              No runs have been requested yet.
            </div>
          ) : (
            runs.map((run) => (
              <article key={run.id} className="rounded-xl border p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      {run.projectId}
                    </div>
                    <div className="font-mono text-lg">{run.id}</div>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <div className="font-medium capitalize">{run.status}</div>
                    <div>{formatDate(run.createdAt)}</div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}