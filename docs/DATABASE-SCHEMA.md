# CollabAI Database Schema

> **Current implementation:** PostgreSQL using Prisma; `prisma/schema.prisma` and committed migrations are authoritative. The MongoDB/Mongoose collection sketches below are retained historical planning notes and are not the runtime schema. See [TECH-SCOPE.md](TECH-SCOPE.md).

Historical proposal: MongoDB using Mongoose.

All timestamps should use Mongoose `timestamps: true` unless stated otherwise.

## Collection: users

Purpose: account identity and login.

Fields:

```ts
{
  _id: ObjectId,
  name: string,
  email: string,          // lowercase, unique
  passwordHash: string,   // never returned to frontend
  avatarUrl?: string | null,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```ts
email unique
name text, email text
```

Validation:

- `name`: required, 2-80 chars.
- `email`: required, unique, lowercase.
- `passwordHash`: required.

## Collection: projects

Purpose: project workspace and membership.

Fields:

```ts
{
  _id: ObjectId,
  name: string,
  description?: string,
  color?: string,
  ownerId: ObjectId,
  members: [
    {
      userId: ObjectId,
      role: 'owner' | 'admin' | 'member' | 'viewer',
      joinedAt: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```ts
ownerId
members.userId
name text, description text
```

Rules:

- Creator is always added to `members` as `owner`.
- A project must always have at least one owner.
- Only members can access project resources.

## Collection: boards

Purpose: task board inside project.

Fields:

```ts
{
  _id: ObjectId,
  projectId: ObjectId,
  name: string,
  description?: string,
  columns: [
    { key: 'todo' | 'in_progress' | 'done' | string, title: string, position: number }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```ts
projectId
projectId + name
```

Default columns:

```json
[
  { "key": "todo", "title": "To Do", "position": 0 },
  { "key": "in_progress", "title": "In Progress", "position": 1 },
  { "key": "done", "title": "Done", "position": 2 }
]
```

## Collection: tasks

Purpose: tasks/cards on Kanban board.

Fields:

```ts
{
  _id: ObjectId,
  projectId: ObjectId,
  boardId: ObjectId,
  title: string,
  description?: string,
  status: 'todo' | 'in_progress' | 'done',
  priority: 'low' | 'medium' | 'high' | 'urgent',
  position: number,
  assigneeId?: ObjectId | null,
  createdById: ObjectId,
  dueDate?: Date | null,
  labels: string[],
  subtasks: [
    { _id: string, title: string, done: boolean }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```ts
projectId
boardId
projectId + status + position
assigneeId
dueDate
title text, description text, labels text
```

Rules:

- `projectId` and `boardId` must match: board belongs to project.
- `assigneeId` must be a project member if provided.
- `position` is used for ordering within a column.
- Use spaced positions like 1000, 2000, 3000 to make drag/drop easier.

## Collection: comments

Purpose: comments on tasks.

Fields:

```ts
{
  _id: ObjectId,
  projectId: ObjectId,
  taskId: ObjectId,
  authorId: ObjectId,
  body: string,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```ts
taskId + createdAt
projectId + createdAt
authorId
```

Rules:

- `projectId` duplicates task project for easier auth/filtering.
- Only project members can read comments.
- Only author or admin/owner can edit/delete.

## Collection: activities

Purpose: audit trail and activity log.

Fields:

```ts
{
  _id: ObjectId,
  projectId: ObjectId,
  actorId: ObjectId,
  type: string,
  entityType: 'project' | 'board' | 'task' | 'comment' | 'member' | 'ai',
  entityId?: ObjectId | string,
  message: string,
  metadata?: Record<string, unknown>,
  createdAt: Date
}
```

Indexes:

```ts
projectId + createdAt desc
actorId + createdAt desc
type
```

Activity does not need `updatedAt`.

## Collection: notifications

Purpose: per-user notification feed.

Fields:

```ts
{
  _id: ObjectId,
  userId: ObjectId,
  projectId?: ObjectId,
  taskId?: ObjectId,
  type: string,
  title: string,
  body: string,
  read: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```ts
userId + read + createdAt desc
projectId
```

## DTO conversion rules

Backend must not send raw Mongoose documents directly. Convert to DTOs:

- Convert ObjectId to string.
- Remove `passwordHash`.
- Populate lightweight author/member fields where needed.
- Add computed `commentCount` for tasks when listing.

## Cascade behavior

When deleting project:

- delete boards where `projectId` matches.
- delete tasks where `projectId` matches.
- delete comments where `projectId` matches.
- optionally keep or delete activities; MVP can delete for simplicity.

When deleting board:

- delete tasks where `boardId` matches.
- delete comments for those tasks.

When deleting task:

- delete comments where `taskId` matches.


## Workspace documents (current PostgreSQL / Prisma implementation)

The current application uses PostgreSQL; `prisma/schema.prisma` is authoritative.
`Document` belongs to a project and its creator, with UUID keys, title, Markdown
content, integer version, creation/update timestamps, and a nullable deletion
timestamp. A composite index covers project, deletion state and update time.
Project deletion cascades; creator deletion is restricted.

Deployment: run `npx prisma migrate deploy` followed by `npx prisma generate`
before starting the updated application. Migration: `20260923000000_workspace_documents`.

Project invitations are pending `ProjectMember` rows with `userId = null`,
`invitedEmail`, `invitedAt`, a SHA-256 hashed `invitationToken`, and
`invitationExpiresAt`. Acceptance fills `userId`, clears `invitedEmail` and the
token fields, and sets `joinedAt`. Migration: `20260924000000_project_member_invitations`.
