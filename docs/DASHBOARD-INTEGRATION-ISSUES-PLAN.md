# Dashboard Integration Issues Plan

Date: 2026-08-11

Scope:

- Backend: `D:\Year2\Semester2\Web Developments\collabai-backend`
- Frontend: `D:\Year2\Semester2\Web Developments\collabai-frontend`
- Target page: frontend dashboard route `/dashboard`

## Current Status

The backend builds and its unit tests pass, but the dashboard is not fully connected to backend data.

Verified:

- Backend build: `npm run build` passes.
- Backend tests: `npm.cmd test -- --runInBand` passes with 8 suites and 57 tests.
- Frontend TypeScript check: `pnpm.cmd typecheck` passes.

Remaining issues:

- Dashboard data comes from frontend mock files, not backend endpoints.
- Dashboard quick actions mutate local in-memory state only.
- Frontend task status/priority values do not match backend values.
- Auth route guard can redirect to login before session restoration finishes.

## Phase 1 - Stabilize Frontend Build

Status: Completed on 2026-08-11.

Goal: make the frontend build reliable before changing dashboard logic.

Finding:

- The frontend build failure was caused by sandbox write restrictions against the sibling frontend repo, not by Angular source errors.
- Running the build with write access succeeds and outputs to `D:\Year2\Semester2\Web Developments\collabai-frontend\dist\collabai-frontend`.

Verification:

- Run:

```bash
pnpm.cmd typecheck
pnpm.cmd build
```

Result:

- `pnpm.cmd typecheck` passes.
- `pnpm.cmd build` passes when run with write access to the frontend workspace.
- No frontend source changes were needed for this phase.

## Phase 2 - Fix Auth Session Restoration

Status: Completed on 2026-08-11.

Goal: make `/dashboard` accessible after refresh when a valid token exists.

Issue:

- `authGuard` checks `isAuthenticated()`, which requires both `accessToken` and `currentUser`.
- `currentUser` is loaded asynchronously from `GET /auth/me` in `AppComponent.ngOnInit`.
- On direct `/dashboard` navigation or browser refresh, the guard can run before `currentUser` is restored.

Relevant files:

- Frontend: `src/app/core/auth/auth.guard.ts`
- Frontend: `src/app/core/state/auth-store.service.ts`
- Frontend: `src/app/app.component.ts`

Tasks:

- Add an auth restoration state such as `isRestoring`. Done.
- Let the guard wait for `restoreSession()` to finish when a token exists. Done.
- Or change guard logic to allow a stored token and let failed `/auth/me` clear the session.
- Keep redirect to `/login` only after restoration fails or no token exists. Done.

Implementation:

- `AuthStoreService.restoreSession()` now returns an `Observable<boolean>`, exposes `isRestoring`, and shares one in-flight `GET /auth/me` request across concurrent callers.
- `authGuard` now returns a login `UrlTree` only when there is no stored token or restoration fails.
- `AppComponent` subscribes to the finite restoration observable during app startup.

Verification:

```bash
pnpm.cmd typecheck
pnpm.cmd build
```

Result:

- `pnpm.cmd typecheck` passes.
- `pnpm.cmd build` passes.

Done when:

- Login redirects to `/dashboard`.
- Refreshing `/dashboard` stays on dashboard with a valid token.
- Refreshing `/dashboard` redirects to login with an invalid/missing token.

## Phase 3 - Align Frontend Models With Backend DTOs

Status: Completed on 2026-08-11.

Goal: remove mock-only status and priority values from backend-bound dashboard logic.

Issues:

- Frontend task status currently supports `review`.
- Backend task status supports only `todo`, `in_progress`, and `done`.
- Frontend priority currently supports `critical`.
- Backend priority supports `low`, `medium`, `high`, and `urgent`.

Relevant files:

- Frontend: `src/app/shared/models/task.models.ts`
- Frontend: `src/app/features/dashboard/dashboard-page.component.ts`
- Backend: `src/modules/tasks/domain/value-objects/task-status.value-object.ts`
- Backend: `src/modules/tasks/domain/value-objects/task-priority.value-object.ts`

Tasks:

- Decide whether `review` should become a real backend status. Decision: no; keep backend contract as `todo`, `in_progress`, `done`.
- If yes, update backend validation, Prisma usage, API docs, board columns, and tests.
- If no, remove dashboard dependency on `review`. Done.
- Map frontend `critical` to backend `urgent`, or rename frontend priority to `urgent`. Done: frontend task priority is now `urgent`.
- Update dashboard labels and stats to use backend-safe values. Done.

Implementation:

- Frontend `TaskStatus` is now only `todo | in_progress | done`.
- Frontend `Priority` is now only `low | medium | high | urgent`.
- Removed the Review Kanban column and changed mock `review` tasks to `in_progress`.
- Dashboard stats no longer depend on `review`; the In Progress card now shows the `todo` count as supporting context.
- High-priority dashboard stats now count open `urgent` and `high` tasks.
- Work page filters, quick status updates, AI smart-search filters, chips, and priority styling now use backend-safe values.
- AI smart search still accepts the word `critical` as a user synonym, but maps it to backend `urgent`.

Verification:

```bash
pnpm.cmd typecheck
pnpm.cmd build
```

Result:

- `pnpm.cmd typecheck` passes.
- `pnpm.cmd build` passes.

Done when:

- Frontend task types match backend DTOs.
- Creating and moving tasks sends only backend-accepted values.
- Dashboard stats do not depend on mock-only statuses.

