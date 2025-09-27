import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  return {
    logError: vi.fn(),
    createGitHubAppMock: vi.fn(),
    createInstallationClientMock: vi.fn(),
  };
});

vi.mock(
  '@accessmate/diagnostics',
  () => ({
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: (...args: unknown[]) => hoisted.logError(...args),
    },
  }),
  { virtual: true },
);

vi.mock(
  '@accessmate/github',
  () => ({
    createGitHubApp: (...args: unknown[]) => hoisted.createGitHubAppMock(...args),
    createInstallationClient: (...args: unknown[]) => hoisted.createInstallationClientMock(...args),
  }),
  { virtual: true },
);

const { logError, createGitHubAppMock, createInstallationClientMock } = hoisted;

import { openPR, type OpenPROptions } from './index.js';

describe('openPR', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GH_APP_ID = '123';
    process.env.GH_APP_PRIVATE_KEY = 'test-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function createOctokitMocks() {
    const getRef = vi.fn();
    const getCommit = vi.fn();
    const createBlob = vi.fn();
    const createTree = vi.fn();
    const createCommit = vi.fn();
    const createRef = vi.fn();
    const updateRef = vi.fn();
    const pullsCreate = vi.fn();
    const pullsList = vi.fn();

    const octokit = {
      git: { getRef, getCommit, createBlob, createTree, createCommit, createRef, updateRef },
      pulls: { create: pullsCreate, list: pullsList },
    } as const;

    createInstallationClientMock.mockResolvedValueOnce(octokit);
    createGitHubAppMock.mockReturnValueOnce({});

    return { octokit, getRef, getCommit, createBlob, createTree, createCommit, createRef, updateRef, pullsCreate, pullsList };
  }

  function buildOptions(overrides: Partial<OpenPROptions> = {}): OpenPROptions {
    return {
      repo: 'acme/widgets',
      branch: 'accessmate/test',
      baseBranch: 'main',
      installationId: 42,
      title: 'Test PR',
      body: 'Body',
      commitMessage: 'chore: test',
      files: [{ path: 'README.md', content: 'updated' }],
      ...overrides,
    };
  }

  it('creates a new branch and pull request when branch is missing', async () => {
    const { octokit, getRef, getCommit, createBlob, createTree, createCommit, createRef, pullsCreate } = createOctokitMocks();

    getRef
      .mockResolvedValueOnce({ data: { object: { sha: 'base-sha' } } })
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { status: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { status: 404 }));
    getCommit
      .mockResolvedValueOnce({ data: { tree: { sha: 'base-tree' } } })
      .mockResolvedValueOnce({ data: { tree: { sha: 'base-tree' } } });
    createBlob.mockResolvedValueOnce({ data: { sha: 'blob-sha' } });
    createTree.mockResolvedValueOnce({ data: { sha: 'new-tree' } });
    createCommit.mockResolvedValueOnce({ data: { sha: 'commit-sha' } });
    createRef.mockResolvedValueOnce({});
    pullsCreate.mockResolvedValueOnce({ data: { number: 7, html_url: 'http://example/pr', head: { ref: 'accessmate/test' } } });

    const result = await openPR(buildOptions());

    expect(createGitHubAppMock).toHaveBeenCalledWith({ appId: 123, privateKey: 'test-key' });
    expect(createInstallationClientMock).toHaveBeenCalledWith({ app: {}, installationId: 42 });
    expect(createBlob).toHaveBeenCalledWith({ owner: 'acme', repo: 'widgets', content: 'updated', encoding: 'utf-8' });
    expect(createTree).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      base_tree: 'base-tree',
      tree: [{ path: 'README.md', mode: '100644', type: 'blob', sha: 'blob-sha' }],
    });
    expect(createCommit).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      message: 'chore: test',
      tree: 'new-tree',
      parents: ['base-sha'],
    });
    expect(octokit.git.createRef).toHaveBeenCalledWith({ owner: 'acme', repo: 'widgets', ref: 'refs/heads/accessmate/test', sha: 'commit-sha' });
    expect(pullsCreate).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'widgets',
      head: 'accessmate/test',
      base: 'main',
      title: 'Test PR',
      body: 'Body',
    });
    expect(result).toEqual({
      pullRequest: {
        number: 7,
        url: 'http://example/pr',
        branch: 'accessmate/test',
        headSha: 'commit-sha',
      },
    });
  });

  it('updates an existing branch without creating a new commit when no changes occur', async () => {
    const { getRef, getCommit, createBlob, createTree, createCommit, pullsCreate } = createOctokitMocks();

    getRef
      .mockResolvedValueOnce({ data: { object: { sha: 'base-sha' } } })
      .mockResolvedValueOnce({ data: { object: { sha: 'branch-sha' } } });
    getCommit
      .mockResolvedValueOnce({ data: { tree: { sha: 'base-tree' } } })
      .mockResolvedValueOnce({ data: { tree: { sha: 'branch-tree' } } });
    createBlob.mockResolvedValueOnce({ data: { sha: 'blob-sha' } });
    createTree.mockResolvedValueOnce({ data: { sha: 'branch-tree' } });
    pullsCreate.mockResolvedValueOnce({ data: { number: 9, html_url: 'http://example/pr2', head: { ref: 'accessmate/test' } } });

    const result = await openPR(buildOptions());

    expect(createCommit).not.toHaveBeenCalled();
    expect(result.pullRequest.headSha).toBe('branch-sha');
  });

  it('returns existing PR metadata when the PR already exists', async () => {
    const { getRef, getCommit, createBlob, createTree, createCommit, pullsCreate, pullsList } = createOctokitMocks();

    getRef
      .mockResolvedValueOnce({ data: { object: { sha: 'base-sha' } } })
      .mockResolvedValueOnce({ data: { object: { sha: 'branch-sha' } } });
    getCommit
      .mockResolvedValueOnce({ data: { tree: { sha: 'base-tree' } } })
      .mockResolvedValueOnce({ data: { tree: { sha: 'branch-tree' } } });
    createBlob.mockResolvedValueOnce({ data: { sha: 'blob-sha' } });
    createTree.mockResolvedValueOnce({ data: { sha: 'new-tree' } });
    createCommit.mockResolvedValueOnce({ data: { sha: 'new-commit' } });
    pullsCreate.mockRejectedValueOnce(Object.assign(new Error('exists'), { status: 422 }));
    pullsList.mockResolvedValueOnce({
      data: [
        {
          number: 15,
          html_url: 'http://example/pr-existing',
          head: { ref: 'accessmate/test' },
        },
      ],
    });

    const result = await openPR(buildOptions());

    expect(result).toEqual({
      pullRequest: {
        number: 15,
        url: 'http://example/pr-existing',
        branch: 'accessmate/test',
        headSha: 'new-commit',
      },
    });
  });
});
