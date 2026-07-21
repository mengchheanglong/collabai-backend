# Backend Business-Logic Build Plan

> Scope: implement the **domain/business logic** of the five empty modules
> (`projects`, `tasks`, `comments`, `notifications`, `ai`), following the DDD/CQRS pattern
> the `auth` module already establishes. **No frontend wiring** in this plan (no port/prefix
> changes, no response envelope, no Socket.io). Pure backend functionality on the existing
> PostgreSQL + Prisma schema.

---

## 1. Starting point

- **Only `auth` is implemented.** All 104 files under `projects/tasks/comments/notifications/ai`
  are empty `export {}` placeholders.
- Prisma schema already defines: `User, Project, ProjectMember, Task, Subtask, Label, TaskLabel,
  Comment, Activity, Notification` (no `Board` model).
- We reuse the auth idiom for every module:
  - **domain/** — entities (with `create`/`fromPersistence`/`toPersistence`), value objects, repository interfaces (DI tokens), pure domain services.
  - **application/** — CQRS commands + handlers, queries + handlers, DTOs, typed `*.errors.ts`.
  - **infrastructure/** — Prisma repository implementations.
  - **presentation/** — controller (guarded by `JwtAuthGuard` + `@CurrentUser`) + exception filter mapping domain errors → HTTP.
  - **`<module>.module.ts`** — binds ports→impls, registers handlers, imports `CqrsModule` + `SharedModule` (+ `AuthModule` for the guard), wired into `app.module.ts`.

## 2. Cross-cutting rules (every module)

- **Authorization** lives in pure domain services (e.g. `ProjectRoles`): roles are `owner > admin > member > viewer`.
  - owner: full control incl. delete project + manage admins.
  - admin: manage members + edit project + full content.
  - member: create/edit content (tasks, comments).
  - viewer: read-only.
- Handlers throw typed domain errors; the module's exception filter maps `code → HTTP status`
  (`NOT_FOUND 404`, `FORBIDDEN 403`, `CONFLICT 409`, `VALIDATION 400`).
- Every state change is done through the aggregate entity, persisted via its repository.
- Domain events (`@nestjs/event-emitter`) fire for cross-module reactions (e.g. task assigned → notification). Kept internal; no sockets here.
- Each module ships at least one `*.spec.ts` for its domain service / a key handler (matching auth's test style).

---

## 3. Phases

### Phase 1 — Projects  *(in progress)*
Foundational; tasks/comments hang off a project.
- **Entities:** `ProjectEntity`, `ProjectMemberEntity`. **VO:** `ProjectRole` + `ProjectRoles` permissions.
- **Commands:** create (creator→owner member), update (admin+), delete (owner only), add-member (admin+, by email), update-member-role (admin+; only owner touches admins; can't demote last owner), remove-member (admin+, or self).
- **Queries:** list projects for current user (paginated, `q` search), get project + members, list members.
- **Rules:** unique name per owner; last-owner protection; membership required to read.
- **Errors:** `ProjectNotFound, NotProjectMember, InsufficientProjectPermission, DuplicateProjectName, MemberAlreadyExists, MemberNotFound, InviteeNotFound, InvalidProjectRole, LastOwner`.
- **DoD:** full CRUD + membership works via CommandBus/QueryBus; module wired; compiles; domain-service spec passes.

### Phase 2 — Tasks
Depends on Projects (membership check) — note: schema has `Task → Project` directly (no Board), so this phase stays board-agnostic.
- **Entity:** `TaskEntity`. **VOs:** `TaskStatus` (`todo|in_progress|done`), `TaskPriority` (`low|medium|high|urgent`). Subtasks via existing `Subtask` table (or JSON — decide in phase).
- **Commands:** create (member+), update fields (member+), move/reorder status+position (member+), delete (member+), add-subtask / toggle-subtask, assign (must be project member).
- **Queries:** list tasks by project (filters: status, assignee, `q`, label, dueBefore; paginated), get task.
- **Rules:** assignee must be a project member; viewers can't write; position ordering (spaced integers/fractional).
- **Events:** `task.created`, `task.assigned`, `task.moved`, `task.completed`.
- **DoD:** task lifecycle + filtering works; assignment authorization enforced; specs pass.

### Phase 3 — Comments
- **Entity:** `CommentEntity`.
- **Commands:** add (member+, on a task in a project you belong to), edit (author or admin/owner), delete (author or admin/owner).
- **Queries:** list comments for a task (oldest first).
- **Rules:** author-or-moderator permission; comment count derivable for tasks.
- **Events:** `comment.added`, `mention.created` (parse `@mentions` → notifications).
- **DoD:** comment CRUD + moderation rules + mention extraction; specs pass.

### Phase 4 — Notifications
- **Entity:** `NotificationEntity`. **VO:** `NotificationType`.
- **Commands:** create (internal, from event handlers), mark-as-read, mark-all-read.
- **Queries:** list current user's notifications (unreadOnly, paginated).
- **Consumes events:** task-assigned, mention-created → creates notifications.
- **DoD:** notifications generated from events; read/unread transitions work; specs pass.

### Phase 5 — AI
- **Provider:** OpenAI (dep installed), server-side key; behind a domain `AiService` port so it's swappable/muellable.
- **Commands/queries:** suggest-subtasks, generate/improve/shorten description, summarize-comments, natural-language task search (LLM → filter object → Prisma query).
- **Rules:** auth required; project-scoped calls require membership; validate counts/modes.
- **DoD:** each AI operation returns structured output; membership enforced; provider mockable in tests.

### Phase 6 — Analytics (optional, if wanted)
- Read-only aggregations over tasks per project: summary (totals, completion rate, by-user, by-priority) and burndown series. Pure Prisma aggregation queries; no new tables.

---

## 4. Build order & dependencies
```
Projects ──► Tasks ──► Comments ──► Notifications
                └────────────────► (task-assigned event) ─┘
Projects ──► AI (project-scoped ops)
Projects + Tasks ──► Analytics
```
Each phase is independently compilable and testable, wired into `app.module.ts` when done.

## 5. Decisions to confirm before continuing
1. **Subtasks storage (Phase 2):** keep the existing `Subtask` table (relational) **or** collapse to a `Json` column on `Task` (simpler)? → default: keep the table since the schema already has it.
2. **Labels (Phase 2):** use the existing `Label`/`TaskLabel` join tables **or** a simple `String[]` on `Task`? → default: keep join tables (already in schema); no migration.
3. **Board:** the schema has no `Board`. Stay board-agnostic (tasks belong to projects) for now? → default: yes, skip boards in the business-logic pass.
4. **Analytics (Phase 6):** in scope now or later? → default: later.

---

## 6. Progress
- [x] Plan written (this file)
- [x] **Phase 1 Projects — COMPLETE** (awaiting approval). Full vertical slice: role VO + permissions,
      typed errors, `Project`/`ProjectMember` entities, repository port + Prisma impl, pure domain
      service, 6 command handlers (create/update/delete/invite/update-role/remove) + 3 query handlers
      (list/get/list-members), DTOs + response mappers, exception filter, guarded controller, module
      wired into `app.module.ts`. `TokenBlacklistService` now exported from AuthModule for the guard.
      Domain-service spec added. `tsc --noEmit` clean; 36 tests pass (23 auth + 13 projects).
- [x] **Phase 2 Tasks — COMPLETE** (awaiting approval). Full vertical slice: `TaskStatus`/`TaskPriority`
      VOs, `Task`/`Subtask` entities (completedAt kept in sync with done), repository port + Prisma impl
      (subtasks + label upsert + comment count + filters), pure `TaskDomainService` (kanban position math),
      `TaskAccessService` (reuses projects' `PROJECT_REPOSITORY` for membership/role), 7 command handlers
      (create/update/move/delete + add/update/delete-subtask) + 2 query handlers (list/get), domain events
      (created/assigned/moved) for later phases, DTOs + mapper, exception filter, guarded controller, module
      wired. **Schema:** added `Task.position Float @default(0)` (prisma client regenerated) — ⚠️ needs a
      DB migration (`prisma migrate`) when a database is available. `tsc` clean; 42 tests pass.
- [x] **Phase 3 Comments — COMPLETE** (awaiting approval). Full vertical slice on the `Comment` model
      (`content`→body, `userId`→authorId, project derived via task): `CommentEntity`, repository port +
      Prisma impl (author-joined views, hard delete so `commentCount` stays correct), pure
      `CommentDomainService` (@email mention extraction), `CommentAccessService` (member/writer +
      author-or-moderator rules, mention→member resolution), 3 command handlers (add/edit/delete) + 1
      query (list oldest-first), `comment.added` + `comment.mention.created` events for Phase 4, DTOs +
      mapper, exception filter, guarded controller, module wired. `tsc` clean; 46 tests pass.
- [x] **Phase 4 Notifications — COMPLETE** (awaiting approval). Full vertical slice on the `Notification`
      model (`message`→body, `isRead`→read): `NotificationType` VO, `NotificationEntity` (idempotent
      markRead), repository port + Prisma impl (paginated, unreadOnly, markAll returns count), pure
      `NotificationDomainService` (message templates), **`NotificationEventsListener` that consumes
      `task.assigned` + `comment.mention.created`** and creates notifications (skips self-assignment,
      fail-safe so a notification error never breaks the source action), 3 command handlers
      (create/mark-read/mark-all) + 1 query, exception filter, guarded controller (list/read/read-all),
      module wired. This closes the loop on the events emitted in Phases 2–3. `tsc` clean; 49 tests pass.
- [ ] Phase 5 AI
- [ ] Phase 6 Analytics (optional)
