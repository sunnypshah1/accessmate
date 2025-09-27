import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { Queue } from 'bullmq';
import { z } from 'zod';
import { log } from '@accessmate/diagnostics';
import type { QueueJob } from '@accessmate/core-types';
import { createRun, getFindings, getRun, listRuns } from '@accessmate/persistence';

const app = express();
app.use(express.json({ limit: '2mb' }));

const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
const jobs = new Queue<QueueJob>('accessmate-jobs', { connection });

app.post('/webhooks/github', (req: Request, res: Response) => {
  log.info('GH webhook received', { event: req.header('x-github-event') });
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

  const job: QueueJob = {
    kind: 'run.start',
    runId,
    projectId: parsed.data.projectId,
    routes: parsed.data.routes,
  };

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

  const job: QueueJob = {
    kind: 'pr.open',
    projectId: parsed.data.projectId,
    findingIds: parsed.data.findingIds,
  };

  await jobs.add('pr.open', job, { removeOnComplete: true, removeOnFail: 50 });
  log.info('Enqueued pr.open', job);
  res.status(202).json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => log.info('API Gateway listening'));
