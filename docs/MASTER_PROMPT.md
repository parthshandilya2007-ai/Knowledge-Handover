# Knowledge Handover Platform: Complete Build Prompt (v2)

**Tagline:** Replace the Person, Not the Knowledge.

---

## HOW TO USE THIS FILE (read this first, it is for you, not the AI)

A single giant prompt makes AI coding tools lose track and create a mess. So this file has two parts:

1. **PART A: Master Prompt.** Paste it ONCE at the start of a new chat/session in Cursor, Claude Code, Windsurf or similar. It sets the architecture, contracts and rules. Tell the tool to save it as `docs/MASTER_PROMPT.md` and re-read it at the start of every stage.
2. **PART B: Stage Prompts.** Paste ONE stage at a time. Do not move on until that stage's "Done when" checks pass.
3. **PART C: Fix-it prompts** for when something breaks.

Golden rules for you: commit to Git after every passing stage, never ask the tool to "build everything", and if the tool wants to change a contract, make it update `docs/CONTRACTS.md` first.

---
---

# PART A: MASTER PROMPT (paste once)

## A1. Role and mission

Act as a senior full-stack engineer, AI engineer and software architect. Build a production-style **Knowledge Handover Platform**: when a team member leaves, the platform collects project knowledge (documents, GitHub, meeting notes, discussions), analyses it with AI, and produces a **reviewable, evidence-linked, permission-aware handover** so the incoming person can continue the project without starting from zero.

The product must satisfy three success criteria, and every design decision must serve them:

- **TRACEABLE:** every important claim links to a supporting source snippet.
- **ACTIONABLE:** the incoming person sees what is done, what is pending, who owns what, why decisions were made, what is risky, and what to do next (including a first-week plan).
- **PERMISSION-AWARE:** people only see information they are authorised to access. This is enforced in the backend data layer, never only in the UI.

Human control is mandatory: nothing is shared before a human reviews and approves it.

## A2. Non-negotiable engineering rules

1. **Contract first.** All schemas, statuses and API shapes live in `docs/CONTRACTS.md`. Code follows the contract. If a change is needed, update the contract first, then the code.
2. **One owner per responsibility.** Each piece of data and each state transition has exactly one owning module (see A5, A6). No duplicated logic across services.
3. **One permission function.** All access decisions go through `accessService` in the backend. No controller or component invents its own permission check.
4. **No fake AI.** Never hardcode AI outputs. If `OPENAI_API_KEY` or another integration is missing, the app shows a clear "setup required" state. Demo data consists of **raw source files and fixtures**, which then run through the real pipeline.
5. **No unsupported claims.** Any AI-generated item without valid evidence is dropped or labelled "No evidence found". Never invent project information.
6. **Don't break finished stages.** Only touch earlier modules for bug fixes or contract-approved changes. Run the existing tests before finishing any stage.
7. **Everything connected.** No dead buttons. Every UI action calls a real endpoint. Every endpoint has validation and error handling. Remove unused code and TODO stubs before finishing a stage.
8. **Small, typed, testable modules.** TypeScript strict mode in frontend and backend (the backend can use TypeScript too; use TS everywhere in Node). Pydantic models in Python. Meaningful names, no giant files (over ~300 lines means split).
9. **Idempotent and resumable pipeline.** Re-running a stage must not create duplicates or overwrite human edits.
10. **Stop and report** if a requirement is ambiguous or conflicts with these rules, rather than guessing silently.

## A3. Locked architecture decisions (do not change or add alternatives)

