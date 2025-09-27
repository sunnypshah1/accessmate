// services/orchestrator/src/worker.ts
import { Worker, Queue, Job } from 'bullmq';
import { log } from '@accessmate/diagnostics';
import type { QueueJob } from '@accessmate/core-types';
import { runAudit } from '@accessmate/dynamic-audit';
// import { db } from '@accessmate/persistence';

const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
const queue = new Queue<QueueJob>('accessmate-jobs', { connection });

new Worker<QueueJob>('accessmate-jobs', async (job: Job<QueueJob>) => {
  log.info('Job received', { kind: job.data.kind, id: job.id });
  switch (job.data.kind) {
    case 'run.start': {
      const routes = ['/']; // TODO: discovery later
      await queue.add('run.dynamicAudit', { kind: 'run.dynamicAudit', runId: job.data.runId, routes });
      return;
    }
    case 'run.dynamicAudit': {
      const { routes, runId } = job.data as any;
      const { results } = await runAudit(routes);
      // TODO: persist run & findings
      // await db.run.update(...); await db.finding.createMany(...);
      log.info('Audit complete', { runId, urls: Object.keys(results).length });
      return;
    }
    case 'pr.open': {
      // TODO: use services/scm.openPR
      return;
    }
  }
}, { connection });
