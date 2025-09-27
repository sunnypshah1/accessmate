import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const infoMock = vi.fn();
const warnMock = vi.fn();
const errorMock = vi.fn();

vi.mock(
  '@accessmate/diagnostics',
  () => ({
    log: {
      info: infoMock,
      warn: warnMock,
      error: errorMock,
    },
  }),
  { virtual: true },
);

const queueAddMock = vi.fn();
let workerHandler: ((job: unknown) => Promise<void>) | undefined;

vi.mock(
  '@accessmate/queue',
  () => ({
    createJobQueue: vi.fn(() => ({ add: queueAddMock })),
    createJobWorker: vi.fn((handler: any) => {
      workerHandler = handler;
      return {};
    }),
    queueJobSchema: {
      safeParse: (value: unknown) => ({ success: true, data: value }),
    },
    assertQueueJob: <T>(input: T) => input,
  }),
  { virtual: true },
);

const openPRMock = vi.fn();

vi.mock(
  '@accessmate/scm',
  () => ({
    openPR: (...args: unknown[]) => openPRMock(...args),
  }),
  { virtual: true },
);

import { listPRRefs, resetStore, saveInstallation, saveProject, saveSuggestedFileChanges } from '@accessmate/persistence';

function buildJob(data: unknown) {
  return {
    id: 'job-123',
    data,
  } as any;
}

describe('worker pr.open handling', () => {
  beforeAll(async () => {
    await import('./worker.js');
    if (!workerHandler) {
      throw new Error('Worker handler was not registered');
    }
  });

  beforeEach(() => {
    resetStore();
    queueAddMock.mockReset();
    openPRMock.mockReset();
    infoMock.mockReset();
    warnMock.mockReset();
    errorMock.mockReset();
  });

  afterEach(() => {
    resetStore();
  });

  it('opens a PR and persists the reference', async () => {
    const project = saveProject({
      id: 'project-1',
      orgId: 'org-1',
      repoFullName: 'acme/widgets',
      defaultBranch: 'main',
    });
    saveInstallation({ id: 'installation-1', orgId: 'org-1', githubInstallationId: 1234 });

    const findingId = randomUUID();
    saveSuggestedFileChanges(findingId, [{ path: 'README.md', content: 'updated content' }]);

    openPRMock.mockResolvedValueOnce({
      pullRequest: { number: 42, url: 'http://example/pr', branch: 'accessmate/job-123', headSha: 'sha' },
    });

    await workerHandler!(
      buildJob({ kind: 'pr.open', projectId: project.id, findingIds: [findingId] }),
    );

    expect(openPRMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: 'acme/widgets',
        branch: 'accessmate/job-123',
        baseBranch: 'main',
        installationId: 1234,
        files: [{ path: 'README.md', content: 'updated content' }],
        commitMessage: 'chore: apply 1 accessibility fix',
      }),
    );
    expect(infoMock).toHaveBeenCalledWith('Pull request opened', {
      projectId: 'project-1',
      prNumber: 42,
      branch: 'accessmate/job-123',
    });

    const prRefs = listPRRefs(project.id);
    expect(prRefs).toHaveLength(1);
    expect(prRefs[0]).toMatchObject({
      projectId: project.id,
      prNumber: 42,
      branch: 'accessmate/job-123',
    });
  });

  it('logs an error when installation is missing', async () => {
    const project = saveProject({
      id: 'project-2',
      orgId: 'org-2',
      repoFullName: 'acme/site',
      defaultBranch: 'main',
    });
    const findingId = randomUUID();
    saveSuggestedFileChanges(findingId, [{ path: 'README.md', content: 'updated content' }]);

    await workerHandler!(
      buildJob({ kind: 'pr.open', projectId: project.id, findingIds: [findingId] }),
    );

    expect(openPRMock).not.toHaveBeenCalled();
    expect(errorMock).toHaveBeenCalledWith('No installation found for project', {
      projectId: 'project-2',
      orgId: 'org-2',
    });
    expect(listPRRefs(project.id)).toHaveLength(0);
  });
});
