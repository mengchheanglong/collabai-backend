# CollabAI Phased Implementation Plan

This document establishes the architecture, specification, and execution blueprint for completing the five core milestones of the CollabAI platform:
1. **Workspace Documentation** (Completion, permissions, attachments, and real-time syncing)
2. **Real-time Collaboration** (Project presence, active task awareness, and socket resilience)
3. **Project Invitations** (User search autocomplete, lifecycle polish, and onboarding flow)
4. **AI Project Insights & Intelligent Automation** (Fixing proposals 404, predictive analytics)
5. **RabbitMQ Architecture** (Decoupling async background jobs: Email, AI, Web Push, and Audit logs)

---

## 1. Architectural Baseline & Principles

### 1.1 Current State Summary
From our comprehensive technical audit:
- **Backend:** NestJS 11 + Express + TypeScript + PostgreSQL + Prisma ORM.
- **Frontend:** Angular 21 + Angular Material + SCSS + Signals + Reactive Forms.
- **Real-Time:** Socket.io gateway implemented; tasks, comments, and documents emit domain events.
- **AI:** Endpoints `/ai/subtasks`, `/ai/description`, `/ai/summarize-comments`, `/ai/search-tasks`, `/ai/generate-tasks`, `/ai/chat`, and `/ai/project-insights` exist; `/ai/automation/proposals` is missing.
- **Messaging:** Currently 100% in-process via `@nestjs/event-emitter`.

### 1.2 Core Execution Rules
1. **Zero Downtime / Graceful Fallback:** Every external dependency (RabbitMQ, Redis, AI Providers, Mailjet) must fail-open or fall back to in-memory execution in local development.
2. **Strict Phase Gating:** Each phase must pass lint, typecheck, unit tests, and E2E verification before proceeding to the next.
3. **CQRS & Clean Architecture:** All backend business logic resides in command/query handlers under domain models, keeping controllers thin.

---

## 2. Phase-by-Phase Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Foundation & Quality Gates (CI, Lints, Attachment Contract)           │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────────┐
│ Phase 2: Workspace Documentation Hardening & Sync                              │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────────┐
│ Phase 3: Real-Time Presence & Collaboration Resilience                         │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────────┐
│ Phase 4: User Search & Invitation Lifecycle Integration                         │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────────┐
│ Phase 5: AI Intelligent Task Automation & Advanced Insights                    │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────────┐
│ Phase 6: RabbitMQ Event-Driven Background Processing Architecture               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation & Quality Gates [COMPLETED]

**Objective:** Clean all CI blockers, align mock typings, and standardize attachment payloads so subsequent feature work starts on a 100% green test and lint baseline.

### Step 1.1: Frontend CI Unblock (Lint Accessibility Bug) - [VERIFIED]
- **Target:** `collabai-frontend/src/app/features/board/board-page.component.html` (line 435).
- **Resolution:** Removed the redundant `autofocus` attribute on the dialog input, which resolves `@angular-eslint/template/no-autofocus`.
- **Verification:** Ran `npm --prefix "../collabai-frontend" run lint` -> **Exit code 0**.

### Step 1.2: Backend Test Suite Typing Fixes - [VERIFIED]
- **Target 1:** `collabai-backend/src/modules/notifications/application/commands/subscribe-push.handler.spec.ts` & `send-push-notification.handler.spec.ts`.
  - Added mock method `deleteByEndpointAndUserId: jest.fn().mockResolvedValue(undefined)` to satisfy `IPushSubscriptionRepository`.
- **Target 2:** `collabai-backend/src/modules/sync/application/queries/get-delta-sync.handler.spec.ts`.
  - Wrapped Prisma model methods in `jest.fn()` with explicit mock typings to eliminate 18 `TS2339` type errors.
- **Target 3:** `collabai-backend/src/modules/boards/presentation/controllers/boards.controller.spec.ts`.
  - Corrected type assertion for strict null safety on union result.
- **Verification:**
  - `npx tsc --noEmit` -> **Exit code 0**.
  - `npm test` -> **Exit code 0** (41 test suites passed, 328 tests passed).
  - `npm run build` -> **Exit code 0**.

### Step 1.3: Document Attachment Payload Specification - [VERIFIED]
- **Target:** `collabai-backend/src/modules/documents/application/dtos/create-document.dto.ts` & `update-document.dto.ts`.
- **Resolution:** Defined explicit JSON schema for attachments:
  ```typescript
  export interface DocumentAttachment {
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
  }
  ```