| Area | Decision |
|---|---|
| Frontend | React + TypeScript (Vite), Tailwind CSS, shadcn/ui, Framer Motion, React Router, Axios, TanStack React Query, Recharts, socket.io-client |
| Backend | Node.js + Express (TypeScript), Mongoose, Zod validation, JWT, bcrypt, Multer, Socket.IO, helmet, cors, express-rate-limit, pdfkit (PDF export) |
| AI service | Python + FastAPI, Pydantic, OpenAI SDK (structured outputs), PyMuPDF, python-docx, LangChain **only** for text splitters and retriever helpers |
| Database | **MongoDB Atlas, single cluster** for all app data |
| Vector store | **MongoDB Atlas Vector Search** (same cluster). Do NOT add ChromaDB or pgvector. Reason: one database, persistent on free hosting, simpler deployment |
| Embeddings | Provider interface with default `OPENAI_EMBEDDING_MODEL` (e.g. text-embedding-3-small). Local sentence-transformers is an optional provider selected by env, off by default (it is heavy on small hosts) |
| File storage | Storage adapter with `local` (dev) and `cloudinary`/`s3` (prod) implementations |
| Realtime | Socket.IO, JWT-authenticated, one room per project |
| Hosting | Vercel (frontend), Render (Node service + Python service), MongoDB Atlas |

**Pipeline orchestration is plain Python functions and a Mongo-backed job record. Do not add Redis, Celery or BullMQ.**

## A4. Repository structure

```
knowledge-handover/
├── frontend/
│   └── src/ {app, components/{ui,layout,common}, features/{auth,orgs,projects,sources,processing,handover,assistant,review,reports}, hooks, lib/{api,socket,utils}, pages, types}
├── backend/
│   └── src/ {config, models, routes, controllers, services, middleware, validators, sockets, storage, utils, tests}
├── ai-service/
│   └── app/ {main.py, config.py, security.py, api/, schemas/, pipeline/{parsers, chunker, embedder, extractors, reconciler, generator, rag}, tests/}
├── docs/ {MASTER_PROMPT.md, CONTRACTS.md, ARCHITECTURE.md, PERMISSIONS.md}
├── demo-data/ {documents/, github-fixture.json, meeting-notes/}
├── scripts/ {seed.ts, e2e.ts}
├── docker-compose.yml   (optional, local convenience)
└── README.md
```

## A5. Service responsibilities and data ownership

**Express backend = system of record and security gate.**
Owns: users, organisations, projects, sources, tasks, decisions, dependencies, risks, evidence, handoverReports, notifications, auditLogs, processingJobs. Handles auth, RBAC, file upload and storage, GitHub API calls (it holds GitHub tokens, encrypted at rest with AES), orchestrates pipeline jobs, validates AI output before saving, enforces permissions, exports PDFs, emits Socket.IO events.

**FastAPI AI service = stateless intelligence plus the chunk index.**
Owns: the `chunks` collection (text + embedding + locator metadata). Does parsing, chunking, embedding, extraction, reconciliation, report drafting and RAG answering. It never talks to the browser, never decides permissions, and never stores users or facts. It is reachable only with the internal service key.

**Frontend** talks ONLY to Express. It never calls FastAPI.

**Trust boundary:** Express computes `allowedSourceIds` for the requesting user and passes it to FastAPI. FastAPI must filter every retrieval by that list. FastAPI never trusts anything from the client directly.

**Internal calls (service key header `X-Internal-Key`, plus HMAC signature on webhooks):**
- Express → FastAPI: `POST /internal/sources/ingest`, `DELETE /internal/sources/{sourceId}`, `POST /internal/pipeline/run`, `POST /internal/generate`, `POST /internal/chat`, `GET /internal/health`
- FastAPI → Express: `POST /internal/webhooks/pipeline` (progress and results)
- FastAPI fetches uploaded files from Express via `GET /internal/files/{sourceId}` (service-key protected), so the AI service needs no storage credentials.

## A6. The pipeline (single state machine, no shortcuts)

```
 [1 INGEST] → [2 PARSE] → [3 CHUNK] → [4 EMBED+INDEX]      (per source)
                                              ↓
 [5 EXTRACT] → [6 RECONCILE] → [7 PERSIST] → [8 DRAFT REPORT]   (per project analysis job)
                                              ↓
 [9 REVIEW] → [10 APPROVE & LOCK] → [11 SHARE (permission-filtered)]
                                              ↓
                         [12 ASSISTANT (RAG, permission-filtered)]
```

