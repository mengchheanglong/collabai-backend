# CollabAI Backend Spec

Backend stack:

- Node.js + Express.
- TypeScript recommended.
- MongoDB + Mongoose.
- JWT + bcrypt.
- Socket.io.
- OpenAI/Groq provider adapter.
- Zod for validation recommended.

## Backend goals

- Provide stable REST API matching `docs/02-API-CONTRACT.md`.
- Enforce auth and project membership on every protected resource.
- Broadcast changes via Socket.io after successful writes.
- Keep provider API keys private.
- Return consistent envelopes for success/error.

## Suggested backend structure

```txt
backend/
  collabai-api/
    src/
      server.ts
      app.ts
      config/
        env.ts
        database.ts
        cors.ts
      common/
        errors.ts
        response.ts
        async-handler.ts
        pagination.ts
        object-id.ts
      middleware/
        auth.middleware.ts
        error.middleware.ts
        validate.middleware.ts
        project-access.middleware.ts
      modules/
        auth/
          auth.routes.ts
          auth.controller.ts
          auth.service.ts
          auth.validation.ts
        users/
          users.routes.ts
          users.controller.ts
          users.service.ts
        projects/
          project.model.ts
          projects.routes.ts
          projects.controller.ts
          projects.service.ts
          members.service.ts
        boards/
          board.model.ts
          boards.routes.ts
          boards.controller.ts
          boards.service.ts
        tasks/
          task.model.ts
          tasks.routes.ts
          tasks.controller.ts
          tasks.service.ts
        comments/
          comment.model.ts
          comments.routes.ts
          comments.controller.ts
          comments.service.ts
        activity/
          activity.model.ts
          activity.service.ts
          activity.routes.ts
        notifications/
          notification.model.ts
          notifications.routes.ts
          notifications.service.ts
        analytics/
          analytics.routes.ts
          analytics.controller.ts
          analytics.service.ts
        ai/
          ai.routes.ts
          ai.controller.ts
          ai.service.ts
          providers/
            openai.provider.ts
            groq.provider.ts
      sockets/
        socket.server.ts
        socket.auth.ts
        project.rooms.ts
      types/
        express.d.ts
```

## Required environment variables

```txt
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/collabai
JWT_SECRET=replace-with-long-random-secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:4200
AI_PROVIDER=openai
OPENAI_API_KEY=
GROQ_API_KEY=
AI_MODEL=gpt-4o-mini
AI_MAX_TOKENS=800
```

## Middleware order

1. `helmet()`
2. `cors()`
3. `express.json()`
4. `morgan()` in dev
5. REST routes under `/api/v1`
6. not found handler
7. error handler

## Auth implementation

### Register

- Validate input.
- Lowercase email.
- Check uniqueness.
- Hash password with bcrypt.
- Create user.
- Return JWT + UserDto.

### Login

- Find by lowercase email.
- Compare password with bcrypt.
- Return same shape as register.

### Auth middleware

- Read `Authorization` header.
- Verify Bearer token.
- Load user ID into `req.user`.
- Reject missing/invalid tokens with `401`.

## Project access implementation

Create reusable helper:

```ts
assertProjectMember(projectId: string, userId: string): Promise<ProjectMember>
assertProjectRole(projectId: string, userId: string, roles: Role[]): Promise<ProjectMember>
```

Every endpoint involving project/board/task/comment must verify project access.

For board/task/comment endpoints, load entity first, get its `projectId`, then verify membership.

## Response helpers

Use helpers so all endpoints match envelope:

```ts
ok(res, data, message?)
created(res, data, message?)
fail(res, status, code, message, details?)
```

## Error handling

Throw typed app errors:

```ts
throw new AppError(404, 'NOT_FOUND', 'Task not found');
```

Final error middleware converts all errors to API envelope.

## Socket integration

- Initialize Socket.io in `server.ts` after HTTP server creation.
- Verify JWT in socket middleware.
- Export emit helpers:

```ts
emitToProject(projectId, eventName, payload)
emitToUser(userId, eventName, payload)
```

Controllers/services should call emit helper after database writes.

## AI implementation

Use provider adapter:

```ts
interface AiProvider {
  generateJson<T>(prompt: string): Promise<T>;
}
```

Implement OpenAI and/or Groq adapter behind same service.

Return deterministic JSON to frontend. Validate AI output before sending.

## Backend completion checklist

A backend endpoint is done only when:

- route exists and matches API contract.
- request validation exists.
- auth/project access is enforced.
- success response envelope matches docs.
- error cases return envelope.
- activity is logged if relevant.
- socket event emits if relevant.
- manual curl/Postman test works.

