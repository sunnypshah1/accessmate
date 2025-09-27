async function fetchRuns() {
// TODO: call API gateway once endpoints are exposed for listing runs
return [] as { id: string; projectId: string; status: string; createdAt: string }[];
}


export default async function Page() {
const runs = await fetchRuns();
return (
<main className="space-y-4">
<section>
<h2 className="text-xl font-semibold">Recent Runs</h2>
<div className="mt-3 grid grid-cols-1 gap-3">
{runs.length === 0 ? (
<div className="rounded-xl border p-4">No runs yet.</div>
) : (
runs.map((r) => (
<div key={r.id} className="rounded-xl border p-4">
<div className="flex items-center justify-between">
<div>
<div className="font-medium">{r.id}</div>
<div className="text-sm text-gray-600">Project: {r.projectId}</div>
</div>
<div className="text-sm">{r.status}</div>
</div>
</div>
))
)}
</div>
</section>
</main>
);
}