| # | Stage | Owner | Input → Output |
|---|---|---|---|
| 1 | Ingest | Express | File/GitHub/notes → `Source` (status `uploaded`), stored file, `accessPolicy` set |
| 2 | Parse | FastAPI | Source → normalised `SourceDocument` with locators (PDF page, DOCX paragraph, TXT line range, GitHub item id/URL) |
| 3 | Chunk | FastAPI | Document → chunks (about 500-800 tokens, 80 overlap), each with `sourceId`, `projectId`, `order`, `locator`, `text`, `textHash` |
| 4 | Embed + index | FastAPI | Chunks → vectors in Atlas Vector Search. Source status becomes `ready` |
| 5 | Extract | FastAPI | Chunks → structured facts (tasks, decisions, risks/open questions/missing info, dependencies, owners). **Each fact must carry `evidence:[{chunkId, quote}]`**. Quote must be a verbatim substring of the chunk (whitespace-normalised); otherwise the evidence is invalid and the fact is dropped or downgraded to `uncertain` with a logged reason |
| 6 | Reconcile | FastAPI | Dedupe (same type + embedding similarity above threshold, merge evidence), detect conflicts (same entity with contradictory values, e.g. task "done" in notes but "open" in issues; decision A vs decision B), assign status |
| 7 | Persist | Express | Webhook result → upsert `Evidence` + facts by `fingerprint`. **Facts that a human edited or approved are locked and never overwritten**; new AI findings that disagree create a conflict flag instead |
| 8 | Draft report | FastAPI then Express | Express sends visible-to-admin facts with evidence ids; FastAPI writes section items **only from those facts** with citations; Express validates every item has at least one valid evidence id (else labelled `no_evidence`), saves `HandoverReport` v(n) as `draft` |
| 9 | Review | Express + UI | Human edits, resolves conflicts, approves items/sections. Status `in_review` |
| 10 | Approve & lock | Express | All sections approved → report `approved`, immutable snapshot, audit log entry. Edits afterwards create a new version |
| 11 | Share | Express | Per-recipient filtered view using `accessService`; expiring access; view log |
| 12 | Assistant | Express → FastAPI | Express sends question + `allowedSourceIds`; FastAPI retrieves with pre-filter, answers with citations or says it cannot find evidence |

**State enums (use exactly these):**
- `Source.status`: `uploaded | parsing | chunking | embedding | ready | failed`
- `ProcessingJob.status`: `queued | extracting | reconciling | persisting | drafting | completed | failed` (with `progress` 0-100, `currentStage`, `error`, per-source results)
- `Fact.status`: `verified | uncertain | conflicting`
- `Fact.reviewStatus`: `pending | approved | edited | rejected`
- `HandoverReport.status`: `draft | in_review | approved | shared`

Every transition happens inside one service function that also writes the audit log and emits the Socket.IO event. A failure in one source must not fail the whole job: record it per source and continue.

**Status rules:** `verified` requires that the quote check passed AND confidence ≥ 0.75 AND no conflict. `conflicting` when reconciliation finds contradiction (show both sides). Everything else is `uncertain`. A human approval marks `reviewStatus: approved`, which is separate from AI status.

## A7. Data contracts (define in `docs/CONTRACTS.md` and implement as Mongoose + Zod + Pydantic)

**Source:** `projectId, orgId, type(document|github|meeting_note|text), title, url?, fileRef?, status, error?, visibility(project|restricted), allowedUserIds[], externalId?, metadata, createdBy, timestamps`

**Chunk (FastAPI-owned):** `chunkId, sourceId, projectId, order, text, textHash, locator{page?|lineStart?|lineEnd?|paragraph?|itemType?|itemId?|url?}, embedding[]`

**Evidence:** `projectId, sourceId, chunkId, quote, locator, url?`

**Fact base fields (all of Task, Decision, Risk, Dependency):** `projectId, title, description, evidenceIds[], confidence(0-1), status, reviewStatus, conflictGroupId?, fingerprint, origin(ai|user), editedBy?, editedAt?`
- **Task:** `taskStatus(completed|pending|upcoming), ownerName?, ownerUserId?, dueDate?`
- **Decision:** `rationale?, decidedBy?, decidedAt?`
- **Risk:** `kind(risk|problem|open_question|missing_info), severity(low|medium|high)`
- **Dependency:** `fromRef, toRef, dependencyType(task|component|person|service|external), note?`

