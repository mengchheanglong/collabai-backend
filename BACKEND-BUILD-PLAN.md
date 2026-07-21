# Backend Build Plan — aligning the API to the frontend contract

> Purpose: build the backend so the **already-built Angular frontend** (`../collabai-frontend`)
> can be wired to real endpoints without changing its contract. The frontend is the consumer;
> its `docs/` are the source of truth.
>
> Frontend contract read from:
> `../collabai-frontend/docs/{API-CONTRACT.md, API-CLIENT-GUIDE.md, TYPESCRIPT-TYPES.md, REALTIME-SOCKET-CONTRACT.md}`

---

## 1. Current state audit (what exists today)

| Area | State |
|---|---|
| Stack | NestJS 11 · PostgreSQL + Prisma 6 · Redis (ioredis) · Swagger. All needed deps already installed (`socket.io`, `@nestjs/websockets`, `openai`, `bcryptjs`). |
| Wired modules | **Only `AuthModule`.** `app.module.ts` imports nothing else. |
| Auth module | Fully built — but cookie/refresh/verification model with `firstName`/`lastName`, `POST /auth/login` returns `{ accessToken }` only (refresh in cookie). No `/auth/me`, no `user` in body. |
| App root | `GET /` returns `"Hello"` string. Port **3000**. No global prefix. No CORS. No response envelope. No global JWT guard. No Socket.io. |
| projects / tasks / boards / comments / notifications / activity / analytics / ai | **Empty `export {}` placeholder stubs.** Not implemented, not wired. |
| Prisma schema | Has `User, RefreshToken, UserSettings, Project, ProjectMember, Task, Subtask, Label, TaskLabel, Comment, Activity, Notification`. **No `Board` model.** `Task` links directly to `Project` (no `boardId`). |

**Bottom line:** ~90% of the surface the frontend needs is not built yet. Auth exists but in a shape the frontend does not speak.

---

## 2. Contract vs. backend — the gaps that need decisions

These are the places where the frontend contract and the current backend disagree. Each has a **recommended default**; flagged ones (⚠️) are worth an explicit yes/no before Phase 1.