- **Verification:** Unit tests for `DocumentsController` and DTO serialization pass cleanly with exit code 0.

### Phase 1 Definition of Done (DoD) - [ALL PASSED]
- `collabai-frontend`:
  - `npm run lint` -> **Exit code 0** (0 errors)
  - `npm run typecheck` -> **Exit code 0**
  - `npm run test` -> **Exit code 0** (all 6 UI workflows, edge cases, realtime state passed)
  - `npm run build` -> **Exit code 0** (bundle generated cleanly in `dist/collabai-frontend`)
- `collabai-backend`:
  - `npx tsc --noEmit` -> **Exit code 0** (0 type errors)
  - `npm test` -> **Exit code 0** (41/41 suites, 328/328 tests passed)
  - `npm run build` -> **Exit code 0** (`nest build` complete)

---

## Phase 2: Workspace Documentation Hardening & Real-Time Sync [COMPLETED]

**Objective:** Elevate the existing Document module into a collaborative, rich project documentation hub with role permissions, real-time edit alerts, and document export.

### Step 2.1: Real-Time Document Collaboration Events - [VERIFIED]
- **Backend Gateway (`events.gateway.ts` & `events.gateway.spec.ts`):**
  - Added `@SubscribeMessage('doc:editing:start')`: broadcasts `doc:editing:started` to `project:${projectId}` room with `documentId`, `userId`, `userName`.
  - Added `@SubscribeMessage('doc:editing:stop')`: broadcasts `doc:editing:stopped`.
  - In `handleDisconnect`: automatically emits `doc:editing:stopped` if user disconnected while editing a document.
  - Verified with 3 unit tests in `events.gateway.spec.ts` (12/12 tests passing).
- **Frontend Service & Component (`socket.service.ts` & `docs-page.component.ts`):**
  - Added `docEditing(documentId: string, active: boolean)` to `SocketService`.
  - Subscribed to `doc:editing:started` and `doc:editing:stopped` in `DocsPageComponent`.
  - Added active collaborator badge: `✍️ [Alice] is currently editing this document` with pulsing indicator.
  - Added remote conflict detection banner upon `document:updated` event: `⚠️ A teammate updated this document remotely.` with "Reload Latest" and "Keep My Changes" actions.

### Step 2.2: Document Role-Based Access Control (RBAC) - [VERIFIED]
- **Backend Command Handlers & Controller:**
  - `CreateDocumentHandler`: Enforces `ProjectRoles.canWriteContent(membership.role)`. Rejects `viewer` role with `DocumentForbiddenError` (HTTP 403).
  - `UpdateDocumentHandler`: Enforces `ProjectRoles.canWriteContent(membership.role)`. Rejects `viewer` role with `DocumentForbiddenError`.
  - `DeleteDocumentHandler`: Enforces `ProjectRoles.canWriteContent(membership.role)`. Rejects `viewer` role with `DocumentForbiddenError`.
  - `GetDocumentHandler`: Returns `{ ...view, canEdit: ProjectRoles.canWriteContent(membership.role) }`.
  - `DocumentsController`: Dynamically responds with `{ document, canEdit }` based on user project role.
  - Added unit test suites: `delete-document.handler.spec.ts` and `get-document.handler.spec.ts`. All 6 document suites pass (26/26 tests).
- **Frontend (`docs-page.component.ts` & `.html`):**
  - When `!canEdit()`, displays `👁️ View Only` badge in header.
  - Inputs `#doc-title` and `#doc-content` are disabled/hidden, defaults to rendered markdown preview.
  - Action buttons (Save, Attachments, Dropzone, Delete) are hidden for viewers.

### Step 2.3: Document Export & Markdown Utilities - [VERIFIED]
- **Frontend (`docs-page.component.ts` & `.scss`):**
  - `exportMarkdown()`: Triggers clean `.md` blob download named after the document title.
  - `exportPdf()`: Activates preview and triggers `window.print()` with `@media print` stylesheets that strip toolbars, sidebars, and banners, rendering high-contrast printable document layout.

### Phase 2 Definition of Done (DoD) - [ALL PASSED]
- `collabai-frontend`:
  - `npm run lint` -> **Exit code 0** (0 lint errors)
  - `npm run typecheck` -> **Exit code 0**
  - `npm run test` -> **Exit code 0** (all 10 assertions in docs workflow pass, including presence, conflict, export, viewer lock)
  - `npm run build` -> **Exit code 0** (production bundle generated in `dist/collabai-frontend`)
