import { App } from '@octokit/app';
import { createNodeMiddleware, Webhooks } from '@octokit/webhooks';
import http from 'node:http';
import { log } from '@accessmate/diagnostics';


const app = new App({
appId: Number(process.env.GH_APP_ID),
privateKey: process.env.GH_APP_PRIVATE_KEY!,
oauth: { clientId: process.env.GH_CLIENT_ID!, clientSecret: process.env.GH_CLIENT_SECRET! },
});


const webhooks = new Webhooks({ secret: process.env.GH_WEBHOOK_SECRET! });


webhooks.on(["pull_request.opened", "pull_request.synchronize", "pull_request.reopened"], async (event) => {
const repo = event.payload.repository.full_name;
const pr = event.payload.pull_request.number;
log.info("PR event", { repo, pr });
const api = process.env.API_URL ?? 'http://localhost:3000';
const projectId = process.env.PROJECT_ID ?? repo; // temporary mapping
try {
const resp = await fetch(`${api}/v1/runs`, {
method: 'POST',
headers: { 'content-type': 'application/json' },
body: JSON.stringify({ projectId, trigger: 'pr' })
});
log.info('Run requested', { status: resp.status });
} catch (err) {
log.error('Failed to call API', { err: (err as Error).message });
}
});


webhooks.on("issue_comment.created", async (event) => {
const body = event.payload.comment.body.trim();
if (body.startsWith("/accessmate") || body.startsWith("@accessmate")) {
log.info("Command", { body });
// Example: /accessmate run
const api = process.env.API_URL ?? 'http://localhost:3000';
const projectId = process.env.PROJECT_ID ?? event.payload.repository.full_name;
await fetch(`${api}/v1/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, trigger: 'manual' }) });
}
});


const middleware = createNodeMiddleware(webhooks, { path: "/webhooks/github" });
http.createServer(middleware).listen(process.env.PORT || 3001, () => log.info("GitHub App listening"));