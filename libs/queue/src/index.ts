import {
  Queue,
  Worker,
  type Processor,
  type WorkerOptions,
  type QueueOptions,
  type JobsOptions,
} from 'bullmq';
import { z } from 'zod';

export const runJobSchema = z.object({
  kind: z.literal('run.start'),
  runId: z.string().uuid(),
  projectId: z.string(),
  routes: z.array(z.string()).optional(),
});

export const dynamicAuditJobSchema = z.object({
  kind: z.literal('run.dynamicAudit'),
  runId: z.string().uuid(),
  routes: z.array(z.string().url()),
});

export const openPrJobSchema = z.object({
  kind: z.literal('pr.open'),
  projectId: z.string(),
  findingIds: z.array(z.string().uuid()).min(1),
});

export const queueJobSchema = z.discriminatedUnion('kind', [runJobSchema, dynamicAuditJobSchema, openPrJobSchema]);

export type RunJob = z.infer<typeof runJobSchema>;
export type DynamicAuditJob = z.infer<typeof dynamicAuditJobSchema>;
export type OpenPrJob = z.infer<typeof openPrJobSchema>;
export type QueueJob = z.infer<typeof queueJobSchema>;

export interface QueueFactoryOptions {
  name?: string;
  connection?: QueueOptions['connection'];
  defaultJobOptions?: JobsOptions;
}

export function createJobQueue({
  name = 'accessmate-jobs',
  connection,
  defaultJobOptions = { removeOnComplete: true, removeOnFail: 25 },
}: QueueFactoryOptions = {}) {
  return new Queue<QueueJob>(name, {
    connection: connection ?? { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    defaultJobOptions,
  });
}

export function createJobWorker(
  handler: Processor<QueueJob, unknown, string>,
  options: Partial<WorkerOptions> = {},
) {
  const { connection, ...rest } = options;
  return new Worker<QueueJob>('accessmate-jobs', handler, {
    connection: connection ?? { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    ...rest,
  });
}

export function assertQueueJob(input: unknown): QueueJob {
  return queueJobSchema.parse(input);
}
