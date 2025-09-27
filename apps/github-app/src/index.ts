import { App } from '@octokit/app';
import { createNodeMiddleware, Webhooks } from '@octokit/webhooks';
import http from 'node:http';
import { log } from '@accessmate/diagnostics';

const app = new App({
  appId: Number(process.env.GH_APP_ID),
  privateKey: process.env.GH_APP_PRIVATE_KEY!,
  oauth: {
    clientId: process.env.GH_CLIENT_ID!,
    clientSecret: process.env.GH_CLIENT_SECRET!,
  },
});

const webhooks = new Webhooks({ secret: process.env.GH_WEBHOOK_SECRET! });

async function requestRun(projectId: string, trigger: 'pr' | 'manual') {
  const apiBase = process.env.API_URL ?? 'http://localhost:3000';

  try {
    const response = await fetch(`${apiBase}/v1/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, trigger }),
    });

    log.info('Run requested', { projectId, status: response.status, trigger });
  } catch (error) {
    log.error('Failed to request run', {
      projectId,
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }
}

webhooks.on(['pull_request.opened', 'pull_request.synchronize', 'pull_request.reopened'], async (event) => {
  const repo = event.payload.repository.full_name;
  const prNumber = event.payload.pull_request.number;
  const projectId = process.env.PROJECT_ID ?? repo;

  log.info('PR event received', { repo, prNumber });
  await requestRun(projectId, 'pr');
});

webhooks.on('issue_comment.created', async (event) => {
  const body = event.payload.comment.body.trim();
  if (body.startsWith('/accessmate') || body.startsWith('@accessmate')) {
    const projectId = process.env.PROJECT_ID ?? event.payload.repository.full_name;
    log.info('Command received', { body, projectId });
    await requestRun(projectId, 'manual');
  }
});

const middleware = createNodeMiddleware(webhooks, { path: '/webhooks/github' });

http
  .createServer(middleware)
  .listen(process.env.PORT || 3001, () => log.info('GitHub App listening'));