- `collabai-backend`:
  - `npx tsc --noEmit` -> **Exit code 0**
  - `npm test` -> **Exit code 0** (43/43 suites, 341/341 tests passing)
  - `npm run build` -> **Exit code 0** (`nest build` complete)

---

## Phase 3: Real-Time Collaboration (Presence & Socket Resilience) [COMPLETED]

**Objective:** Implement multi-user presence indicators ("Who is online"), live active-task indicators, and hardened socket reconnection logic.

### Step 3.1: Backend Presence Tracking in `EventsGateway` - [VERIFIED]
- **Data Structure & Socket Events (`events.gateway.ts` & `events.gateway.spec.ts`):**
  - Implemented `projectPresence: Map<string, Map<string, { userId: string; name: string; avatarUrl?: string; joinedAt: Date }>>`.
  - Added helper `broadcastPresence(projectId: string)` emitting `presence:update` to room `project:${projectId}` with unique online members.
  - Handled in `project:join`, `project:leave`, and `handleDisconnect` (pruning presence on disconnection).
  - Added `@SubscribeMessage('task:viewing:start')` and `@SubscribeMessage('task:viewing:stop')` with automatic disconnect cleanup broadcasting `task:viewing:started` / `task:viewing:stopped`.
  - Unit test suite `events.gateway.spec.ts` passed 15/15 unit tests cleanly.

### Step 3.2: Frontend Live Presence UI - [VERIFIED]
- **Services (`socket.service.ts` & `live-collaboration.service.ts`):**
  - Added `taskViewing(taskId: string, active: boolean)` to `SocketService`.
  - Added signals `onlineUsers`, `onlineUsersLabel`, and `taskViewers` to `LiveCollaborationService`.
  - Added helper `taskViewersFor(taskId: string)` returning list of names viewing a specific task.
  - Integrated constructor effect auto-dispatching `startViewingTask(id)` and `stopViewingTask(id)` when `activeTask()` changes.
- **Board & Task Cards (`board-page.component.ts`, `.html`, `.scss`, `task-card.component.ts`, `.html`, `.scss`):**
  - Added `.online-presence-stack` in board toolbar displaying active teammate avatars, live pulse dot, and count indicator.
  - Added `.tc-viewer-badge` to task cards showing `👁️ [Name]` badge when a teammate opens the task detail drawer.

### Step 3.3: Socket Resilience & Reconnect Reconciliation - [VERIFIED]
- **Reconciliation Tests (`tests/realtime-state.test.ts`):**
  - Verified `presence:update` payload handling, active user filtering, disconnect pruning, and task viewing events.
  - All 14 test scenarios in `realtime-state.test.ts`, `edge-cases.test.ts`, and `ui-workflows.test.ts` passed cleanly.

### Phase 3 Definition of Done (DoD) - [ALL PASSED]
- `collabai-frontend`:
  - `npm run lint` -> **Exit code 0** (0 lint errors across TS & HTML)
  - `npm run typecheck` -> **Exit code 0** (0 errors)
  - `npm run test` -> **Exit code 0** (all 6 UI workflows, edge cases, realtime state passed)
  - `npm run build` -> **Exit code 0** (bundle generated cleanly in `dist/collabai-frontend`)
- `collabai-backend`:
  - `npx tsc --noEmit` -> **Exit code 0** (0 type errors)
  - `npm test` -> **Exit code 0** (43/43 suites, 344/344 tests passed, including presence & task viewing)
  - `npm run build` -> **Exit code 0** (`nest build` complete)

---

## Phase 4: Project Invitations & User Search Wiring [COMPLETED]

**Objective:** Connect the existing unused `GET /users/search` endpoint into the invite dialog, add user autocompletion, and refine the invitation lifecycle.

### Step 4.1: User Autocomplete in Invite Modal - [VERIFIED]
- **Frontend Services & Components (`team-page.component.ts`, `.html`, `.scss`):**
  - Injected `UserApiService` into `TeamPageComponent`.
  - Added debounced user autocomplete (250ms delay, minimum 2 characters) with reactive signals `searchSuggestions`, `isSearchingUsers`, and `selectedUser`.
  - Rendered interactive autocomplete panel displaying user avatars, names, emails, and platform tags, with disable state if already an active project member.
  - Added single-click suggestion selection, user tag display, and removal toggle.
  - In `sendInvite()`: handles existing user addition directly or non-registered email dispatch with appropriate toasts.

