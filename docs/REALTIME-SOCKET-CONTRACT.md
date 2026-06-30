# CollabAI Socket.io Realtime Contract

Socket URL:

```txt
Development: http://localhost:4000
Production:  https://YOUR_BACKEND_DOMAIN
```

Namespace: default `/` for MVP.

## Authentication

Client connects with JWT:

```ts
io(SOCKET_URL, {
  auth: { token: accessToken }
});
```

Server verifies token and sets `socket.data.user`.

If auth fails, disconnect with error:

```json
{
  "code": "UNAUTHORIZED",
  "message": "Invalid token"
}
```

## Rooms

Each project has a room:

```txt
project:{projectId}
```

Example:

```txt
project:66f000000000000000000010
```

Client must join a room before receiving project updates.

## Client -> server events

### project:join

Join a project room.

Payload:

```json
{
  "projectId": "66f000000000000000000010"
}
```

Server behavior:

1. Verify user is project member.
2. Join room `project:{projectId}`.
3. Emit `project:joined` to the same socket.

Ack payload:

```json
{
  "success": true,
  "projectId": "66f000000000000000000010"
}
```

### project:leave

Leave a project room.

Payload:

```json
{
  "projectId": "66f000000000000000000010"
}
```

Ack:

```json
{
  "success": true,
  "projectId": "66f000000000000000000010"
}
```

### typing:start

Optional typing indicator for task comments.

Payload:

```json
{
  "projectId": "66f000000000000000000010",
  "taskId": "66f000000000000000000030"
}
```

Broadcast to others in project room as `typing:started`.

### typing:stop

Payload:

```json
{
  "projectId": "66f000000000000000000010",
  "taskId": "66f000000000000000000030"
}
```

Broadcast to others as `typing:stopped`.

## Server -> client events

All server events use this envelope:

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": {},
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### project:updated

Emitted after `PATCH /projects/:projectId`.

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": { "project": ProjectDto },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### project:deleted

Emitted before/after project deletion.

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": { "projectId": "66f000000000000000000010" },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### member:added / member:updated / member:removed

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": {
    "userId": "66f000000000000000000002",
    "role": "member"
  },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### board:created / board:updated / board:deleted

For create/update:

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": { "board": BoardDto },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

For delete:

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": { "boardId": "66f000000000000000000020" },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### task:created / task:updated

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": { "task": TaskDto },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### task:moved

Emitted after status/position change.

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": {
    "taskId": "66f000000000000000000030",
    "fromStatus": "todo",
    "toStatus": "in_progress",
    "position": 2000,
    "task": TaskDto
  },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### task:deleted

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": {
    "taskId": "66f000000000000000000030",
    "boardId": "66f000000000000000000020"
  },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### comment:created / comment:updated

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": {
    "taskId": "66f000000000000000000030",
    "comment": CommentDto
  },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### comment:deleted

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": {
    "taskId": "66f000000000000000000030",
    "commentId": "66f000000000000000000040"
  },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### activity:created

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": { "activity": ActivityDto },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### notification:created

Can be emitted directly to user's socket room `user:{userId}` if implemented.

```json
{
  "projectId": "66f000000000000000000010",
  "actorId": "66f000000000000000000001",
  "data": { "notification": NotificationDto },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

## Frontend sync rules

- REST response is the source of truth for the user action that created the change.
- Socket events update other connected clients.
- If the current client receives a socket event caused by itself, it may ignore it by comparing `actorId` to current user ID, or merge it idempotently.
- On reconnect, frontend should refetch current board/tasks to avoid missing events.

## Backend emit rules

- Emit after database write succeeds.
- Include enough IDs for frontend to update local state without full refetch.
- Never trust client socket events to mutate data directly. Mutations go through REST endpoints for MVP.

