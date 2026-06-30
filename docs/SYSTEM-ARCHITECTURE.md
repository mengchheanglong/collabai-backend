# CollabAI System Architecture

## High-level architecture

```txt
Angular 18+ SPA
  |
  | REST JSON over HTTP: /api/v1/*
  | Socket.io websocket/polling: project rooms
  v
Node.js + Express API
  |-- Auth middleware: JWT
  |-- REST controllers/services
  |-- Socket.io event broadcaster
  |-- AI service wrapper: OpenAI or Groq
  v
MongoDB via Mongoose
```

## Runtime components

### Frontend

- Angular standalone components.
- Angular Router with lazy-loaded feature routes.
- Angular Material for UI.
- Angular CDK drag/drop for Kanban.
- Services + signals for state.
- HTTP interceptor for JWT.
- Socket service for real-time events.

### Backend

- Express app mounted at `/api/v1`.
- Mongoose connection.
- JWT auth middleware.
- Zod or Joi request validation.
- Socket.io server attached to HTTP server.
- AI provider adapter so OpenAI/Groq can be swapped.

### Database

MongoDB collections:

- `users`
- `projects`
- `boards`
- `tasks`
- `comments`
- `activities`
- `notifications`

### AI provider

AI provider key stays in backend environment variables.

Supported feature endpoints:

- `POST /api/v1/ai/subtasks`
- `POST /api/v1/ai/description`
- `POST /api/v1/ai/summarize-comments`
- `POST /api/v1/ai/search-tasks`

For MVP, `search-tasks` can use normal MongoDB text search plus AI query rewriting. Embeddings are optional bonus.

## Data flow examples

### Login

1. Frontend sends `POST /auth/login` with email/password.
2. Backend verifies password with bcrypt.
3. Backend returns `accessToken` and `user`.
4. Frontend stores token and calls `GET /auth/me` on app start.

### Create task

1. User opens board and submits task form.
2. Frontend sends `POST /tasks`.
3. Backend validates user membership in the project.
4. Backend saves task.
5. Backend creates activity entry.
6. Backend emits `task:created` to room `project:{projectId}`.
7. Backend returns created task.
8. All connected clients update task list.

### Drag task to new status

1. Frontend uses Angular CDK drag/drop.
2. Frontend optimistically updates local UI.
3. Frontend sends `PATCH /tasks/:taskId/status`.
4. Backend validates allowed status and project permission.
5. Backend updates `status` and `position`.
6. Backend emits `task:moved` to project room.
7. Other clients update board.

## Environments

### Development

- Angular dev server: `http://localhost:4200`
- Express server: `http://localhost:4000`
- API base URL: `http://localhost:4000/api/v1`
- Socket URL: `http://localhost:4000`
- MongoDB: local or Atlas.

### Production

Possible deployment:

- Frontend: Vercel/Netlify.
- Backend: Render/Railway.
- Database: MongoDB Atlas.

## Security rules

- Hash passwords with bcrypt.
- Never return `passwordHash` in API responses.
- All project/board/task/comment access must verify project membership.
- AI endpoints require auth and must enforce project membership when task/project IDs are passed.
- Add CORS origin allowlist via environment variable.
- Rate-limit auth and AI endpoints if time allows.

## Integration source of truth

- REST: `docs/02-API-CONTRACT.md`
- Database: `docs/03-DATABASE-SCHEMA.md`
- Socket.io: `docs/04-REALTIME-SOCKET-CONTRACT.md`
- AI prompts/provider behavior: `docs/05-AI-FEATURES.md`
- Shared DTOs: `shared/TYPESCRIPT-TYPES.md`