| # | Topic | Frontend contract wants | Backend has | Recommendation |
|---|---|---|---|---|
| G1 ⚠️ | **Auth model** | Stateless Bearer JWT. `register`/`login` → `{ accessToken, user }`. `GET /auth/me`. Token in `localStorage`. **No email verification, no refresh cookie, no reset** (none are in the contract, and the frontend has no UI for them). | Cookie + refresh rotation + email verification gating login. | For MVP integration, **serve the contract**: return `{ accessToken, user }`, add `/auth/me`, and **do not gate login on verification** (frontend can't satisfy it). Keep the advanced flows available but off the frontend's happy path. |
| G2 ⚠️ | **User name** | single `name` (2–80). | I recently split to `firstName`/`lastName`. | Revert the API boundary to a single `name`, or keep both columns and expose `name = first + last`. Contract only ever reads `name`. |
| G3 | **ID shape** | `_id` string on every DTO. Examples look Mongo-ish. | Postgres UUID `id`. | Keep Postgres. Map `id → _id` (string) in the response serializer. UUID values are fine as `_id`. |
| G4 | **Boards** | First-class `Board` with `columns[]`; project create auto-makes a "Main Board"; tasks carry `boardId`. | No Board model. | Add `Board` model + `Task.boardId`. |
| G5 | **Task shape** | Embedded `subtasks[]` (`_id,title,done`), `labels: string[]`, `position:number`, `assigneeId`, `commentCount`. | Separate `Subtask` + `Label`/`TaskLabel` tables; no `position`. | For MVP, simplify: `subtasks Json`, `labels String[]`, add `position Float`, `boardId`. (Drop the join tables unless you need label analytics.) |
| G6 | **Response envelope** | `{ success, data, message?, meta? }`; errors `{ success:false, error:{ code, message, details? } }`. | Mixed ad-hoc shapes; `TransformInterceptor` exists but is off and has a different shape. | Add a global success interceptor + exception filter that emit exactly the contract shapes. |
| G7 | **Realtime** | Socket.io on `:4000`, room `project:{id}`, JWT handshake, events per realtime contract. | None. | Build a single `EventsGateway` + emit-after-write. |
| G8 ⚠️ | **Token lifetime** | No refresh call in the frontend (on 401 it just logs out). | Access token 15 min. | With no refresh in the frontend, 15 min forces re-login every 15 min. Bump access TTL for MVP (e.g. 7 days) **or** decide the frontend will call refresh. |
| G9 | **Base URL / port** | `http://localhost:4000/api/v1`, socket `http://localhost:4000`. | Port 3000, no prefix. | Set port **4000**, global prefix **`api/v1`**, CORS origin `http://localhost:4200`. |

> Decisions I need before Phase 1: **G1, G2, G8** (and confirm G5 simplification). The rest I'll take the recommended default on unless you say otherwise.

---

## 3. Cross-cutting conventions (apply in every phase)

- **Serialization:** one mapper layer turns entities into contract DTOs — always `_id` (string), ISO date strings, embedded `author`/`members`/`subtasks`, computed `commentCount`.
- **Envelope:** controllers return raw `data`; the global interceptor wraps to `{ success:true, data, meta? }`. List endpoints attach `meta` (page/limit/total/totalPages).
- **Errors:** domain errors → global exception filter → `{ success:false, error:{ code, message, details? } }` using the contract's codes (`VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, INTERNAL_ERROR`).
- **AuthN/AuthZ:** global `JwtAuthGuard` with a `@Public()` escape hatch; `@CurrentUser()` decorator; a `ProjectMemberGuard` / role check (`owner|admin|member|viewer`) for project-scoped routes.
- **Every mutation** writes an `Activity` row and emits the matching socket event **after** the DB write commits.

---

## 4. Phases

Order follows the contract's own "implementation order" (API-CONTRACT §13), adapted to NestJS + Prisma.

### Phase 0 — Foundation & infra alignment
**Goal:** the app boots on the address/shape the frontend already points at.
- `main.ts`: port **4000**, `app.setGlobalPrefix('api/v1')`, `enableCors({ origin: 'http://localhost:4200' })`, keep global `ValidationPipe`.
- Add global **success interceptor** + **exception filter** (envelope + error codes, G6).
- Add `GET /health` → `{ status:'ok', service:'collabai-api' }` (public).
- Add global `JwtAuthGuard` + `@Public()` + `@CurrentUser()`.
- **DoD:** `GET /api/v1/health` returns the enveloped health body from port 4000; a thrown domain error returns the error envelope.

### Phase 1 — Auth aligned to contract (depends on G1/G2/G8)
**Goal:** frontend `auth.register/login/loadMe/logout` work verbatim.
- `POST /auth/register` → `201 { accessToken, user }`, single `name`, min-8 password, `409 CONFLICT` on dup email.
- `POST /auth/login` → `200 { accessToken, user }`, `401 UNAUTHORIZED` (don't reveal which field). Verification not gated for MVP.
- `GET /auth/me` → `{ user }` (uses `JwtAuthGuard` + `@CurrentUser`).
- `POST /auth/logout` → `{ success:true, data:null, message:'Logged out' }`.
- Reconcile `name` (G2); set access-token TTL per G8.
- **DoD:** frontend `AuthService` + interceptor + guard log in against real backend; token in `localStorage`; `/auth/me` rehydrates on refresh.

### Phase 2 — Users
- `GET /users/search?q=&limit=` → array of `{ _id, name, email, avatarUrl }` (min `q` 2 chars, limit default 10/max 20).
- **DoD:** invite-member autocomplete resolves real users.

### Phase 3 — Projects + membership + default board
**Goal:** dashboard + project settings + members panel.
- Wire `ProjectsModule` (models already exist). Endpoints: `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id`, `GET/POST /projects/:id/members`, `PATCH/DELETE /projects/:id/members/:userId`.
- `POST /projects` side effect: create default **Main Board** (needs Phase 4 model) with `todo/in_progress/done` columns; creator = `owner` member.
- Enforce role matrix (owner/admin/member/viewer) incl. "owner can't demote self unless another owner exists".
- Emit `project:updated/deleted`, `member:added/updated/removed`; write activity.
- **DoD:** create/list/open/update/delete projects; add/remove/change-role members; `ProjectDto.members[]` embedded.

### Phase 4 — Boards (new model, G4)
- Prisma: add `Board { id, projectId, name, description?, columns Json, timestamps }`; add `Task.boardId`. Migrate.
- Endpoints: `GET/POST /projects/:id/boards`, `GET /boards/:id?includeTasks=true`, `PATCH/DELETE /boards/:id`.
- Emit `board:created/updated/deleted`.
- **DoD:** board page loads via `GET /boards/:id?includeTasks=true` returning `{ board, tasks }`.

### Phase 5 — Tasks (Kanban core, G5)
- Prisma: `Task` gets `boardId`, `position Float`, `subtasks Json`, `labels String[]`, `assigneeId`, `createdById`. Migrate.
- Endpoints: `GET /projects/:id/tasks` (filters: `boardId,status,assigneeId,q,label,dueBefore,page,limit`), `POST /tasks`, `GET /tasks/:id` (→ `{ task, comments }`), `PATCH /tasks/:id`, `PATCH /tasks/:id/status` (status+position), `DELETE /tasks/:id`.
- Position strategy: spaced integers (1000, 2000…); allow fractional inserts.
- Emit `task:created/updated/moved/deleted`; write activity; notify assignee on assignment.
- **DoD:** drag/drop board persists via `/tasks/:id/status`; create/edit/delete tasks; task detail returns comments.

### Phase 6 — Comments
- `GET /tasks/:id/comments` (oldest first), `POST /tasks/:id/comments`, `PATCH/DELETE /comments/:id` (author or owner/admin).
- Embed `author` in `CommentDto`; keep `Task.commentCount` correct.
- Emit `comment:created/updated/deleted`; write activity.
- **DoD:** task detail comment thread works end-to-end.

### Phase 7 — Activity feed
- `GET /projects/:id/activity?page=&limit=` (default 30), enveloped with `meta`, embedded `actor`.
- Activity is already written by Phases 3–6; this exposes it. Emit `activity:created`.
- **DoD:** dashboard/project activity feed shows real events.

### Phase 8 — Notifications
- `GET /notifications?unreadOnly=&page=&limit=`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` (→ `{ updated:n }`).
- Written by task-assignment / mention side effects. Optionally emit `notification:created` to `user:{id}` room.
- **DoD:** notification list + mark-read work.

### Phase 9 — Analytics
- `GET /projects/:id/analytics/summary` (totals, completionRate, tasksByUser, tasksByPriority).
- `GET /projects/:id/analytics/burndown?days=` (default 14/max 60).
- Prisma aggregations over tasks.
- **DoD:** dashboard stat cards + burndown render from real data.

### Phase 10 — AI (openai already installed)
- `POST /ai/subtasks`, `POST /ai/description` (`generate|improve|shorten`), `POST /ai/summarize-comments`, `POST /ai/search-tasks`.
- Server-side API key only. `search-tasks` MVP: LLM → filter object → Prisma query (embeddings are bonus). Write `ai.*` activity.
- **DoD:** AI buttons/panels in the frontend return the contract shapes.

### Phase 11 — Socket.io realtime (G7)
- One `EventsGateway` on the same server (`:4000`, default namespace). JWT handshake from `auth.token` → `socket.data.user`.
- Client events: `project:join/leave` (verify membership, ack), optional `typing:start/stop`.
- Server events already emitted by Phases 3–8 broadcast to `project:{id}` with the realtime envelope `{ projectId, actorId, data, createdAt }`.
- **DoD:** two browsers on the same board see each other's task moves/comments live.

### Phase 12 — Hardening & verification
- Rate limits on auth/AI (throttler already configured), input validation parity with contract, DB indexes, seed script with contract-shaped sample data.
- E2E tests asserting each endpoint's **exact envelope** against `API-CONTRACT.md`.
- **DoD:** `pnpm check` green on frontend against the running backend; contract e2e suite passes.

---

## 5. Suggested milestones (integration-first)

1. **M1 – "Login works":** Phase 0 + 1. Frontend auth + protected routes go live.
2. **M2 – "Boards & tasks work":** Phase 3 + 4 + 5. Core Kanban is real. (Biggest slice.)
3. **M3 – "Collaboration":** Phase 6 + 7 + 8 + 11. Comments, activity, notifications, live updates.
4. **M4 – "Insights & AI":** Phase 9 + 10.
5. **M5 – Hardening:** Phase 12.

Each milestone is independently demoable; the frontend can flip services from mock → real one domain at a time (its `API-CLIENT-GUIDE.md` already anticipates this).

---

## 6. Open questions for you
- **G1:** MVP auth = simple Bearer contract (recommended), or keep verification/refresh on the frontend's path?
- **G2:** single `name` at the API (recommended) or keep `firstName`/`lastName` internally?
- **G8:** long-lived access token for MVP (recommended) or wire the frontend to a refresh endpoint?
- **G5:** accept the Task schema simplification (`subtasks Json`, `labels String[]`, `position`)?
