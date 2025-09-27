import type { Finding, ID, Installation, PRRef, Project, Run } from '@accessmate/core-types';

export interface SuggestedFileChange {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
  mode?: '100644' | '100755';
}

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
const projects = new Map<ID, Project>();
const installations = new Map<ID, Installation>();
const installationsByOrg = new Map<ID, Installation>();
const suggestedFileChangesByFinding = new Map<ID, SuggestedFileChange[]>();
const prRefs = new Map<ID, PRRef>();
const prRefsByProject = new Map<ID, PRRef[]>();

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
  projects.clear();
  installations.clear();
  installationsByOrg.clear();
  suggestedFileChangesByFinding.clear();
  prRefs.clear();
  prRefsByProject.clear();
}

export function saveProject(project: Project): Project {
  projects.set(project.id, project);
  return project;
}

export function getProject(id: ID): Project | undefined {
  return projects.get(id);
}

export function saveInstallation(installation: Installation): Installation {
  installations.set(installation.id, installation);
  installationsByOrg.set(installation.orgId, installation);
  return installation;
}

export function getInstallationByOrgId(orgId: ID): Installation | undefined {
  return installationsByOrg.get(orgId);
}

export function getInstallation(id: ID): Installation | undefined {
  return installations.get(id);
}

export function saveSuggestedFileChanges(findingId: ID, files: SuggestedFileChange[]): void {
  suggestedFileChangesByFinding.set(findingId, files);
}

export function getSuggestedFileChanges(findingId: ID): SuggestedFileChange[] {
  return suggestedFileChangesByFinding.get(findingId) ?? [];
}

export function savePRRef(ref: PRRef): PRRef {
  prRefs.set(ref.id, ref);
  const existing = prRefsByProject.get(ref.projectId) ?? [];
  const idx = existing.findIndex((item) => item.id === ref.id);
  if (idx >= 0) {
    existing[idx] = ref;
  } else {
    existing.push(ref);
  }
  prRefsByProject.set(ref.projectId, existing);
  return ref;
}

export function listPRRefs(projectId: ID): PRRef[] {
  return [...(prRefsByProject.get(projectId) ?? [])];
}
