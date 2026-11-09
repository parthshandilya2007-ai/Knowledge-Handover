# Knowledge Handover Platform

> **Tagline:** Replace the Person, Not the Knowledge.

The Knowledge Handover Platform collects project knowledge (documents, GitHub commits/issues/PRs, meeting notes), analyzes it with AI, and produces a reviewable, evidence-linked, permission-aware handover so incoming engineers hit the ground running.

---

## 1. Quick Start Commands

The project is structured into three decoupled services adhering to strict contracts:

| Service | Technology | Port | Start Command |
|---|---|---|---|
| **Frontend** | React (Vite) + Tailwind CSS + TanStack Query | `5173` | `npm run start:frontend` |
| **Backend** | Node.js + Express (TypeScript) | `5000` | `npm run start:backend` |
| **AI Service** | Python + FastAPI + Pydantic | `8000` | `npm run start:ai` |

To run the Stage 0 internal security & plumbing verification suite:
```bash
npm run verify:stage0
```

---

## 2. Architecture & Design Rules

- **Frontend:** React SPA (Vite, TypeScript, Tailwind CSS, TanStack Query, Framer Motion, Recharts, Socket.IO client). Talks **only** to Express.
- **Backend:** Express (TypeScript, Mongoose, Zod, JWT, bcrypt, Multer, Socket.IO, helmet). System of record, RBAC gate, audit logger, and job orchestrator.
- **AI Service:** FastAPI (Python, Pydantic, PyMuPDF, python-docx, OpenAI SDK). Stateless intelligence for chunking, vector indexing, extraction, reconciliation, and RAG.
- **Database & Vectors:** Unified MongoDB Atlas cluster hosting application data and the `chunks` collection with Atlas Vector Search (`$vectorSearch`).
- **Single Permission Gate:** All authorization decisions are strictly evaluated in `accessService` on the backend. The AI service receives pre-filtered `allowedSourceIds`.
- **Verbatim Quote Verification:** All extracted facts require verifiable verbatim quote substrings from source chunks. Unsupported claims are flagged `uncertain` or dropped.
- **Evidence-Linked Handover Reports:** 11-section structured reports (Overview, Completed Work, Pending Work, Responsibilities, Decisions, Dependencies, Risks, Open Questions, Next Actions, First-Week Plan, Important Links) with citations, conflict detection, and viewer-level source redaction.

For detailed architecture diagrams, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).  
For the complete API contract and schema specifications, see [CONTRACTS.md](docs/CONTRACTS.md).  
For permission rules and access models, see [PERMISSIONS.md](docs/PERMISSIONS.md).

---

## 3. Environment Setup

Copy `.env.example` to `.env` in each service directory:

```bash
# Backend (.env)
cp backend/.env.example backend/.env

# AI Service (.env)
cp ai-service/.env.example ai-service/.env

# Frontend (.env)
cp frontend/.env.example frontend/.env
```

### Key Environment Variables

#### Backend (`backend/.env`)
- `PORT`: HTTP port (`5000`)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET`: Auth secrets
- `AI_SERVICE_URL`: AI service URL (`http://localhost:8000`)
- `INTERNAL_SERVICE_KEY`: Shared secret header (`X-Internal-Key`) for Express $\rightarrow$ FastAPI calls
- `WEBHOOK_HMAC_SECRET`: Secret used for HMAC-SHA256 signature on FastAPI $\rightarrow$ Express webhooks
- `TOKEN_ENCRYPTION_KEY`: 64-hex char AES key for tokens at rest
- `STORAGE_DRIVER`: `local` (dev), `s3` or `cloudinary` (prod)
- `OPENAI_API_KEY`: (Optional) OpenAI API key
- `GITHUB_TOKEN`: (Optional) GitHub personal access token

#### AI Service (`ai-service/.env`)
- `PORT`: HTTP port (`8000`)
- `INTERNAL_SERVICE_KEY`: Must match backend `INTERNAL_SERVICE_KEY`
- `WEBHOOK_HMAC_SECRET`: Must match backend `WEBHOOK_HMAC_SECRET`
- `BACKEND_INTERNAL_URL`: Backend URL (`http://localhost:5000`)
- `OPENAI_API_KEY`: (Optional) OpenAI API key
- `OPENAI_MODEL`: `gpt-4o-mini`
- `OPENAI_EMBEDDING_MODEL`: `text-embedding-3-small`

---

## 4. Test Suites

Run individual test suites:
```bash
# Backend unit & integration tests (Jest)
npm run test:backend

# AI service unit & security tests (pytest)
npm run test:ai

# End-to-end Stage 0 verification script
npm run verify:stage0
```