**HandoverReport:** `projectId, version, status, generatedFromJobId, sections[{key,title,items[{id, text, factRefs[{kind,id}], citations[evidenceId], flag?(no_evidence|uncertain|conflict), reviewStatus}], approvedBy?, approvedAt?}], approvals[{by, at, note}], shares[{userId, expiresAt, viewLog[]}]`

Section keys (fixed): `overview, completed_work, pending_work, responsibilities, decisions, dependencies, risks, open_questions, next_actions, first_week_plan, important_links`

**AuditLog:** `actorId, action, entityType, entityId, before?, after?, at`

**Notification:** `userId, type, message, link?, readAt?`

Use a standard API envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`.

## A8. API contract (all under `/api/v1`, all JWT-protected except auth)

- **Auth:** `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`; `GET/PATCH /users/me`
- **Orgs:** `POST /orgs`, `GET /orgs/:id`, `POST /orgs/:id/invites`, `PATCH /orgs/:id/members/:userId` (role)
- **Projects:** `POST/GET /projects`, `GET/PATCH/DELETE /projects/:id`, `POST/DELETE /projects/:id/members`
- **Sources:** `POST /projects/:id/sources/upload` (Multer), `POST /projects/:id/sources/github`, `POST /projects/:id/sources/notes`, `GET /projects/:id/sources`, `PATCH /sources/:id/visibility`, `POST /sources/:id/reprocess`, `DELETE /sources/:id`
- **Processing:** `POST /projects/:id/analyze`, `GET /projects/:id/jobs`, `GET /jobs/:id`
- **Facts:** `GET /projects/:id/{tasks|decisions|risks|dependencies}`, `PATCH/POST/DELETE` for edits (sets `origin/editedBy`, locks fact), `GET /evidence/:id` (permission-checked)
- **Handover:** `POST /projects/:id/handover/generate`, `GET /projects/:id/handover` (viewer-filtered), `PATCH /handover/:id/items/:itemId`, `POST /handover/:id/sections/:key/approve`, `POST /handover/:id/approve`, `GET /handover/:id/approvals`
- **Share and export:** `POST /handover/:id/share`, `GET /handover/:id/export.pdf` (viewer-filtered)
- **Assistant:** `POST /projects/:id/chat` (returns `{answer, citations[], suggestedActions[], insufficientEvidence}`)
- **Notifications:** `GET /notifications`, `PATCH /notifications/:id/read`
- **System:** `GET /system/status` (which integrations are configured: OpenAI, GitHub, storage, SMTP, AI service reachable)

## A9. Security and permission model

- Roles: org-level `admin | project_manager | developer`; project membership with its own role.
- JWT access token (about 15 min) plus refresh token in an httpOnly cookie. bcrypt hashing. Zod validation on every input. helmet, CORS allow-list, rate limiting on auth and chat.
- Secure uploads: allow-list of PDF/DOCX/TXT, size limit, magic-byte check (not just extension), sanitised filenames, no path traversal, files never served publicly (only through permission-checked routes).
- Secrets only in env. GitHub tokens encrypted at rest. Never log secrets or full document text.
- **Effective access to a source** = org member AND project member AND (`visibility === project` OR user is in `allowedUserIds`). Org admins can see all sources in their org.
- **`accessService` exposes:** `getAllowedSourceIds(user, project)`, `canViewSource`, `canViewEvidence`, `filterFactsForUser`, `filterReportForUser`. Everything uses these.
- **Report/fact visibility rule:** an item is shown to a viewer only if they can access **every** source cited by that item. Otherwise it is replaced by a placeholder such as "1 item hidden: restricted source". Never show hidden text, titles, counts derived from hidden content, or citation snippets. Dashboard counts for a viewer are computed from their visible facts only.
- **Chat:** retrieval is pre-filtered by `allowedSourceIds` (vector query filter), and answer citations are verified to be inside the retrieved set.
- Audit-log: logins, source changes, fact edits, approvals, shares, exports, views.

## A10. AI behaviour rules

- Structured outputs (Pydantic schema), low temperature, retries with backoff, per-chunk-batch token limits, timeouts. Model names come from env.
- Prompts live in `ai-service/app/pipeline/*/prompts.py` as versioned constants. Each prompt states: use only the provided text, quote verbatim evidence, say nothing if unsupported, use `null` for unknown owners/dates.
- Verify evidence programmatically (quote substring check). Do not trust the model's own claim of having evidence.
- Generator writes only from supplied facts. Anything with no usable evidence is rendered as "No evidence found".
- Assistant: answer only from retrieved chunks, cite sources, and say "I couldn't find evidence for this in the authorised sources" when retrieval is weak. Suggested next actions must also be grounded in pending tasks/risks/open questions.
- Never let facts from a source leak into an answer for a user who cannot access that source.

## A11. UI/UX direction

Professional SaaS look. Background `#0B1533`, panels `#142650`, accent teal `#26D6C1`, white text, light-grey secondary text. Rounded cards, subtle shadows, sidebar navigation, responsive (desktop, tablet, mobile), Framer Motion transitions, Recharts on the dashboard. Every screen has loading, empty and error states. Show "setup required" banners based on `/system/status`.

**Routes/pages:** Landing; Login/Register/Forgot password; Profile; Onboarding (org, workspace, invites, roles); Dashboard; Projects (list/create/edit/members); Knowledge Collection; AI Processing (live job progress per stage via Socket.IO); Handover Dashboard (sections: overview, completed, pending, responsibilities, decisions, dependencies, risks, unresolved questions, next actions, links; plus dependency graph and timeline); AI Assistant (chat with clickable source citations); Verification and Approval (verified/uncertain/conflicting tabs, side-by-side conflicts, confidence badges, edit/approve, approval history); Handover Report (preview, export PDF, share).

**Citation component:** one shared `<CitationChip>` that opens a drawer with the exact source snippet, locator (page/line/commit/issue) and source link. Reuse it everywhere (handover, review, chat).

## A12. Environment variables (provide `.env.example` per service)

- **backend:** `PORT, MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, CLIENT_URL, AI_SERVICE_URL, INTERNAL_SERVICE_KEY, WEBHOOK_HMAC_SECRET, TOKEN_ENCRYPTION_KEY, STORAGE_DRIVER, CLOUDINARY_*/S3_*, SMTP_* (optional), GITHUB_API_BASE (optional)`
- **ai-service:** `MONGODB_URI, BACKEND_INTERNAL_URL, INTERNAL_SERVICE_KEY, WEBHOOK_HMAC_SECRET, OPENAI_API_KEY, OPENAI_MODEL, OPENAI_EMBEDDING_MODEL, EMBEDDING_PROVIDER, VECTOR_INDEX_NAME`
- **frontend:** `VITE_API_URL, VITE_SOCKET_URL`

## A13. Demo data (real pipeline input, not fake output)

Create `demo-data/` for a fictional student hackathon project, with:
- 3-4 documents (PDF/DOCX/TXT): project plan, architecture notes, a README that says MongoDB
- Meeting notes with an informal decision "we will use PostgreSQL", plus one unanswered question and one named owner
- `github-fixture.json`: commits, 2 open PRs, a stale branch, issues (one marked done while its PR is open)
- One **restricted** source (e.g. "finance-private notes") that the incoming developer must NOT see

The README (MongoDB) vs notes (PostgreSQL) contradiction must be detectable as a conflict. If no GitHub token is configured, a clearly-labelled "Use demo fixture" option feeds the fixture through the same ingest path.

## A14. Stage gate protocol (follow for every stage)

For each stage I give you:
1. Re-read `docs/MASTER_PROMPT.md` and `docs/CONTRACTS.md`.
2. Briefly list the files you will create/change (no new dependencies outside A3 without asking).
3. Implement only that stage.
4. Run build, lint and tests; run the stage's "Done when" checks.
5. Update `docs/CONTRACTS.md` and README if anything changed.
6. End with a short report: what works, how to verify, known gaps. Do not start the next stage.

