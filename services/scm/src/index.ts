import { log } from '@accessmate/diagnostics';
import { createGitHubApp, createInstallationClient } from '@accessmate/github';

export interface OpenPRFileChange {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
  mode?: '100644' | '100755';
}

export interface OpenPROptions {
  repo: string;
  branch: string;
  baseBranch: string;
  installationId: number;
  title: string;
  body: string;
  commitMessage: string;
  files: OpenPRFileChange[];
}

export interface OpenPRResult {
  pullRequest: {
    number: number;
    url: string;
    branch: string;
    headSha: string;
  };
}

function parseRepo(input: string): { owner: string; repo: string } {
  const [owner, repo] = input.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repo string: ${input}`);
  }
  return { owner, repo };
}

async function ensureBranch({
  octokit,
  owner,
  repo,
  branch,
  newCommitSha,
}: {
  octokit: Awaited<ReturnType<typeof createInstallationClient>>;
  owner: string;
  repo: string;
  branch: string;
  newCommitSha: string;
}): Promise<void> {
  try {
    await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: newCommitSha, force: false });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: newCommitSha });
      return;
    }

    log.error('Failed to ensure branch reference', {
      owner,
      repo,
      branch,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    throw error;
  }
}

export async function openPR(opts: OpenPROptions): Promise<OpenPRResult> {
  if (opts.files.length === 0) {
    throw new Error('openPR requires at least one file change');
  }

  const appId = Number(process.env.GH_APP_ID);
  const privateKey = process.env.GH_APP_PRIVATE_KEY;
  if (!appId || !privateKey) {
    throw new Error('GitHub App credentials are not configured');
  }

  const app = createGitHubApp({ appId, privateKey });
  const octokit = await createInstallationClient({ app, installationId: opts.installationId });

  const { owner, repo } = parseRepo(opts.repo);

  try {
    const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${opts.baseBranch}` });
    const baseCommitSha = baseRef.data.object.sha;
    const baseCommit = await octokit.git.getCommit({ owner, repo, commit_sha: baseCommitSha });

    let currentBranchSha: string | null = null;
    try {
      const existingBranch = await octokit.git.getRef({ owner, repo, ref: `heads/${opts.branch}` });
      currentBranchSha = existingBranch.data.object.sha;
    } catch (error) {
      if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) {
        throw error;
      }
    }

    const parentSha = currentBranchSha ?? baseCommitSha;
    const parentCommit = await octokit.git.getCommit({ owner, repo, commit_sha: parentSha });

    const dedupedFiles = Array.from(
      opts.files.reduce((map, file) => map.set(file.path, file), new Map<string, OpenPRFileChange>()).values(),
    );

    const blobs = await Promise.all(
      dedupedFiles.map((file) =>
        octokit.git.createBlob({
          owner,
          repo,
          content: file.content,
          encoding: file.encoding ?? 'utf-8',
        }),
      ),
    );

    const treeResponse = await octokit.git.createTree({
      owner,
      repo,
      base_tree: parentCommit.data.tree.sha,
      tree: blobs.map((blob, index) => ({
        path: dedupedFiles[index]!.path,
        mode: dedupedFiles[index]!.mode ?? '100644',
        type: 'blob',
        sha: blob.data.sha,
      })),
    });

    let headSha = parentSha;
    if (treeResponse.data.sha !== parentCommit.data.tree.sha) {
      const commit = await octokit.git.createCommit({
        owner,
        repo,
        message: opts.commitMessage,
        tree: treeResponse.data.sha,
        parents: [parentSha],
      });
      headSha = commit.data.sha;
      await ensureBranch({
        octokit,
        owner,
        repo,
        branch: opts.branch,
        newCommitSha: headSha,
      });
    } else if (!currentBranchSha) {
      // No existing branch and no changes -> still create branch at parent
      await ensureBranch({
        octokit,
        owner,
        repo,
        branch: opts.branch,
        newCommitSha: parentSha,
      });
    }

    let prResponse;
    try {
      prResponse = await octokit.pulls.create({
        owner,
        repo,
        head: opts.branch,
        base: opts.baseBranch,
        title: opts.title,
        body: opts.body,
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 422) {
        const existing = await octokit.pulls.list({
          owner,
          repo,
          head: `${owner}:${opts.branch}`,
          state: 'open',
        });
        const match = existing.data.find((pr) => pr.head.ref === opts.branch);
        if (!match) {
          throw error;
        }
        return {
          pullRequest: {
            number: match.number,
            url: match.html_url,
            branch: opts.branch,
            headSha,
          },
        };
      }

      log.error('Failed to create pull request', {
        owner,
        repo,
        branch: opts.branch,
        error: error instanceof Error ? error.message : 'unknown error',
      });
      throw error;
    }

    return {
      pullRequest: {
        number: prResponse.data.number,
        url: prResponse.data.html_url,
        branch: prResponse.data.head.ref,
        headSha,
      },
    };
  } catch (error) {
    log.error('Failed to open PR', {
      repo: opts.repo,
      branch: opts.branch,
      error: error instanceof Error ? error.message : 'unknown error',
    });
    throw error;
  }
}