### Step 4.2: Invitation Lifecycle & Expiration UX - [VERIFIED]
- **Backend Expiration & Token Renewal (`projects.controller.ts`, `resend-invitation.handler.ts` & specs):**
  - Exposed `invitationExpiresAt` in `ProjectsController.listMembers()` pending responses.
  - In `ResendInvitationHandler`: generates fresh cryptographic UUID token (`uuidv4()`), updates database invitation record with `expiresAt = Date.now() + 7 days`, and dispatches email with renewed token link.
  - Added full test suite `resend-invitation.handler.spec.ts` (6/6 tests passing) and `search-users.handler.spec.ts` / `users.controller.spec.ts` (4/4 tests passing).
- **Frontend Expiration & Accept Polishing (`member-directory.service.ts`, `accept-invite.component.ts`):**
  - Formatted expiration labels dynamically: `Expires in X days`, `Expires in <1h`, or `Expired`.
  - Added `.tm-expires-tag` with `.is-expired` styling in the People directory table.
  - Polished `AcceptInviteComponent`: auto-selects accepted workspace in `WorkspaceContextService`, routes directly to `/board`, and renders clear expiration cards with contact admin guidance when tokens expire.

### Phase 4 Definition of Done (DoD) - [ALL PASSED]
- `collabai-frontend`:
  - `npm run lint` -> **Exit code 0** (0 errors, 0 warnings across all files)
  - `npm run typecheck` -> **Exit code 0**
  - `npm run test` -> **Exit code 0** (all 7 workflow suites passed including team autocomplete and accept-invite)
  - `npm run build` -> **Exit code 0** (bundle generated cleanly in `dist/collabai-frontend`)
- `collabai-backend`:
  - `npx tsc --noEmit` -> **Exit code 0**
  - `npm test` -> **Exit code 0** (46/46 suites, 354/354 tests passed)
  - `npm run build` -> **Exit code 0** (`nest build` complete)

---

## Phase 5: AI Project Insights & Intelligent Task Automation [COMPLETED]

**Objective:** Implement the `POST /ai/automation/proposals` and `POST /ai/automation/proposals/:planId/apply` endpoints on the backend, enhance LLM context with velocity and bottleneck metrics, and make AI recommendations one-click actionable.

### Step 5.1: Implement Task Automation Proposals Backend - [VERIFIED]
- **Endpoints Implemented in `AiController` (`ai.controller.ts` & `ai.controller.spec.ts`):**
  - `POST /api/v1/ai/automation/proposals`: Calls `ProposeTaskActionsCommand`.
  - `POST /api/v1/ai/automation/proposals/:planId/apply`: Calls `ApplyTaskActionsCommand`.
- **Domain & Providers (`ai-provider.interface.ts`, `stub-ai.provider.ts`, `openai.provider.ts`, `deepseek.provider.ts`):**
  - Added `proposeTaskActions()` to `IAiProvider`, returning structured `ProposeTaskActionsOutput` with typed `ProposedAction[]`.
- **Command Handlers & Storage (`propose-task-actions.handler.ts`, `apply-task-actions.handler.ts`, `proposal-plan.store.ts`):**
  - `ProposeTaskActionsHandler`: Validates membership, aggregates project tasks and active members, calls provider, stores plan with 15-minute TTL.
  - `ApplyTaskActionsHandler`: Enforces write permissions via `AiAccessService.requireWriter()`, applies mutations to tasks via Prisma, and emits `task.updated` domain events.
  - Added unit test suites `propose-task-actions.handler.spec.ts` and `apply-task-actions.handler.spec.ts`. All 48 backend test suites pass (360/360 tests).

### Step 5.2: Enhanced Predictive Analytics in Insights - [VERIFIED]
- **Backend (`generate-project-insights.handler.ts` & spec):**
  - Incorporated cycle time calculations (`avgCycleTimeDays`), completion rate, overdue ratios, and workload bottleneck detection (>5 active tasks).
  - Verified with `generate-project-insights.handler.spec.ts`.

### Step 5.3: Frontend UI Workflow Integration - [VERIFIED]
- In `tests/ui-workflows.test.ts`:
  - Added `testAiTaskAutomationWorkflow()` testing proposal request, selection toggles, approval, state mutations, and activity refresh.
  - All 8 comprehensive UI workflows passed.

