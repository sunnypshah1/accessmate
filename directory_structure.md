accessMate-AI/
├─ apps/
│  ├─ github-app/             # Webhooks, Checks, PR comments
│  ├─ web/                    # Next.js dashboard (orgs, runs, policies, artifacts)
│  └─ api-gateway/            # REST façade (runs, fixes, PR creation)
├─ services/
│  ├─ orchestrator/           # Coordinates static, dynamic, CV, captioning, RAG
│  ├─ static-analyzer/        # AST, CSS, rule engines
│  ├─ dynamic-audit/          # Playwright + axe + Lighthouse
│  ├─ cv/                     # contrast, color, OCR
│  ├─ captioning/             # Whisper transcripts, PR diff hooks
│  ├─ rag/                    # WCAG/ARIA retrieval & citation
│  └─ scm/                    # Branching, patch apply, PR creation
├─ libs/
│  ├─ core-types/             # User, Project, Run, Finding, Suggestion, PR
│  ├─ wcag/                   # WCAG mapping, checklist JSON
│  ├─ diagnostics/            # logging, tracing, metrics
│  ├─ queues/                 # job schemas, retries, DLQ
│  ├─ persistence/            # Prisma/Postgres, pgvector, S3/GCS
│  ├─ testing/                # fixtures, sample repos, GitHub mocks
│  └─ security/               # secrets, redaction, allowlists
├─ deploy/
│  ├─ k8s/                    # jobs, HPA, services, ingress
│  ├─ terraform/              # cloud infra, DBs, queues, secrets
│  └─ containers/             # Dockerfiles per app/service
├─ artifacts/                 # local storage for reports/snapshots
└─ docs/                      # architecture, workflows, API references
