export type ID = string;


export interface User { id: ID; email: string; name: string; orgId: ID; role: 'Developer'|'QA'|'Admin'; }
export interface Org { id: ID; name: string; plan: 'free'|'pro'|'enterprise'; }
export interface Installation { id: ID; orgId: ID; githubInstallationId: number; }
export interface Project { id: ID; orgId: ID; repoFullName: string; defaultBranch: string; framework?: string; siteBaseUrl?: string; }
export interface Run { id: ID; projectId: ID; trigger: 'pr'|'push'|'manual'|'schedule'; headSha?: string; baseSha?: string; prNumber?: number; createdAt: string; status: 'queued'|'running'|'complete'|'failed'; }
export interface Finding { id: ID; runId: ID; rule: string; severity: 'Low'|'Moderate'|'High'|'Critical'; selector?: string; filePath?: string; codeSpan?: { start: number; end: number; }; snippet?: string; wcagRef?: string; suggestionId?: ID; }
export interface Suggestion { id: ID; findingId: ID; patch: string; testStubPaths?: string[]; rationale?: string; }
export interface PRRef { id: ID; projectId: ID; provider: 'github'; repo: string; prNumber: number; branch: string; status: 'open'|'merged'|'closed'; lighthouseBeforeRef?: string; lighthouseAfterRef?: string; }
export interface Policy { id: ID; projectId: ID; minContrast?: number; failOnSeverity?: 'High'|'Critical'; routesConfig?: string[]; }


export type QueueJob =
| { kind: 'run.start'; runId: ID; projectId: ID }
| { kind: 'run.dynamicAudit'; runId: ID; routes: string[] }
| { kind: 'fix.generate'; findingIds: ID[] }
| { kind: 'pr.open'; projectId: ID; findingIds: ID[] };