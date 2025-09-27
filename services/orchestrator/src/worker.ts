// services/orchestrator/src/worker.ts
import { randomUUID } from 'node:crypto';
import { Worker, Queue, Job } from 'bullmq';
import { log } from '@accessmate/diagnostics';
import type { Finding, QueueJob } from '@accessmate/core-types';
import { runAudit } from '@accessmate/dynamic-audit';
import { getRun, saveFindings, updateRun } from '@accessmate/persistence';

const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };
const queue = new Queue<QueueJob>('accessmate-jobs', { connection });

function impactToSeverity(impact?: string | null): Finding['severity'] {
  switch (impact) {
    case 'minor':
      return 'Low';
    case 'moderate':
      return 'Moderate';
    case 'serious':
      return 'High';
    case 'critical':
      return 'Critical';
    default:
      return 'Moderate';
  }
}

function buildAuditUrls(routes: string[]): string[] {
  const baseUrl = process.env.AUDIT_BASE_URL ?? 'https://example.com';
  return routes.map((route) => {
    try {
      return new URL(route, baseUrl).toString();
    } catch (error) {
      log.warn('Failed to build audit URL, falling back to raw route', {
        route,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return route;
    }
  });
}

new Worker<QueueJob>(
  'accessmate-jobs',
  async (job: Job<QueueJob>) => {
    log.info('Job received', { kind: job.data.kind, id: job.id });

    switch (job.data.kind) {
      case 'run.start': {
        const run = updateRun(job.data.runId, { status: 'running' });
        if (!run) {
          log.warn('Received run.start for unknown run', { runId: job.data.runId });
          return;
        }

        const requestedRoutes = job.data.routes && job.data.routes.length > 0 ? job.data.routes : ['/'];
        const urls = buildAuditUrls(requestedRoutes);

        await queue.add(
          'run.dynamicAudit',
          { kind: 'run.dynamicAudit', runId: job.data.runId, routes: urls },
          { removeOnComplete: true, removeOnFail: 50 },
        );
        return;
      }
      case 'run.dynamicAudit': {
        const { routes, runId } = job.data;
        const run = getRun(runId);
        if (!run) {
          log.warn('Received run.dynamicAudit for unknown run', { runId });
          return;
        }

        try {
          const { results } = await runAudit(routes);

          const findings: Finding[] = [];
          for (const [url, result] of Object.entries(results)) {
            if (result.error) {
              log.warn('Audit failed for URL', { runId, url, error: result.error });
              continue;
            }

            for (const violation of result.violations) {
              const firstNode = violation.nodes[0];
              findings.push({
                id: randomUUID(),
                runId,
                rule: violation.id,
                severity: impactToSeverity(violation.impact),
                selector: firstNode?.target?.[0],
                snippet: firstNode?.html,
                wcagRef: violation.helpUrl,
              });
            }
          }

          saveFindings(runId, findings);
          updateRun(runId, { status: 'complete' });

          log.info('Audit complete', {
            runId,
            urlCount: Object.keys(results).length,
            findingCount: findings.length,
          });
        } catch (error) {
          updateRun(runId, { status: 'failed' });
          log.error('Audit job failed', {
            runId,
            error: error instanceof Error ? error.message : 'unknown error',
          });
        }
        return;
      }
      case 'pr.open': {
        log.info('pr.open job received (not yet implemented)', { projectId: job.data.projectId });
        return;
      }
    }
  },
  { connection },
);
