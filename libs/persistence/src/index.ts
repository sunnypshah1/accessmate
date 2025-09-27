import type { Finding, ID, Run } from '@accessmate/core-types';

type CreateRunInput = {
  id: ID;
  projectId: ID;
  trigger: Run['trigger'];
  headSha?: string;
  baseSha?: string;
  prNumber?: number;
  status?: Run['status'];
  createdAt?: string;
};

type UpdateRunInput = Partial<Omit<Run, 'id' | 'projectId' | 'trigger'>> & {
  status?: Run['status'];
};

const runs = new Map<ID, Run>();
const findingsByRun = new Map<ID, Finding[]>();

export function createRun(input: CreateRunInput): Run {
  const run: Run = {
    id: input.id,
    projectId: input.projectId,
    trigger: input.trigger,
    headSha: input.headSha,
    baseSha: input.baseSha,
    prNumber: input.prNumber,
    createdAt: input.createdAt ?? new Date().toISOString(),
    status: input.status ?? 'queued',
  };

  runs.set(run.id, run);
  return run;
}

export function updateRun(id: ID, patch: UpdateRunInput): Run | undefined {
  const current = runs.get(id);
  if (!current) {
    return undefined;
  }

  const updated: Run = {
    ...current,
    ...patch,
    status: patch.status ?? current.status,
  };

  runs.set(id, updated);
  return updated;
}

export function getRun(id: ID): Run | undefined {
  return runs.get(id);
}

export function listRuns(): Run[] {
  return Array.from(runs.values()).sort((a, b) => {
    if (a.createdAt === b.createdAt) {
      return 0;
    }

    return a.createdAt > b.createdAt ? -1 : 1;
  });
}

export function saveFindings(runId: ID, findings: Finding[]): void {
  findingsByRun.set(runId, findings);
}

export function getFindings(runId: ID): Finding[] {
  return findingsByRun.get(runId) ?? [];
}

export function resetStore(): void {
  runs.clear();
  findingsByRun.clear();
}
