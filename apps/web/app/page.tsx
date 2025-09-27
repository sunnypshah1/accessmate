export const revalidate = 0;

const API_BASE_URL = process.env.API_URL ?? 'http://localhost:3000';

type RunStatus = 'queued' | 'running' | 'complete' | 'failed';

type RunSummary = {
  id: string;
  projectId: string;
  status: RunStatus;
  createdAt: string;
};

const STATUS_STYLES: Record<RunStatus, { label: string; badge: string; dot: string }> = {
  queued: {
    label: 'Queued',
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    dot: 'bg-slate-400',
  },
  running: {
    label: 'Running',
    badge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    dot: 'bg-amber-500 animate-pulse',
  },
  complete: {
    label: 'Complete',
    badge: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  failed: {
    label: 'Failed',
    badge: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200',
    dot: 'bg-rose-500',
  },
};

async function fetchRuns(): Promise<RunSummary[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/runs`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
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

function StatusPill({ status }: { status: RunStatus }) {
  const styles = STATUS_STYLES[status];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}>
      <span className={`h-2 w-2 rounded-full ${styles.dot}`} aria-hidden="true" />
      <span>{styles.label}</span>
    </span>
  );
}

export default async function Page() {
  const runs = await fetchRuns();

  return (
    <main className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Recent Analysis Runs</h1>
          <span className="rounded-full bg-slate-200/80 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
            {runs.length} run{runs.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4">
          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm text-slate-500">
              <p className="font-medium text-slate-600">No runs have been requested yet.</p>
              <p className="mt-2">Trigger a scan from the GitHub App or send a POST request to <code>/v1/runs</code>.</p>
            </div>
          ) : (
            runs.map((run) => (
              <article key={run.id} className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{run.projectId}</div>
                    <div className="font-mono text-lg text-slate-800">{run.id}</div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-slate-500">Created</dt>
                        <dd>{formatDate(run.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-500">API endpoint</dt>
                        <dd>
                          <a href={`${API_BASE_URL}/v1/runs/${run.id}`} className="break-all">
                            /v1/runs/{run.id}
                          </a>
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <StatusPill status={run.status} />
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
