# Backend Implementation Checklist

Use this as a task list for backend members and coding agents.

## Phase 1 — Setup

- [ ] Create Node/Express/TypeScript project.
- [ ] Configure `src/app.ts` and `src/server.ts`.
- [ ] Add environment loader.
- [ ] Connect MongoDB.
- [ ] Add global response helpers.
- [ ] Add global error handler.
- [ ] Add `GET /api/v1/health`.

Verification:

```bash
curl http://localhost:4000/api/v1/health
```

## Phase 2 — Auth

- [ ] User model.
- [ ] Register validation.
- [ ] Login validation.
- [ ] JWT signing.
- [ ] Auth middleware.
- [ ] `POST /auth/register`.
- [ ] `POST /auth/login`.
- [ ] `GET /auth/me`.
- [ ] `POST /auth/logout`.

Verification:

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dara","email":"dara@example.com","password":"Password123!"}'
```

## Phase 3 — Projects and boards

- [ ] Project model.
- [ ] Board model.
- [ ] Project membership helper.
- [ ] `GET /projects`.
- [ ] `POST /projects` and auto-create default board.
- [ ] `GET /projects/:projectId`.
- [ ] `PATCH /projects/:projectId`.
- [ ] `DELETE /projects/:projectId`.
- [ ] Members endpoints.
- [ ] Board endpoints.

## Phase 4 — Tasks and comments

- [ ] Task model.
- [ ] Comment model.
- [ ] Task CRUD.
- [ ] Move task endpoint.
- [ ] Comment CRUD.
- [ ] Activity logging for task/comment changes.

## Phase 5 — AI

- [ ] AI provider config.
- [ ] OpenAI/Groq adapter.
- [ ] `POST /ai/subtasks`.
- [ ] `POST /ai/description`.
- [ ] `POST /ai/summarize-comments`.
- [ ] Optional `POST /ai/search-tasks`.
- [ ] Rate limit AI endpoints if possible.

## Phase 6 — Socket.io

- [ ] Socket server setup.
- [ ] Socket JWT auth.
- [ ] `project:join` / `project:leave`.
- [ ] Emit project events.
- [ ] Emit board events.
- [ ] Emit task events.
- [ ] Emit comment events.

## Phase 7 — Analytics/deploy

- [ ] Activity endpoints.
- [ ] Notification endpoints.
- [ ] Analytics summary endpoint.
- [ ] Burndown endpoint.
- [ ] Production CORS.
- [ ] Render/Railway deployment.
- [ ] MongoDB Atlas connection.

## Do not skip

- Do not send passwordHash to frontend.
- Do not trust frontend-provided userId for ownership; use JWT user.
- Do not allow access to task/comment unless project membership is verified.
- Do not let frontend directly call AI provider.

