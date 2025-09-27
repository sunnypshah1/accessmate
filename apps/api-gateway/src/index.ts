import express from 'express';
import { z } from 'zod';
import { log } from '@accessmate/diagnostics';
import type { QueueJob } from '@accessmate/core-types';
import { Queue } from 'bullmq';


const app = express();
app.use(express.json({ limit: '2mb' }));


const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
const jobs = new Queue<QueueJob>('accessmate-jobs', { connection });


app.post('/webhooks/github', (req, res) => {
log.info('GH webhook received', { event: req.header('x-github-event') });
res.sendStatus(202);
});


app.post('/v1/runs', async (req, res) => {
const schema = z.object({ projectId: z.string(), trigger: z.enum(['pr','push','manual','schedule']), routes: z.string().array().optional() });
const parsed = schema.parse(req.body);
const runId = crypto.randomUUID();
const job: QueueJob = { kind: 'run.start', runId, projectId: parsed.projectId };
await jobs.add('run.start', job, { removeOnComplete: true, removeOnFail: 50 });
log.info('Enqueued run.start', job);
res.status(201).json({ runId });
});


app.post('/v1/prs', async (req, res) => {
const schema = z.object({ projectId: z.string(), findingIds: z.string().array().min(1) });
const parsed = schema.parse(req.body);
const job: QueueJob = { kind: 'pr.open', projectId: parsed.projectId, findingIds: parsed.findingIds };
await jobs.add('pr.open', job, { removeOnComplete: true, removeOnFail: 50 });
log.info('Enqueued pr.open', job);
res.status(202).json({ ok: true });
});


app.listen(process.env.PORT || 3000, () => log.info('API Gateway listening'));