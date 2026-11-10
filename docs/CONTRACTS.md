# Knowledge Handover Platform — Contracts and Specifications

This document defines the single source of truth for schemas, enums, endpoints, internal service communications, and websocket event names. All code in `backend/`, `ai-service/`, and `frontend/` must adhere strictly to this contract. Any contract modification must be approved and documented here before code changes.

---

## 1. Global API Conventions

### 1.1 API Response Envelope
All public and internal endpoints must return the standardized response envelope:

**Success Response:**
```json
{
  "ok": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | INTERNAL_ERROR",
    "message": "Human-readable error description",
    "details": {}
  }
}
```

---

## 2. Enums and State Machines

### 2.1 Source
- `SourceType`: `"document" | "github" | "meeting_note" | "text"`
- `SourceStatus`: `"uploaded" | "parsing" | "chunking" | "embedding" | "ready" | "failed"`
- `SourceVisibility`: `"project" | "restricted"`

### 2.2 Processing Job
- `JobStatus`: `"queued" | "extracting" | "reconciling" | "persisting" | "drafting" | "completed" | "failed"`
- `JobStage`: `"queued" | "extracting" | "reconciling" | "persisting" | "drafting" | "completed" | "failed"`

### 2.3 Facts (Tasks, Decisions, Risks, Dependencies)
- `FactType`: `"task" | "decision" | "risk" | "dependency"`
- `FactStatus` (AI Status): `"verified" | "uncertain" | "conflicting"`
  - `verified`: Quote check passed verbatim AND confidence $\ge 0.75$ AND no conflicts.
  - `conflicting`: Contradiction detected across sources.
  - `uncertain`: Quote check failed, low confidence ($< 0.75$), or missing evidence.
- `FactReviewStatus` (Human Status): `"pending" | "approved" | "edited" | "rejected"`
- `FactOrigin`: `"ai" | "user"`

#### Entity-Specific Sub-Enums:
- `TaskStatus`: `"completed" | "pending" | "upcoming"`
- `RiskKind`: `"risk" | "problem" | "open_question" | "missing_info"`
- `RiskSeverity`: `"low" | "medium" | "high"`
- `DependencyType`: `"task" | "component" | "person" | "service" | "external"`

### 2.4 Handover Report
- `ReportStatus`: `"draft" | "in_review" | "approved" | "shared"`
- `ReportSectionKey`:
  - `"overview"`
  - `"completed_work"`
  - `"pending_work"`
  - `"responsibilities"`
  - `"decisions"`
  - `"dependencies"`
  - `"risks"`
  - `"open_questions"`
  - `"next_actions"`
  - `"first_week_plan"`
  - `"important_links"`
- `ReportItemFlag`: `"no_evidence" | "uncertain" | "conflict"`
- `ReportItemReviewStatus`: `"pending" | "approved" | "edited" | "rejected"`

### 2.5 Organization & Project Membership
- `OrgRole`: `"admin" | "project_manager" | "developer"`
- `ProjectRole`: `"manager" | "contributor" | "viewer"`

---

## 3. Data Schemas

