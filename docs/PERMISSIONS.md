# Permission & Security Specification

This document details the Role-Based Access Control (RBAC) and resource-level permission model enforced by the platform.

---

## 1. Core Rule & Architecture
All access decisions are evaluated strictly in the backend by a single centralized module: **`accessService`**. 
No controller, service, or frontend component is permitted to evaluate custom or ad-hoc authorization checks.

---

## 2. Organization & Project Roles

### 2.1 Organization Roles
- **`admin`**: Full administrative access to the organization, all projects, members, billing, and all sources (including restricted sources).
- **`project_manager`**: Can create and manage projects, invite collaborators, upload and manage sources, trigger analysis jobs, and approve handover reports.
- **`developer`**: Can view assigned projects, read sources they have access to, participate in handovers, and interact with the AI assistant. Cannot perform org-level admin operations.

### 2.2 Project Roles
- **`manager`**: Manages project settings, members, source visibility, analysis runs, and report approval.
- **`contributor`**: Can upload sources, edit unapproved facts, and view project contents subject to source visibility.
- **`viewer`**: Read-only access to approved handover reports and project data permitted by source visibility.

---

## 3. Effective Source Access Model

A user $U$ has effective access to a source $S$ belonging to project $P$ and organization $O$ if and only if:
1. $U$ is an active member of organization $O$, **AND**
2. One of the following holds:
   - $U$ has role `admin` in organization $O$, **OR**
   - $U$ is a member of project $P$, **AND**:
     - $S.\text{visibility} = \text{"project"}$, **OR**
     - $S.\text{visibility} = \text{"restricted"}$ **AND** $U.\_id \in S.\text{allowedUserIds}$.

---

## 4. Derived Visibility Rules

### 4.1 Fact Visibility
A Fact (Task, Decision, Risk, Dependency) cites one or more `evidenceIds`.
- A user can see a fact **only if** they have effective access to **every source** referenced by the fact's evidence items.
- If any cited source is inaccessible to the user, the fact is excluded from their view.

### 4.2 Report Section Visibility & Redaction
Handover report items cite one or more `citations` (evidence IDs).
- An item is rendered in clear text **only if** the user has access to all supporting sources.
- If a cited source is restricted, the item content, title, and citations are withheld and replaced with a placeholder:
  > *"1 item hidden: restricted source"*
- Hidden items never leak text, titles, derived counts, or locators.

### 4.3 Dashboard Counts
- All metric counters (total completed tasks, pending risks, total decisions) shown on a user's dashboard are computed dynamically from their permitted visible set. Restricted counts are not leaked.

### 4.4 AI Assistant (RAG) Filtering
- When a user asks a question in `/api/v1/projects/:id/chat`, Express first invokes `accessService.getAllowedSourceIds(user, project)`.
- The list of allowed source IDs is supplied to the AI service.
- The AI service performs Atlas Vector Search with a strict pre-filter:
  `{ "sourceId": { "$in": allowedSourceIds } }`.
- Retrieved citations are cross-verified against `allowedSourceIds` before answering. If retrieval yields insufficient evidence, the assistant responds:
  > *"I couldn't find evidence for this in your authorized sources."*

---

## 5. `accessService` Interface

```typescript
interface IAccessService {
  getAllowedSourceIds(userId: string, projectId: string): Promise<string[]>;
  canViewSource(userId: string, sourceId: string): Promise<boolean>;
  canViewEvidence(userId: string, evidenceId: string): Promise<boolean>;
  filterFactsForUser<T extends IFactBase>(userId: string, projectId: string, facts: T[]): Promise<T[]>;
  filterReportForUser(userId: string, report: IHandoverReport): Promise<IHandoverReport>;
}
```