### Phase 5 Definition of Done (DoD) - [ALL PASSED]
- `collabai-frontend`:
  - `npm run lint` -> **Exit code 0** (0 lint errors across TS & HTML)
  - `npm run typecheck` -> **Exit code 0**
  - `npm run test` -> **Exit code 0** (all 8 UI workflows pass, 100% green)
  - `npm run build` -> **Exit code 0** (production bundle generated in `dist/collabai-frontend`)
- `collabai-backend`:
  - `npx tsc --noEmit` -> **Exit code 0**
  - `npm test` -> **Exit code 0** (48/48 suites, 360/360 tests passing)
  - `npm run build` -> **Exit code 0** (`nest build` complete)

---

## Phase 6: RabbitMQ Event-Driven Background Processing

**Objective:** Decouple all heavy and asynchronous operations from REST request cycles using RabbitMQ message queues with dead-letter exchange (DLQ) support and graceful local fallback.

### Step 6.1: Infrastructure Configuration
- **Update `docker-compose.yml`:**
  ```yaml
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: collabai-rabbitmq
    ports:
      - "5672:5672"     # AMQP protocol
      - "15672:15672"   # Management Web UI
    environment:
      RABBITMQ_DEFAULT_USER: collabai
      RABBITMQ_DEFAULT_PASS: collabai123
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
  ```
- **Configuration & Env:**
  - `RABBITMQ_URL="amqp://collabai:collabai123@localhost:5672"`
  - `RABBITMQ_ENABLED="true"` (if false or connection fails, fall back to in-memory `EventEmitter2`).

### Step 6.2: RabbitMQ Core Module in NestJS
- **Module:** `src/shared/infrastructure/rabbitmq/rabbitmq.module.ts`.
- **Implementation:** Use `amqp-connection-manager` + `amqplib`:
  - Handles auto-reconnect without crashing NestJS process.
  - Declares exchanges and queues on bootstrap:
    - Exchange: `collabai.events` (Topic Exchange).
    - Dead-letter Exchange: `collabai.dlx`.

### Step 6.3: Queue Topology & Consumers

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Exchange: collabai.events                       │
└────┬─────────────────┬───────────────────┬──────────────────────┬──────┘
     │ routing_key:    │ routing_key:      │ routing_key:         │ routing_key:
     │ email.*         │ ai.*              │ push.*               │ activity.*
┌────▼──────────┐ ┌────▼────────────┐ ┌────▼──────────────┐ ┌─────▼──────────┐
│ Queue: email  │ │ Queue: ai.jobs  │ │ Queue: push.fanout│ │ Queue: activity│
└────┬──────────┘ └────┬────────────┘ └────┬──────────────┘ └─────┬──────────┘
     │                 │                   │                      │