### 3.1 Source
```typescript
interface ISource {
  _id: string;
  projectId: string;
  orgId: string;
  type: "document" | "github" | "meeting_note" | "text";
  title: string;
  url?: string;
  fileRef?: string;
  status: "uploaded" | "parsing" | "chunking" | "embedding" | "ready" | "failed";
  error?: string;
  visibility: "project" | "restricted";
  allowedUserIds: string[]; // only relevant if visibility === "restricted"
  externalId?: string;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 Chunk (FastAPI-owned, stored in MongoDB `chunks`)
```typescript
interface IChunk {
  _id: string;
  chunkId: string; // unique UUID
  sourceId: string;
  projectId: string;
  order: number;
  text: string;
  textHash: string; // sha256
  locator: {
    page?: number;
    lineStart?: number;
    lineEnd?: number;
    paragraph?: number;
    itemType?: "readme" | "issue" | "pull_request" | "commit" | "doc";
    itemId?: string;
    url?: string;
  };
  embedding: number[]; // e.g. 1536 float dimensions
  createdAt: string;
}
```

### 3.3 Evidence
```typescript
interface IEvidence {
  _id: string;
  projectId: string;
  sourceId: string;
  chunkId: string;
  quote: string; // verbatim substring from chunk
  locator: Record<string, unknown>;
  url?: string;
  createdAt: string;
}
```

### 3.4 Fact Base & Derived Models
```typescript
interface IFactBase {
  _id: string;
  projectId: string;
  title: string;
  description: string;
  evidenceIds: string[];
  confidence: number; // 0.0 to 1.0
  status: "verified" | "uncertain" | "conflicting";
  reviewStatus: "pending" | "approved" | "edited" | "rejected";
  conflictGroupId?: string;
  fingerprint: string; // unique content signature for deduplication
  origin: "ai" | "user";
  editedBy?: string;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ITask extends IFactBase {
  taskStatus: "completed" | "pending" | "upcoming";
  ownerName?: string;
  ownerUserId?: string;
  dueDate?: string;
}

interface IDecision extends IFactBase {
  rationale?: string;
  decidedBy?: string;
  decidedAt?: string;
}

interface IRisk extends IFactBase {
  kind: "risk" | "problem" | "open_question" | "missing_info";
  severity: "low" | "medium" | "high";
}

interface IDependency extends IFactBase {
  fromRef: string;
  toRef: string;
  dependencyType: "task" | "component" | "person" | "service" | "external";
  note?: string;
}
```

### 3.5 Handover Report
```typescript
interface IReportItem {
  id: string;
  text: string;
  factRefs: Array<{ kind: "task" | "decision" | "risk" | "dependency"; id: string }>;
  citations: string[]; // evidenceIds
  flag?: "no_evidence" | "uncertain" | "conflict";
  reviewStatus: "pending" | "approved" | "edited" | "rejected";
}

interface IReportSection {
  key: string;
  title: string;
  items: IReportItem[];
  approvedBy?: string;
  approvedAt?: string;
}

interface IHandoverReport {
  _id: string;
  projectId: string;
  version: number;
  status: "draft" | "in_review" | "approved" | "shared";
  generatedFromJobId?: string;
  sections: IReportSection[];
  approvals: Array<{ by: string; at: string; note?: string }>;
  shares: Array<{
    userId: string;
    expiresAt: string;
    viewLog: Array<{ viewedAt: string; ip?: string }>;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

### 3.6 Audit Log & Notification
```typescript
interface IAuditLog {
  _id: string;
  actorId: string;
  action: string;
  entityType: "source" | "fact" | "report" | "auth" | "project" | "share";
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  at: string;
}

interface INotification {
  _id: string;
  userId: string;
  type: string;
  message: string;
  link?: string;
  readAt?: string;
  createdAt: string;
}

### 3.7 Contextual AI Assistant & RAG
```typescript
interface IChatRequest {
  question: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

interface IChatCitation {
  chunkId: string;
  sourceId: string;
  quote: string;
  locator?: {
    page?: number;
    lineStart?: number;
    lineEnd?: number;
    paragraph?: number;
    itemType?: string;
    itemId?: string;
    url?: string;
  };
  sourceTitle?: string;
  sourceType?: string;
  url?: string;
}

interface IChatResponse {
  answer: string;
  citations: IChatCitation[];
  suggestedActions: string[];
  insufficientEvidence: boolean;
}
```
```

---

## 4. REST API Endpoints (`/api/v1`)

### 4.1 Authentication & Users
- `POST /api/v1/auth/register` $\rightarrow$ `{ token, user }`
- `POST /api/v1/auth/login` $\rightarrow$ `{ token, user }`
- `POST /api/v1/auth/refresh` $\rightarrow$ `{ token }`
- `POST /api/v1/auth/logout` $\rightarrow$ `{ success: true }`
- `POST /api/v1/auth/forgot-password` $\rightarrow$ `{ message }`
- `POST /api/v1/auth/reset-password` $\rightarrow$ `{ success: true }`
- `GET /api/v1/users/me` $\rightarrow$ `{ user }`
- `PATCH /api/v1/users/me` $\rightarrow$ `{ user }`

### 4.2 Organisations
- `POST /api/v1/orgs` $\rightarrow$ `{ org }`
- `GET /api/v1/orgs/:id` $\rightarrow$ `{ org }`
- `POST /api/v1/orgs/:id/invites` $\rightarrow$ `{ invite }`
- `PATCH /api/v1/orgs/:id/members/:userId` $\rightarrow$ `{ member }`

### 4.3 Projects
- `POST /api/v1/projects` $\rightarrow$ `{ project }`
- `GET /api/v1/projects` $\rightarrow$ `{ projects: [] }`
- `GET /api/v1/projects/:id` $\rightarrow$ `{ project }`
- `PATCH /api/v1/projects/:id` $\rightarrow$ `{ project }`
- `DELETE /api/v1/projects/:id` $\rightarrow$ `{ success: true }`
- `POST /api/v1/projects/:id/members` $\rightarrow$ `{ project }`
- `DELETE /api/v1/projects/:id/members/:userId` $\rightarrow$ `{ project }`

### 4.4 Sources
- `POST /api/v1/projects/:id/sources/upload` (Multer multipart: `file`, `title?`, `visibility`, `allowedUserIds?`) $\rightarrow$ `{ source }`
- `POST /api/v1/projects/:id/sources/github` (`{ repoUrl?, token?, useFixture?: boolean, visibility?: "project" | "restricted", allowedUserIds?: string[] }`) $\rightarrow$ `{ source, itemCount }`
- `POST /api/v1/projects/:id/sources/notes` (`{ title, content, type: "meeting_note" | "text", visibility, allowedUserIds? }`) $\rightarrow$ `{ source }`
- `GET /api/v1/projects/:id/sources` $\rightarrow$ `{ sources: [] }` (viewer-filtered via `accessService.getAllowedSourceIds`)
- `PATCH /api/v1/sources/:id/visibility` (`{ visibility, allowedUserIds? }`) $\rightarrow$ `{ source }`
- `POST /api/v1/sources/:id/reprocess` $\rightarrow$ `{ source }`
- `DELETE /api/v1/sources/:id` $\rightarrow$ `{ success: true }`

### 4.5 Processing & Jobs
- `POST /api/v1/projects/:id/analyze` $\rightarrow$ `{ job }`
- `GET /api/v1/projects/:id/jobs` $\rightarrow$ `{ jobs: [] }`
- `GET /api/v1/jobs/:id` $\rightarrow$ `{ job }`

### 4.6 Facts & Evidence
- `GET /api/v1/projects/:id/tasks` $\rightarrow$ `{ tasks: [] }`
- `GET /api/v1/projects/:id/decisions` $\rightarrow$ `{ decisions: [] }`
- `GET /api/v1/projects/:id/risks` $\rightarrow$ `{ risks: [] }`
- `GET /api/v1/projects/:id/dependencies` $\rightarrow$ `{ dependencies: [] }`
- `PATCH /api/v1/facts/:kind/:id` $\rightarrow$ `{ fact }`
- `POST /api/v1/facts/:kind` $\rightarrow$ `{ fact }`
- `DELETE /api/v1/facts/:kind/:id` $\rightarrow$ `{ success: true }`
- `GET /api/v1/evidence/:id` $\rightarrow$ `{ evidence, snippet }` (permission-checked)

### 4.7 Handover Reports
- `POST /api/v1/projects/:id/handover/generate` $\rightarrow$ `{ report }`
- `GET /api/v1/projects/:id/handover` $\rightarrow$ `{ report }` (viewer-filtered)
- `GET /api/v1/projects/:id/handover/view-logs` $\rightarrow$ `{ stats: { totalViews, uniqueViewers, totalPdfExports, totalShares }, timeline: [] }` (manager-only)
- `PATCH /api/v1/handover/:id/items/:itemId` $\rightarrow$ `{ item }`
- `POST /api/v1/handover/:id/sections/:key/approve` $\rightarrow$ `{ section }`
- `POST /api/v1/handover/:id/approve` $\rightarrow$ `{ report }`
- `GET /api/v1/handover/:id/approvals` $\rightarrow$ `{ approvals: [] }`

### 4.8 Sharing, Export & Assistant
- `POST /api/v1/handover/:id/share` $\rightarrow$ `{ shareUrl, expiresAt }`
- `GET /api/v1/handover/:id/export.pdf` $\rightarrow$ PDF binary stream
- `POST /api/v1/projects/:id/chat` $\rightarrow$ `{ answer, citations: [], suggestedActions: [], insufficientEvidence: boolean }`

### 4.9 System & Notifications
- `GET /api/v1/system/status` $\rightarrow$ `{ openai: boolean, github: boolean, storage: string, smtp: boolean, aiService: boolean }`
- `GET /api/v1/notifications` $\rightarrow$ `{ notifications: [], unreadCount: number }`
- `PATCH /api/v1/notifications/:id/read` $\rightarrow$ `{ notification }`
- `POST /api/v1/notifications/read-all` $\rightarrow$ `{ count: number, message: string }`

---

## 5. Internal Service Communications

Internal endpoints are protected by shared secrets and are **never** accessible to public clients.

### 5.1 Express $\rightarrow$ FastAPI
- **Security:** Header `X-Internal-Key: <INTERNAL_SERVICE_KEY>`
- **Endpoints:**
  - `GET /internal/health` $\rightarrow$ `{ status: "ok", timestamp }`
  - `POST /internal/sources/ingest` $\rightarrow$ triggers parsing, chunking, embedding for a source
  - `DELETE /internal/sources/{sourceId}` $\rightarrow$ deletes chunks for a source
  - `POST /internal/pipeline/run` $\rightarrow$ runs extraction & reconciliation for a project
  - `POST /internal/generate` $\rightarrow$ drafts report sections from provided facts
  - `POST /internal/chat` $\rightarrow$ executes RAG retrieval and answers with citations

### 5.2 FastAPI $\rightarrow$ Express
- **Security:** Header `X-Signature: sha256=<HMAC>` where HMAC is computed using `WEBHOOK_HMAC_SECRET` over the raw JSON payload.
- **Webhook Endpoint:**
  - `POST /internal/webhooks/pipeline`
  - Payload:
    ```typescript
    interface IPipelineWebhookPayload {
      jobId: string;
      projectId: string;
      stage: "parsing" | "chunking" | "embedding" | "extracting" | "reconciling" | "persisting" | "drafting" | "completed" | "failed";
      progress: number; // 0 to 100
      sourceId?: string;
      error?: string;
      results?: {
        facts?: Array<any>;
        evidence?: Array<any>;
        conflicts?: Array<any>;
        draftSections?: Array<any>;
      };
    }
    ```

### 5.3 FastAPI File Fetching
- `GET /internal/files/{sourceId}` on Express (requires `X-Internal-Key`) streams source file bytes to FastAPI without exposing storage credentials.

---

## 6. Socket.IO Real-Time Events

- **Authentication:** Handshake JWT auth via `auth: { token: "<JWT>" }`.
- **Rooms:** `project:<projectId>`
- **Client $\rightarrow$ Server Events:**
  - `join_project`: `{ projectId }`
  - `leave_project`: `{ projectId }`
- **Server $\rightarrow$ Client Events:**
  - `pipeline:progress`: `{ jobId, projectId, stage, progress, sourceId? }`
  - `pipeline:completed`: `{ jobId, projectId }`
  - `pipeline:failed`: `{ jobId, projectId, error }`
  - `source:updated`: `{ sourceId, status }`
  - `report:updated`: `{ reportId, version, status }`
  - `notification:new`: `{ notification }`

