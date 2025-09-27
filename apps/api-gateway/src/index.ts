import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { log } from '@accessmate/diagnostics';
import { verifyWebhook } from '@accessmate/github';
import { createRun, getFindings, getRun, listRuns } from '@accessmate/persistence';
import { assertQueueJob, createJobQueue } from '@accessmate/queue';

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
  }
}

const app = express();
app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf, _encoding) => {
      (req as Request).rawBody = Buffer.isBuffer(buf) ? Buffer.from(buf) : Buffer.from(buf);
    },
  }),
);

const jobs = createJobQueue();

const githubWebhookPayload = z.object({
  action: z.string().optional(),
  installation: z.object({ id: z.number() }).optional(),
  repository: z
    .object({
      full_name: z.string(),
      default_branch: z.string(),
    })
    .optional(),
  pull_request: z
    .object({
      number: z.number(),
      head: z.object({ sha: z.string() }),
      base: z.object({ sha: z.string() }),
    })
    .optional(),
});

app.post('/webhooks/github', async (req: Request, res: Response) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    log.error('Webhook received but secret not configured');
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  const payload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
  const signature = req.header('x-hub-signature-256');
  const verification = await verifyWebhook({ secret, payload, signature });
  if (!verification.valid) {
    log.warn('GitHub webhook failed signature verification', {
      delivery: req.header('x-github-delivery'),
      reason: verification.reason,
    });
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const parsed = githubWebhookPayload.safeParse(req.body);
  if (!parsed.success) {
    log.warn('Unsupported GitHub webhook payload', { issues: parsed.error.flatten() });
    res.sendStatus(202);
    return;
  }

  const event = req.header('x-github-event');
  log.info('GitHub webhook received', { event, action: parsed.data.action });

  if (event === 'pull_request' && parsed.data.pull_request) {
    const actionable = ['opened', 'reopened', 'synchronize'];
    if (parsed.data.action && !actionable.includes(parsed.data.action)) {
      res.sendStatus(202);
      return;
    }

    const runId = randomUUID();
    const projectId = parsed.data.repository?.full_name ?? 'unknown-project';
    createRun({
      id: runId,
      projectId,
      trigger: 'pr',
      headSha: parsed.data.pull_request.head.sha,
      baseSha: parsed.data.pull_request.base.sha,
      prNumber: parsed.data.pull_request.number,
    });

    await jobs.add(
      'run.start',
      assertQueueJob({ kind: 'run.start', runId, projectId, routes: ['/'] }),
      { removeOnComplete: true, removeOnFail: 50 },
    );
  }

  res.sendStatus(202);
});

app.post('/v1/runs', async (req: Request, res: Response) => {
  const schema = z.object({
    projectId: z.string(),
    trigger: z.enum(['pr', 'push', 'manual', 'schedule']),
    routes: z.array(z.string()).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const runId = randomUUID();
  createRun({ id: runId, projectId: parsed.data.projectId, trigger: parsed.data.trigger });

  const job = assertQueueJob({
    kind: 'run.start',
    runId,
    projectId: parsed.data.projectId,
    routes: parsed.data.routes,
  });

  await jobs.add('run.start', job, { removeOnComplete: true, removeOnFail: 50 });
  log.info('Enqueued run.start', job);
  res.status(201).json({ runId });
});

app.get('/v1/runs', (_req: Request, res: Response) => {
  const runs = listRuns();
  res.json({ runs });
});

app.get('/v1/runs/:id', (req: Request, res: Response) => {
  const run = getRun(req.params.id);
  if (!run) {
    res.sendStatus(404);
    return;
  }

  const findings = getFindings(run.id);
  res.json({ run, findings });
});

app.post('/v1/prs', async (req: Request, res: Response) => {
  const schema = z.object({ projectId: z.string(), findingIds: z.array(z.string()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const job = assertQueueJob({
    kind: 'pr.open',
    projectId: parsed.data.projectId,
    findingIds: parsed.data.findingIds,
  });

  await jobs.add('pr.open', job, { removeOnComplete: true, removeOnFail: 50 });
  log.info('Enqueued pr.open', job);
  res.status(202).json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => log.info('API Gateway listening'));
