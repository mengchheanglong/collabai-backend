# CollabAI REST API Contract

Base URL:

```txt
Development: http://localhost:4000/api/v1
Production:  https://YOUR_BACKEND_DOMAIN/api/v1
```

All protected endpoints require:

```http
Authorization: Bearer ***
```

All request/response bodies are JSON.

## Response envelope

### Success

```json
{
  "success": true,
  "data": {},
  "message": "Optional message"
}
```

### List success

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": [
      { "field": "title", "message": "Title is required" }
    ]
  }
}
```

Common error codes:

| HTTP | code | Meaning |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Invalid body, params, or query |
| 401 | `UNAUTHORIZED` | Missing/invalid token |
| 403 | `FORBIDDEN` | User lacks permission |
| 404 | `NOT_FOUND` | Resource does not exist or user cannot access it |
| 409 | `CONFLICT` | Duplicate or invalid state conflict |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

# DTO conventions

## UserDto

```json
{
  "_id": "66f000000000000000000001",
  "name": "Dara Sok",
  "email": "dara@example.com",
  "avatarUrl": "https://example.com/avatar.png",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

## ProjectDto

```json
{
  "_id": "66f000000000000000000010",
  "name": "Final Year Project",
  "description": "Team project board",
  "color": "#6750A4",
  "ownerId": "66f000000000000000000001",
  "members": [
    {
      "userId": "66f000000000000000000001",
      "role": "owner",
      "name": "Dara Sok",
      "email": "dara@example.com",
      "avatarUrl": null
    }
  ],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

Roles: `owner`, `admin`, `member`, `viewer`.

## BoardDto

```json
{
  "_id": "66f000000000000000000020",
  "projectId": "66f000000000000000000010",
  "name": "Main Board",
  "description": "Sprint board",
  "columns": [
    { "key": "todo", "title": "To Do", "position": 0 },
    { "key": "in_progress", "title": "In Progress", "position": 1 },
    { "key": "done", "title": "Done", "position": 2 }
  ],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

## TaskDto

```json
{
  "_id": "66f000000000000000000030",
  "projectId": "66f000000000000000000010",
  "boardId": "66f000000000000000000020",
  "title": "Build login page",
  "description": "Create Angular login page and connect API",
  "status": "todo",
  "priority": "medium",
  "position": 1000,
  "assigneeId": "66f000000000000000000001",
  "createdById": "66f000000000000000000001",
  "dueDate": "2026-02-01T00:00:00.000Z",
  "labels": ["frontend", "auth"],
  "subtasks": [
    { "_id": "sub_1", "title": "Create form", "done": false }
  ],
  "commentCount": 2,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

Task status: `todo`, `in_progress`, `done`.
Task priority: `low`, `medium`, `high`, `urgent`.

## CommentDto

```json
{
  "_id": "66f000000000000000000040",
  "taskId": "66f000000000000000000030",
  "projectId": "66f000000000000000000010",
  "authorId": "66f000000000000000000001",
  "author": {
    "_id": "66f000000000000000000001",
    "name": "Dara Sok",
    "email": "dara@example.com",
    "avatarUrl": null
  },
  "body": "I started this task.",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

---

# 1. Health

## GET /health

Public endpoint to verify backend is running.

Response `200`:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "collabai-api"
  }
}
```

---

# 2. Auth endpoints

## POST /auth/register

Creates a new user and returns token.

Auth: public.

Request:

```json
{
  "name": "Dara Sok",
  "email": "dara@example.com",
  "password": "Password123!"
}
```

Validation:

- `name`: required, 2-80 chars.
- `email`: required, valid email, unique lowercase.
- `password`: required, minimum 8 chars.

Response `201`:

```json
{
  "success": true,
  "data": {
    "accessToken": "JWT_TOKEN",
    "user": {
      "_id": "66f000000000000000000001",
      "name": "Dara Sok",
      "email": "dara@example.com",
      "avatarUrl": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

Errors:

- `409 CONFLICT` if email exists.
- `400 VALIDATION_ERROR` if invalid input.

## POST /auth/login

Authenticates user.

Auth: public.

Request:

```json
{
  "email": "dara@example.com",
  "password": "Password123!"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "accessToken": "JWT_TOKEN",
    "user": {
      "_id": "66f000000000000000000001",
      "name": "Dara Sok",
      "email": "dara@example.com",
      "avatarUrl": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

Errors:

- `401 UNAUTHORIZED` for wrong email/password. Do not reveal which one is wrong.

## GET /auth/me

Returns current authenticated user.

Auth: required.

Response `200`:

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "66f000000000000000000001",
      "name": "Dara Sok",
      "email": "dara@example.com",
      "avatarUrl": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

## POST /auth/logout

Stateless JWT logout helper. Frontend should delete token. Backend may simply return success.

Auth: required.

Response `200`:

```json
{
  "success": true,
  "data": null,
  "message": "Logged out"
}
```

---

# 3. User endpoints

## GET /users/search?q=term

Search users by name/email for inviting to projects.

Auth: required.

Query:

- `q`: required, min 2 chars.
- `limit`: optional, default 10, max 20.

Response `200`:

```json
{
  "success": true,
  "data": [
    {
      "_id": "66f000000000000000000002",
      "name": "Sophea Chan",
      "email": "sophea@example.com",
      "avatarUrl": null
    }
  ]
}
```

---

# 4. Project endpoints

## GET /projects

List projects where current user is a member.

Auth: required.

Query:

- `q`: optional name search.
- `page`: optional default 1.
- `limit`: optional default 20.

Response `200`:

```json
{
  "success": true,
  "data": [ProjectDto],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

## POST /projects

Create project. Creator becomes owner.

Auth: required.

Request:

```json
{
  "name": "Final Year Project",
  "description": "Build CollabAI MVP",
  "color": "#6750A4"
}
```

Validation:

- `name`: required, 2-100 chars.
- `description`: optional, max 500 chars.
- `color`: optional hex color.

Response `201`:

```json
{
  "success": true,
  "data": { "project": ProjectDto }
}
```

Backend side effect: create default board named `Main Board` with default columns.

## GET /projects/:projectId

Get project details.

Auth: required and project member.

Response `200`:

```json
{
  "success": true,
  "data": { "project": ProjectDto }
}
```

## PATCH /projects/:projectId

Update project metadata.

Auth: owner/admin.

Request:

```json
{
  "name": "New Name",
  "description": "Updated description",
  "color": "#0F766E"
}
```

Response `200`:

```json
{
  "success": true,
  "data": { "project": ProjectDto }
}
```

Socket event: `project:updated`.

## DELETE /projects/:projectId

Delete project and associated boards/tasks/comments/activities.

Auth: owner only.

Response `200`:

```json
{
  "success": true,
  "data": null,
  "message": "Project deleted"
}
```

Socket event: `project:deleted`.

---

# 5. Project membership endpoints

## GET /projects/:projectId/members

List project members.

Auth: project member.

Response `200`:

```json
{
  "success": true,
  "data": [
    {
      "userId": "66f000000000000000000001",
      "role": "owner",
      "name": "Dara Sok",
      "email": "dara@example.com",
      "avatarUrl": null,
      "joinedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

## POST /projects/:projectId/members

Add/invite existing user to project.

Auth: owner/admin.

Request:

```json
{
  "email": "sophea@example.com",
  "role": "member"
}
```

Response `201`:

```json
{
  "success": true,
  "data": { "project": ProjectDto },
  "message": "Member added"
}
```

Socket event: `member:added`.

## PATCH /projects/:projectId/members/:userId

Change project member role.

Auth: owner/admin. Only owner can promote/demote admins. Owner cannot demote self unless another owner exists.

Request:

```json
{
  "role": "admin"
}
```

Response `200`:

```json
{
  "success": true,
  "data": { "project": ProjectDto }
}
```

Socket event: `member:updated`.

## DELETE /projects/:projectId/members/:userId

Remove member from project.

Auth: owner/admin, or current user removing self.

Response `200`:

```json
{
  "success": true,
  "data": { "project": ProjectDto },
  "message": "Member removed"
}
```

Socket event: `member:removed`.

---

# 6. Board endpoints

## GET /projects/:projectId/boards

List boards in project.

Auth: project member.

Response `200`:

```json
{
  "success": true,
  "data": [BoardDto]
}
```

## POST /projects/:projectId/boards

Create board.

Auth: project member except viewer.

Request:

```json
{
  "name": "Sprint 1",
  "description": "First sprint board"
}
```

Response `201`:

```json
{
  "success": true,
  "data": { "board": BoardDto }
}
```

Socket event: `board:created`.

## GET /boards/:boardId

Get board and optionally tasks.

Auth: project member.

Query:

- `includeTasks=true` optional.

Response `200`:

```json
{
  "success": true,
  "data": {
    "board": BoardDto,
    "tasks": [TaskDto]
  }
}
```

## PATCH /boards/:boardId

Update board metadata.

Auth: project member except viewer.

Request:

```json
{
  "name": "Sprint 1 Updated",
  "description": "Updated"
}
```

Response `200`:

```json
{
  "success": true,
  "data": { "board": BoardDto }
}
```

Socket event: `board:updated`.

## DELETE /boards/:boardId

Delete board and its tasks/comments.

Auth: owner/admin.

Response `200`:

```json
{
  "success": true,
  "data": null,
  "message": "Board deleted"
}
```

Socket event: `board:deleted`.

---

# 7. Task endpoints

## GET /projects/:projectId/tasks

List tasks for a project, optionally filtered.

Auth: project member.

Query:

- `boardId`: optional.
- `status`: optional `todo|in_progress|done`.
- `assigneeId`: optional.
- `q`: optional text search.
- `label`: optional.
- `dueBefore`: optional ISO date.
- `page`: default 1.
- `limit`: default 50.

Response `200`:

```json
{
  "success": true,
  "data": [TaskDto],
  "meta": { "page": 1, "limit": 50, "total": 12, "totalPages": 1 }
}
```

## POST /tasks

Create task.

Auth: project member except viewer.

Request:

```json
{
  "projectId": "66f000000000000000000010",
  "boardId": "66f000000000000000000020",
  "title": "Build login page",
  "description": "Create Angular login page and connect API",
  "status": "todo",
  "priority": "medium",
  "assigneeId": "66f000000000000000000001",
  "dueDate": "2026-02-01T00:00:00.000Z",
  "labels": ["frontend", "auth"]
}
```

Validation:

- `projectId`, `boardId`, `title` required.
- `title`: 2-150 chars.
- `description`: optional max 5000 chars.
- `status`: default `todo`.
- `priority`: default `medium`.
- `assigneeId`: optional but must be project member.

Response `201`:

```json
{
  "success": true,
  "data": { "task": TaskDto }
}
```

Socket event: `task:created`.

## GET /tasks/:taskId

Get task details.

Auth: project member.

Response `200`:

```json
{
  "success": true,
  "data": {
    "task": TaskDto,
    "comments": [CommentDto]
  }
}
```

## PATCH /tasks/:taskId

Update task fields.

Auth: project member except viewer.

Request: any subset of fields:

```json
{
  "title": "Build login and register pages",
  "description": "Updated description",
  "priority": "high",
  "assigneeId": "66f000000000000000000002",
  "dueDate": "2026-02-05T00:00:00.000Z",
  "labels": ["frontend", "auth", "urgent"],
  "subtasks": [
    { "_id": "sub_1", "title": "Create login form", "done": true }
  ]
}
```

Response `200`:

```json
{
  "success": true,
  "data": { "task": TaskDto }
}
```

Socket event: `task:updated`.

## PATCH /tasks/:taskId/status

Move task between Kanban columns and update position.

Auth: project member except viewer.

Request:

```json
{
  "status": "in_progress",
  "position": 2000
}
```

Response `200`:

```json
{
  "success": true,
  "data": { "task": TaskDto }
}
```

Socket event: `task:moved`.

Frontend note: use fractional or spaced positions (`1000`, `2000`, etc.) to simplify reordering.

## DELETE /tasks/:taskId

Delete task and comments.

Auth: project member except viewer.

Response `200`:

```json
{
  "success": true,
  "data": null,
  "message": "Task deleted"
}
```

Socket event: `task:deleted`.

---

# 8. Comment endpoints

## GET /tasks/:taskId/comments

List task comments oldest first.

Auth: project member.

Response `200`:

```json
{
  "success": true,
  "data": [CommentDto]
}
```

## POST /tasks/:taskId/comments

Create task comment.

Auth: project member except viewer.

Request:

```json
{
  "body": "I started working on this."
}
```

Validation:

- `body`: required, 1-3000 chars.

Response `201`:

```json
{
  "success": true,
  "data": { "comment": CommentDto }
}
```

Socket event: `comment:created`.

## PATCH /comments/:commentId

Edit own comment. Admin/owner can moderate if needed.

Auth: comment author or project owner/admin.

Request:

```json
{
  "body": "Updated comment"
}
```

Response `200`:

```json
{
  "success": true,
  "data": { "comment": CommentDto }
}
```

Socket event: `comment:updated`.

## DELETE /comments/:commentId

Delete own comment. Admin/owner can moderate.

Auth: comment author or project owner/admin.

Response `200`:

```json
{
  "success": true,
  "data": null,
  "message": "Comment deleted"
}
```

Socket event: `comment:deleted`.

---

# 9. Activity endpoints

## GET /projects/:projectId/activity

List recent project activity.

Auth: project member.

Query:

- `page`: default 1.
- `limit`: default 30.

Response `200`:

```json
{
  "success": true,
  "data": [
    {
      "_id": "66f000000000000000000050",
      "projectId": "66f000000000000000000010",
      "actorId": "66f000000000000000000001",
      "actor": { "_id": "66f000000000000000000001", "name": "Dara Sok", "email": "dara@example.com" },
      "type": "task.created",
      "entityType": "task",
      "entityId": "66f000000000000000000030",
      "message": "Dara created task Build login page",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 30, "total": 1, "totalPages": 1 }
}
```

Activity types:

- `project.created`, `project.updated`, `project.deleted`
- `member.added`, `member.updated`, `member.removed`
- `board.created`, `board.updated`, `board.deleted`
- `task.created`, `task.updated`, `task.moved`, `task.deleted`
- `comment.created`, `comment.updated`, `comment.deleted`
- `ai.subtasks.generated`, `ai.description.generated`, `ai.comments.summarized`

---

# 10. Notification endpoints

## GET /notifications

List current user's notifications.

Auth: required.

Query:

- `unreadOnly`: optional boolean.
- `page`: default 1.
- `limit`: default 20.

Response `200`:

```json
{
  "success": true,
  "data": [
    {
      "_id": "66f000000000000000000060",
      "userId": "66f000000000000000000001",
      "projectId": "66f000000000000000000010",
      "type": "task.assigned",
      "title": "Task assigned",
      "body": "You were assigned to Build login page",
      "read": false,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

## PATCH /notifications/:notificationId/read

Mark one notification as read.

Auth: notification owner.

Response `200`:

```json
{
  "success": true,
  "data": { "read": true }
}
```

## PATCH /notifications/read-all

Mark all current user's notifications as read.

Auth: required.

Response `200`:

```json
{
  "success": true,
  "data": { "updated": 5 }
}
```

---

# 11. Analytics endpoints

## GET /projects/:projectId/analytics/summary

Simple project analytics for dashboard.

Auth: project member.

Response `200`:

```json
{
  "success": true,
  "data": {
    "totalTasks": 20,
    "completedTasks": 8,
    "inProgressTasks": 5,
    "todoTasks": 7,
    "overdueTasks": 2,
    "completionRate": 40,
    "tasksByUser": [
      { "userId": "66f000000000000000000001", "name": "Dara Sok", "total": 5, "done": 2 }
    ],
    "tasksByPriority": {
      "low": 3,
      "medium": 10,
      "high": 5,
      "urgent": 2
    }
  }
}
```

## GET /projects/:projectId/analytics/burndown

Burndown chart data for simple progress visualization.

Auth: project member.

Query:

- `days`: optional, default 14, max 60.

Response `200`:

```json
{
  "success": true,
  "data": [
    { "date": "2026-01-01", "remainingTasks": 20, "completedTasks": 0 },
    { "date": "2026-01-02", "remainingTasks": 18, "completedTasks": 2 }
  ]
}
```

---

# 12. AI endpoints

All AI endpoints require auth. Backend must use server-side API keys only.

## POST /ai/subtasks

Generate subtasks for a task title/description.

Auth: required. If `projectId` is provided, user must be project member.

Request:

```json
{
  "projectId": "66f000000000000000000010",
  "title": "Build login page",
  "description": "Angular login page connected to JWT backend",
  "count": 5
}
```

Validation:

- `title`: required.
- `count`: optional 3-10, default 5.

Response `200`:

```json
{
  "success": true,
  "data": {
    "subtasks": [
      "Create login route and page component",
      "Build email/password form with validation",
      "Connect form to auth service login method",
      "Store JWT token securely in frontend storage",
      "Redirect user to dashboard after login"
    ]
  }
}
```

## POST /ai/description

Generate or improve task description.

Auth: required.

Request:

```json
{
  "projectId": "66f000000000000000000010",
  "title": "Build login page",
  "mode": "generate",
  "currentDescription": ""
}
```

`mode`: `generate`, `improve`, `shorten`.

Response `200`:

```json
{
  "success": true,
  "data": {
    "description": "Create a responsive login page with email/password fields, validation messages, loading state, API integration, and redirect to dashboard after successful login."
  }
}
```

## POST /ai/summarize-comments

Summarize comments on a task.

Auth: project member through task.

Request:

```json
{
  "taskId": "66f000000000000000000030"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "summary": "The team agreed to implement the login UI first, then connect JWT login. Validation and loading states are still pending."
  }
}
```

## POST /ai/search-tasks

AI-assisted natural language task search.

Auth: project member.

Request:

```json
{
  "projectId": "66f000000000000000000010",
  "query": "frontend tasks due this week that are not done"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "interpretedQuery": {
      "labels": ["frontend"],
      "statusNot": ["done"],
      "dueRange": "this_week"
    },
    "tasks": [TaskDto]
  }
}
```

MVP implementation can parse with AI into filters, then run MongoDB query. Full embeddings are bonus.

---

# 13. Endpoint implementation order

Recommended backend order:

1. `GET /health`
2. `POST /auth/register`
3. `POST /auth/login`
4. `GET /auth/me`
5. `GET/POST/PATCH/DELETE /projects`
6. `GET/POST /projects/:projectId/boards`
7. `GET/POST/PATCH/DELETE /tasks`
8. comments
9. activity
10. analytics
11. AI
12. Socket.io broadcasting

Recommended frontend order:

1. Auth service/interceptor/guard.
2. Login/register pages.
3. Dashboard project list/create project.
4. Project board route.
5. Task CRUD.
6. Comments.
7. AI buttons/panels.
8. Socket.io live updates.
9. Analytics/dark mode/responsive polish.