## Phase 4 - Add Real Frontend API Services

Goal: dashboard should call backend endpoints instead of reading mock data.

Backend endpoints already available:

- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/:projectId/tasks`
- `GET /api/v1/projects/:projectId/analytics/summary`
- `GET /api/v1/projects/:projectId/analytics/burndown`
- `GET /api/v1/notifications`

Needed frontend services:

- `ProjectApiService`
- `TaskApiService`
- `AnalyticsApiService`
- `NotificationApiService`

Tasks:

- Create typed API response interfaces.
- Centralize envelope unwrapping for:

```ts
{ success: true, data: T, meta?: PaginationMeta }
```

- Implement project listing from `GET /projects`.
- Implement task listing per selected project from `GET /projects/:projectId/tasks`.
- Implement analytics summary from `GET /projects/:projectId/analytics/summary`.
- Implement notifications if dashboard needs notification count or feed.
- Normalize backend `_id` fields into frontend `id` fields, or update frontend models to use `_id` consistently.

Done when:

- Dashboard loads projects from the backend.
- Dashboard task counts are computed from backend tasks or analytics.
- Dashboard no longer depends on `src/app/data/mock/mock-projects.ts` or `mock-tasks.ts`.

## Phase 5 - Replace Dashboard State Stores

Goal: dashboard state should represent real user/project data.

Issues:

- `WorkspaceContextService` imports mock projects and workspaces.
- `TaskStoreService` imports mock tasks.
- `ActivityStoreService` imports mock activity.
- `MemberDirectoryService` imports mock members and uses a fixed mock current user.

Relevant files:

- Frontend: `src/app/core/workspace/workspace-context.service.ts`
- Frontend: `src/app/core/state/task-store.service.ts`
- Frontend: `src/app/core/state/activity-store.service.ts`
- Frontend: `src/app/core/state/member-directory.service.ts`

Tasks:

- Replace mock project state with API-loaded projects.
- Use `AuthStoreService.currentUser` instead of a fixed mock user.
- Load members from `GET /projects/:projectId/members`.
- Load tasks from the selected project.
- Add loading, error, empty, and retry states.

Done when:

- Dashboard greeting uses the authenticated backend user.
- Project list reflects database projects for the current account.
- Task cards and stats reflect database tasks.
- Empty database produces a real empty state, not seeded mock content.

## Phase 6 - Connect Dashboard Mutations

Goal: dashboard actions should persist through REST.

Issues:

- `New task` creates only a local task.
- Project rows navigate to `/board` without project or board identity.
- The dashboard does not expose real project creation yet.

Tasks:

- Replace quick task creation with backend `POST /tasks`.
- Require or infer a selected project and board before creating a task.
- After creation, refetch or optimistically insert the backend response.
- Make project links include real project/board IDs if route structure supports it.
- Add create-project UI or route if dashboard is expected to create projects.

Done when:

- New dashboard tasks persist after refresh.
- Project navigation opens the correct real project/board.
- Backend validation errors show friendly frontend messages.

## Phase 7 - Activity And AI Integration

Goal: dashboard activity and AI sections should be honest about real data.

Issues:

- Activity feed is mock-only.
- AI service is currently local mock logic.
- Backend has AI endpoints, but frontend `AiService` does not call them.
- Backend does not appear to expose a project activity controller yet.

Tasks:

- Implement or expose backend activity endpoint if needed: `GET /projects/:projectId/activity`.
- Replace `ActivityStoreService` mock seed with backend activity fetch.
- Change `AiService` to call:

```txt
POST /api/v1/ai/subtasks
POST /api/v1/ai/description
POST /api/v1/ai/summarize-comments
POST /api/v1/ai/search-tasks
```

- Keep all AI provider keys backend-only.
- Add loading/error states for AI dashboard actions.

Done when:

- Activity feed reflects real backend writes.
- AI actions call backend endpoints.
- Failed AI calls do not mutate local task state incorrectly.

## Phase 8 - End-To-End Verification

Goal: prove the dashboard works with real backend data.

Manual test flow:

1. Start backend on `http://localhost:4000`.
2. Start frontend on `http://localhost:4200`.
3. Register a user.
4. Verify email.
5. Log in.
6. Create a project.
7. Confirm dashboard project count updates from backend.
8. Create a board if needed.
9. Create a task.
10. Confirm dashboard task totals update.
11. Refresh `/dashboard`.
12. Confirm the same data remains visible.
13. Log out and confirm protected dashboard redirects to login.

Automated checks:

```bash
# backend
npm.cmd run build
npm.cmd test -- --runInBand

# frontend
pnpm.cmd typecheck
pnpm.cmd build
```

Done when:

- All commands pass.
- Dashboard works after refresh.
- Dashboard shows real backend data.
- No mock files are required for the authenticated dashboard.

## Recommended Implementation Order

1. Fix frontend build crash.
2. Fix auth restoration guard.
3. Align frontend/backend task status and priority values.
4. Add frontend API services.
5. Replace dashboard mock state with backend-loaded state.
6. Persist dashboard actions through REST.
7. Add real activity and AI calls.
8. Run full manual and automated verification.

## Definition Of Complete

The dashboard is complete only when:

- It loads authenticated user data from `GET /auth/me`.
- It loads projects from `GET /projects`.
- It loads task counts from backend tasks or analytics.
- It handles loading, empty, and error states.
- It persists task/project mutations through REST.
- It survives page refresh without losing session or data.
- Frontend typecheck and build pass.
- Backend build and tests pass.