┌────▼──────────┐ ┌────▼────────────┐ ┌────▼──────────────┐ ┌─────▼──────────┐
│ Worker:       │ │ Worker:         │ │ Worker:            │ │ Worker:        │
│ Mailjet/Resend│ │ LLM Insights/   │ │ Web Push VAPID     │ │ Activity Table │
│ SMTP Service  │ │ Task Generation │ │ Fanout Deliveries  │ │ Persistence    │
└───────────────┘ └─────────────────┘ └────────────────────┘ └────────────────┘
```

1. **Queue: `collabai.email`**
   - **Events:** `email.verify`, `email.password-reset`, `email.project-invitation`.
   - **Consumer:** Picks up payload, calls `EmailService.send*()`, retries up to 3 times on network failure, then moves to DLQ.
   - **Benefit:** `register`, `invite-member`, and `forgot-password` REST endpoints respond in <30ms without waiting for Mailjet/SMTP roundtrips.

2. **Queue: `collabai.ai.jobs`**
   - **Events:** `ai.generate-tasks`, `ai.project-insights`.
   - **Consumer:** Executes provider call, writes result to database/cache, emits socket event when job is complete.

3. **Queue: `collabai.notifications.push`**
   - **Events:** `push.broadcast`.
   - **Consumer:** Iterates over user `PushSubscription` records, calls Web Push VAPID API asynchronously, automatically prunes HTTP 410 (expired) endpoints.

4. **Queue: `collabai.activity` (Solves Missing Activity Feature)**
   - **Events:** `task.created`, `task.moved`, `task.deleted`, `comment.created`, `document.created`, etc.
   - **Consumer:** Writes audit record to PostgreSQL `Activity` table; emits `activity:created` over websockets.
   - **Endpoint:** Implement `GET /projects/:projectId/activity` controller querying this table to make the Dashboard Activity Feed fully functional.

### Step 6.4: Graceful Fallback Strategy
```typescript
if (!this.rabbitConnected) {
  this.logger.warn('RabbitMQ disconnected. Processing event in-process synchronously.');
  return this.fallbackEventEmitter.emit(event.name, event.payload);
}
```
This ensures developers without RabbitMQ running locally can continue development uninterrupted.

### Phase 6 Definition of Done (DoD)
- RabbitMQ container runs via Docker Compose with web management console at port 15672.
- Inviting a member queues the email and returns 201 Created immediately.
- The `collabai.activity` queue persists audit log events to the database and powers `GET /projects/:projectId/activity`.
- Simulated RabbitMQ outages trigger graceful fallback to local synchronous execution.

### Phase 6 Implementation Status - [IMPLEMENTED — live broker check pending]
- **Core (`src/shared/infrastructure/rabbitmq/`):** `RabbitMQService` (implements `IEventBus`, injected via `EVENT_BUS`) declares `collabai.events` (topic) + `collabai.dlx`, and the four queues `collabai.email`, `collabai.ai.jobs`, `collabai.notifications.push`, `collabai.activity`, each dead-lettering to `<queue>.dlq`. Publishes use a confirm channel; failed jobs are re-published with `x-retry-count` up to 3 times, then dead-lettered. Auto-reconnects every 5 s.
- **Fallback (Step 6.4):** when `RABBITMQ_ENABLED` is not `"true"`, the broker is down, or a publish is not confirmed, the same worker runs in-process on the next tick (with the same 3 retries). `GET /health` reports `jobQueue: connected | disconnected | disabled`.
- **Email:** auth emails (`email.verify`, `email.password-reset`, `email.password-reset-success`) and invitations (`email.project-invitation`, from invite + resend) are queued; `EmailWorker` delivers with `throwOnError` so failures retry.
- **Push:** `NotificationEventsListener` queues `push.broadcast`; `PushWorker` runs `SendPushNotificationCommand`.
- **Activity:** new `ActivityModule` — `ActivityEventsListener` queues task/comment/document events, `ActivityLogWorker` writes the `Activity` row (new nullable `message` column, idempotent by job id) and emits `activity:created`; `GET /projects/:projectId/activity` returns `{ items, meta }`.
- **AI:** `POST /ai/jobs` (202) queues `ai.project-insights` / `ai.generate-tasks`; `AiInsightsWorker` emits `ai:job:completed` / `ai:job:failed` to `user:{userId}`.
- **Verification:** `npx tsc --noEmit` exit 0; `npm test` 56/56 suites, 409/409 tests; `npm run build` exit 0. Not yet run against a live RabbitMQ container (Docker daemon was not running).
- **Deploy notes:** run `npm run prisma:deploy` (adds `Activity.message`); set `RABBITMQ_ENABLED="true"` + `RABBITMQ_URL` where a broker exists (default is in-process).

---

## 3. Rollout Matrix & Verification Schedule

| Phase | Core Deliverables | Automated Test Verification | Manual Verification Milestone |
| :--- | :--- | :--- | :--- |
| **Phase 1** | CI unblock, mock fixes, attachment schema | `pnpm lint`, `pnpm typecheck`, `npm test` | Green GitHub Actions run on both repositories |
| **Phase 2** | Real-time docs, RBAC, export tools | Unit tests for document permissions | Multi-tab live editing alert and markdown export |
| **Phase 3** | Presence indicators, reconnect refetch | Realtime state test suite | Avatars appear in header and on active task cards |
| **Phase 4** | Autocomplete search, invite lifecycle | Acceptance & expiration unit tests | Autocomplete user pick; accept email link flow |
| **Phase 5** | Task automation backend (`/ai/automation`) | Automation command & handler tests | Dashboard "Automate task changes" executes without 404 |
| **Phase 6** | RabbitMQ broker, decoupled queues, activity log | Broker connect & message dispatch tests | RabbitMQ UI queue monitoring; async email delivery |

---

## 4. Next Step

Upon user approval of this phased plan, implementation will begin with **Phase 1: Foundation & Quality Gates**, establishing a clean, error-free testing and linting baseline.
