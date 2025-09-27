// services/orchestrator/src/worker.ts
import { randomUUID } from 'node:crypto';
import { Job } from 'bullmq';
import { log } from '@accessmate/diagnostics';
import type { Finding } from '@accessmate/core-types';
import { runAudit } from '@accessmate/dynamic-audit';
import { retrieveGuidelines } from '@accessmate/rag';
import { getRun, saveFindings, updateRun } from '@accessmate/persistence';
import {
  getInstallationByOrgId,
  getProject,
  getRun,
  getSuggestedFileChanges,
  saveFindings,
  savePRRef,
  updateRun,
} from '@accessmate/persistence';
import {
  assertQueueJob,
  createJobQueue,
  createJobWorker,
  queueJobSchema,
  type QueueJob,
} from '@accessmate/queue';
import { openPR } from '@accessmate/scm';

const queue = createJobQueue();

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

createJobWorker(
  async (job: Job<QueueJob>) => {
    const parsed = queueJobSchema.safeParse(job.data);
    if (!parsed.success) {
      log.error('Received malformed job payload', {
        id: job.id,
        issues: parsed.error.issues,
      });
      return;
    }

    const data = parsed.data;
    log.info('Job received', { kind: job.data.kind, id: job.id });

    switch (data.kind) {
      case 'run.start': {
        const run = updateRun(data.runId, { status: 'running' });
        if (!run) {
          log.warn('Received run.start for unknown run', { runId: data.runId });
          return;
        }

        const requestedRoutes = data.routes && data.routes.length > 0 ? data.routes : ['/'];
        const urls = buildAuditUrls(requestedRoutes);

        await queue.add(
          'run.dynamicAudit',
          assertQueueJob({ kind: 'run.dynamicAudit', runId: data.runId, routes: urls }),
          { removeOnComplete: true, removeOnFail: 50 },
        );
        return;
      }
      case 'run.dynamicAudit': {
        const { routes, runId } = data;
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
              const references = await retrieveGuidelines({
                ruleId: violation.id,
                contextSnippet: firstNode?.html ?? violation.description,
              });
              const topReference = references[0];
              const referenceText = topReference
                ? `${topReference.citation} — ${topReference.summary}`
                : undefined;
              const wcagRef = referenceText
                ? `${referenceText}${violation.helpUrl ? ` (${violation.helpUrl})` : ''}`
                : violation.helpUrl;

              findings.push({
                id: randomUUID(),
                runId,
                rule: violation.id,
                severity: impactToSeverity(violation.impact),
                selector: firstNode?.target?.[0],
                snippet: firstNode?.html,
                wcagRef,
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
        const project = getProject(data.projectId);
        if (!project) {
          log.warn('Received pr.open for unknown project', { projectId: data.projectId });
          return;
        }

        const installation = getInstallationByOrgId(project.orgId);
        if (!installation) {
          log.error('No installation found for project', { projectId: project.id, orgId: project.orgId });
          return;
        }

        const fileChanges = data.findingIds.flatMap((findingId) => getSuggestedFileChanges(findingId));
        if (fileChanges.length === 0) {
          log.warn('No file changes available for findings', { projectId: project.id, findingIds: data.findingIds });
          return;
        }

        const branchSeed = typeof job.id === 'string' ? job.id : data.findingIds[0];
        const branchSlug = branchSeed
          ? branchSeed
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '')
          : undefined;
        const branch = `accessmate/${branchSlug && branchSlug.length > 0 ? branchSlug : randomUUID()}`;
        const changeCount = fileChanges.length;

        try {
          const pr = await openPR({
            repo: project.repoFullName,
            branch,
            baseBranch: project.defaultBranch,
            installationId: installation.githubInstallationId,
            title: `Accessibility fixes (${data.findingIds.length} findings)`,
            body: `This PR addresses ${data.findingIds.length} accessibility findings detected by AccessMate.`,
            commitMessage: `chore: apply ${changeCount} accessibility ${changeCount === 1 ? 'fix' : 'fixes'}`,
            files: fileChanges,
          });

          savePRRef({
            id: randomUUID(),
            projectId: project.id,
            provider: 'github',
            repo: project.repoFullName,
            prNumber: pr.pullRequest.number,
            branch: pr.pullRequest.branch,
            status: 'open',
          });

          log.info('Pull request opened', {
            projectId: project.id,
            prNumber: pr.pullRequest.number,
            branch: pr.pullRequest.branch,
          });
        } catch (error) {
          log.error('Failed to open pull request for project', {
            projectId: project.id,
            error: error instanceof Error ? error.message : 'unknown error',
          });
        }
        return;
      }
    }
  },
);
