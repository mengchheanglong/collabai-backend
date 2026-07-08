# 🏗️ CollabAI Backend - NestJS + DDD Architecture

Complete project structure and setup guide for building CollabAI backend with NestJS, Domain-Driven Design, Prisma ORM, and Supabase PostgreSQL.

---

## 📁 PROJECT STRUCTURE

```
collabai-backend/
│
├── src/
│   ├── config/                          # Configuration files
│   │   ├── app.config.ts               # App configuration
│   │   ├── database.config.ts           # Database config
│   │   ├── jwt.config.ts                # JWT configuration
│   │   └── environments.ts              # Env variables
│   │
│   ├── common/                          # Shared across modules
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── validate.decorator.ts
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── refresh-token.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── transform.interceptor.ts
│   │   │   └── error.interceptor.ts
│   │   ├── pipes/
│   │   │   ├── validation.pipe.ts
│   │   │   └── parse-uuid.pipe.ts
│   │   ├── middleware/
│   │   │   ├── request-logging.middleware.ts
│   │   │   └── request-timeout.middleware.ts
│   │   └── utils/
│   │       ├── logger.util.ts
│   │       └── helpers.ts
│   │
│   ├── modules/                         # Feature modules
│   │   ├── auth/                        # Authentication module
│   │   │   ├── application/
│   │   │   │   ├── dtos/
│   │   │   │   │   ├── login.dto.ts
│   │   │   │   │   ├── register.dto.ts
│   │   │   │   │   ├── auth-response.dto.ts
│   │   │   │   │   └── refresh-token.dto.ts
│   │   │   │   ├── queries/
│   │   │   │   │   └── get-current-user.query.ts
│   │   │   │   └── commands/
│   │   │   │       ├── login.command.ts
│   │   │   │       ├── register.command.ts
│   │   │   │       └── refresh-token.command.ts
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── user.entity.ts
│   │   │   │   │   └── refresh-token.entity.ts
│   │   │   │   ├── repositories/
│   │   │   │   │   ├── user.repository.interface.ts
│   │   │   │   │   └── refresh-token.repository.interface.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── auth.domain.service.ts
│   │   │   │   └── value-objects/
│   │   │   │       └── password.value-object.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   │   ├── user.repository.ts
│   │   │   │   │   └── refresh-token.repository.ts
│   │   │   │   └── external-services/
│   │   │   │       └── email.service.ts
│   │   │   ├── presentation/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── auth.controller.ts
│   │   │   │   └── exception-filters/
│   │   │   │       └── auth-exception.filter.ts
│   │   │   └── auth.module.ts
│   │   │
│   │   ├── projects/                    # Projects module
│   │   │   ├── application/
│   │   │   │   ├── dtos/
│   │   │   │   │   ├── create-project.dto.ts
│   │   │   │   │   ├── update-project.dto.ts
│   │   │   │   │   ├── project-response.dto.ts
│   │   │   │   │   └── invite-member.dto.ts
│   │   │   │   ├── queries/
│   │   │   │   │   ├── get-all-projects.query.ts
│   │   │   │   │   ├── get-project.query.ts
│   │   │   │   │   └── list-members.query.ts
│   │   │   │   └── commands/
│   │   │   │       ├── create-project.command.ts
│   │   │   │       ├── update-project.command.ts
│   │   │   │       ├── delete-project.command.ts
│   │   │   │       └── invite-member.command.ts
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── project.entity.ts
│   │   │   │   │   └── project-member.entity.ts
│   │   │   │   ├── repositories/
│   │   │   │   │   ├── project.repository.interface.ts
│   │   │   │   │   └── project-member.repository.interface.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── project.domain.service.ts
│   │   │   │   ├── value-objects/
│   │   │   │   │   └── project-role.value-object.ts
│   │   │   │   └── events/
│   │   │   │       ├── project-created.event.ts
│   │   │   │       ├── member-invited.event.ts
│   │   │   │       └── member-joined.event.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   │   ├── project.repository.ts
│   │   │   │   │   └── project-member.repository.ts
│   │   │   │   └── event-handlers/
│   │   │   │       └── member-invited.handler.ts
│   │   │   ├── presentation/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── projects.controller.ts
│   │   │   │   └── exception-filters/
│   │   │   │       └── project-exception.filter.ts
│   │   │   └── projects.module.ts
│   │   │
│   │   ├── tasks/                       # Tasks module
│   │   │   ├── application/
│   │   │   │   ├── dtos/
│   │   │   │   │   ├── create-task.dto.ts
│   │   │   │   │   ├── update-task.dto.ts
│   │   │   │   │   ├── task-response.dto.ts
│   │   │   │   │   └── move-task.dto.ts
│   │   │   │   ├── queries/
│   │   │   │   │   ├── get-tasks.query.ts
│   │   │   │   │   ├── get-task.query.ts
│   │   │   │   │   └── list-subtasks.query.ts
│   │   │   │   └── commands/
│   │   │   │       ├── create-task.command.ts
│   │   │   │       ├── update-task.command.ts
│   │   │   │       ├── move-task.command.ts
│   │   │   │       ├── delete-task.command.ts
│   │   │   │       ├── add-subtask.command.ts
│   │   │   │       └── generate-description.command.ts
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   ├── task.entity.ts
│   │   │   │   │   ├── subtask.entity.ts
│   │   │   │   │   └── task-label.entity.ts
│   │   │   │   ├── repositories/
│   │   │   │   │   ├── task.repository.interface.ts
│   │   │   │   │   └── subtask.repository.interface.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── task.domain.service.ts
│   │   │   │   ├── value-objects/
│   │   │   │   │   ├── task-status.value-object.ts
│   │   │   │   │   └── task-priority.value-object.ts
│   │   │   │   └── events/
│   │   │   │       ├── task-created.event.ts
│   │   │   │       ├── task-moved.event.ts
│   │   │   │       ├── task-completed.event.ts
│   │   │   │       └── task-assigned.event.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   │   ├── task.repository.ts
│   │   │   │   │   └── subtask.repository.ts
│   │   │   │   └── event-handlers/
│   │   │   │       ├── task-created.handler.ts
│   │   │   │       └── task-assigned.handler.ts
│   │   │   ├── presentation/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── tasks.controller.ts
│   │   │   │   └── exception-filters/
│   │   │   │       └── task-exception.filter.ts
│   │   │   └── tasks.module.ts
│   │   │
│   │   ├── comments/                    # Comments module
│   │   │   ├── application/
│   │   │   │   ├── dtos/
│   │   │   │   │   ├── add-comment.dto.ts
│   │   │   │   │   ├── comment-response.dto.ts
│   │   │   │   │   └── edit-comment.dto.ts
│   │   │   │   ├── queries/
│   │   │   │   │   └── get-task-comments.query.ts
│   │   │   │   └── commands/
│   │   │   │       ├── add-comment.command.ts
│   │   │   │       ├── edit-comment.command.ts
│   │   │   │       └── delete-comment.command.ts
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── comment.entity.ts
│   │   │   │   ├── repositories/
│   │   │   │   │   └── comment.repository.interface.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── comment.domain.service.ts
│   │   │   │   └── events/
│   │   │   │       ├── comment-added.event.ts
│   │   │   │       └── mention-created.event.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   │   └── comment.repository.ts
│   │   │   │   └── event-handlers/
│   │   │   │       └── mention-created.handler.ts
│   │   │   ├── presentation/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── comments.controller.ts
│   │   │   │   └── exception-filters/
│   │   │   │       └── comment-exception.filter.ts
│   │   │   └── comments.module.ts
│   │   │
│   │   ├── notifications/                # Notifications module
│   │   │   ├── application/
│   │   │   │   ├── dtos/
│   │   │   │   │   └── notification-response.dto.ts
│   │   │   │   ├── queries/
│   │   │   │   │   └── get-user-notifications.query.ts
│   │   │   │   └── commands/
│   │   │   │       ├── create-notification.command.ts
│   │   │   │       └── mark-as-read.command.ts
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── notification.entity.ts
│   │   │   │   ├── repositories/
│   │   │   │   │   └── notification.repository.interface.ts
│   │   │   │   ├── services/
│   │   │   │   │   └── notification.domain.service.ts
│   │   │   │   └── value-objects/
│   │   │   │       └── notification-type.value-object.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── persistence/
│   │   │   │   │   └── notification.repository.ts
│   │   │   │   └── providers/
│   │   │   │       ├── email.provider.ts
│   │   │   │       └── push.provider.ts
│   │   │   ├── presentation/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── notifications.controller.ts
│   │   │   │   └── exception-filters/
│   │   │   │       └── notification-exception.filter.ts
│   │   │   └── notifications.module.ts
│   │   │
│   │   └── ai/                          # AI Features module
│   │       ├── application/
│   │       │   ├── dtos/
│   │       │   │   ├── generate-description.dto.ts
│   │       │   │   ├── suggest-subtasks.dto.ts
│   │       │   │   └── improve-comment.dto.ts
│   │       │   └── commands/
│   │       │       ├── generate-description.command.ts
│   │       │       ├── suggest-subtasks.command.ts
│   │       │       └── improve-comment.command.ts
│   │       ├── domain/
│   │       │   ├── services/
│   │       │   │   └── ai.domain.service.ts
│   │       │   └── value-objects/
│   │       │       └── ai-request.value-object.ts
│   │       ├── infrastructure/
│   │       │   └── providers/
│   │       │       ├── openai.provider.ts
│   │       │       └── anthropic.provider.ts
│   │       ├── presentation/
│   │       │   └── controllers/
│   │       │       └── ai.controller.ts
│   │       └── ai.module.ts
│   │
│   ├── database/
│   │   ├── migrations/                  # Prisma migrations
│   │   └── schema.prisma                # Prisma schema
│   │
│   ├── shared/                          # Shared services
│   │   ├── event-bus/
│   │   │   ├── event-bus.interface.ts
│   │   │   └── event-bus.service.ts
│   │   ├── query-bus/
│   │   │   ├── query-bus.interface.ts
│   │   │   └── query-bus.service.ts
│   │   ├── command-bus/
│   │   │   ├── command-bus.interface.ts
│   │   │   └── command-bus.service.ts
│   │   └── services/
│   │       ├── encryption.service.ts
│   │       ├── jwt.service.ts
│   │       ├── email.service.ts
│   │       └── logger.service.ts
│   │
│   ├── app.module.ts                    # Root module
│   ├── app.controller.ts                # Root controller
│   ├── main.ts                          # Entry point
│   └── environment.d.ts                 # Environment types
│
├── test/
│   ├── e2e/
│   │   ├── auth.e2e-spec.ts
│   │   ├── projects.e2e-spec.ts
│   │   └── tasks.e2e-spec.ts
│   └── unit/
│       ├── auth/
│       ├── projects/
│       └── tasks/
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── .env.example
├── .env.local
├── docker-compose.yml
├── dockerfile
├── nest-cli.json
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

---

## ⚙️ SETUP INSTRUCTIONS

### Step 1: Create NestJS Project

```bash
# Install NestJS CLI
npm i -g @nestjs/cli

# Create new project
nest new collabai-backend
cd collabai-backend

# Choose npm as package manager
```

### Step 2: Install Dependencies

```bash
npm install @nestjs/core @nestjs/common @nestjs/platform-express
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @nestjs/config
npm install class-validator class-transformer
npm install bcryptjs uuid
npm install @prisma/client prisma
npm install socket.io @nestjs/websockets
npm install @nestjs/event-emitter cqrs
npm install axios dotenv

# Development dependencies
npm install -D @types/node @types/express @types/bcryptjs
npm install -D @nestjs/testing jest ts-jest @types/jest
npm install -D @types/node typescript ts-loader
npm install -D eslint prettier
```

### Step 3: Setup Prisma

```bash
# Initialize Prisma
npx prisma init

# Create .env.local and add DATABASE_URL
echo 'DATABASE_URL="postgresql://user:password@host:5432/collabai"' > .env.local

# Copy schema.prisma content (see below)
# Then run:
npx prisma migrate dev --name init
npx prisma generate
```

---

## 📋 PRISMA SCHEMA

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============ USERS & AUTH ============

model User {
  id                String         @id @default(uuid()) @db.Uuid
  email             String         @unique
  name              String
  passwordHash      String
  avatarUrl         String?
  timezone          String         @default("UTC")
  isActive          Boolean        @default(true)
  emailVerified     Boolean        @default(false)
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  lastLogin         DateTime?
  deletedAt         DateTime?

  // Relations
  projects          Project[]      @relation("ProjectOwner")
  projectMembers    ProjectMember[]
  tasks             Task[]         @relation("TaskAssignee")
  tasksCreated      Task[]         @relation("TaskCreator")
  comments          Comment[]
  subtasks          Subtask[]
  labels            Label[]
  activities        Activity[]
  notifications     Notification[]
  userSettings      UserSettings?
  refreshTokens     RefreshToken[]

  @@index([email])
  @@index([isActive])
  @@fulltext([name, email])
}

model RefreshToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}

model UserSettings {
  id                     String   @id @default(uuid()) @db.Uuid
  userId                 String   @unique @db.Uuid
  emailFrequency         String   @default("daily") // never, daily, weekly, instant
  theme                  String   @default("auto") // light, dark, auto
  notifyCommentMentions  Boolean  @default(true)
  notifyTaskAssigned     Boolean  @default(true)
  notifyTaskCompleted    Boolean  @default(true)
  updatedAt              DateTime @updatedAt

  user                   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ============ PROJECTS ============

model Project {
  id        String         @id @default(uuid()) @db.Uuid
  ownerId   String         @db.Uuid
  name      String
  description String?
  icon      String?
  color     String?
  isArchived Boolean        @default(false)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
  deletedAt DateTime?

  // Relations
  owner             User           @relation("ProjectOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  members           ProjectMember[]
  tasks             Task[]
  labels            Label[]
  activities        Activity[]

  @@unique([ownerId, name])
  @@index([ownerId])
  @@index([createdAt])
}

model ProjectMember {
  id                 String   @id @default(uuid()) @db.Uuid
  projectId          String   @db.Uuid
  userId             String   @db.Uuid
  role               String   @default("member") // owner, admin, member, viewer, guest
  invitedBy          String?  @db.Uuid
  invitedAt          DateTime?
  joinedAt           DateTime?
  invitationToken    String?  @unique
  invitationExpiresAt DateTime?
  isActive           Boolean  @default(true)

  // Relations
  project            Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
}

// ============ TASKS ============

model Task {
  id        String   @id @default(uuid()) @db.Uuid
  projectId String   @db.Uuid
  title     String
  description String?
  status    String   @default("todo") // todo, in_progress, done
  priority  String   @default("medium") // low, medium, high, critical
  assignedTo String? @db.Uuid
  createdBy String   @db.Uuid
  dueDate   DateTime?
  completedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  // Relations
  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee  User?       @relation("TaskAssignee", fields: [assignedTo], references: [id], onDelete: SetNull)
  creator   User        @relation("TaskCreator", fields: [createdBy], references: [id], onDelete: Restrict)
  comments  Comment[]
  subtasks  Subtask[]
  labels    TaskLabel[]
  activities Activity[]

  @@index([projectId, status])
  @@index([assignedTo])
  @@index([dueDate])
  @@index([createdAt])
  @@fulltext([title, description])
}

model Subtask {
  id        String  @id @default(uuid()) @db.Uuid
  taskId    String  @db.Uuid
  title     String
  completed Boolean @default(false)
  completedAt DateTime?
  orderIndex Int     @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  task      Task    @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@unique([taskId, orderIndex])
}

model Label {
  id        String   @id @default(uuid()) @db.Uuid
  projectId String   @db.Uuid
  name      String
  color     String?
  createdBy String   @db.Uuid
  createdAt DateTime @default(now())

  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  creator   User        @relation(fields: [createdBy], references: [id], onDelete: Restrict)
  tasks     TaskLabel[]

  @@unique([projectId, name])
  @@index([projectId])
}

model TaskLabel {
  id      String @id @default(uuid()) @db.Uuid
  taskId  String @db.Uuid
  labelId String @db.Uuid

  task    Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  label   Label  @relation(fields: [labelId], references: [id], onDelete: Cascade)

  @@unique([taskId, labelId])
  @@index([taskId])
}

// ============ COMMENTS ============

model Comment {
  id        String   @id @default(uuid()) @db.Uuid
  taskId    String   @db.Uuid
  userId    String   @db.Uuid
  content   String
  editedAt  DateTime?
  createdAt DateTime @default(now())
  deletedAt DateTime?

  task      Task    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@index([userId])
  @@index([createdAt])
}

// ============ ACTIVITIES (AUDIT LOG) ============

model Activity {
  id        String   @id @default(uuid()) @db.Uuid
  projectId String   @db.Uuid
  userId    String   @db.Uuid
  entityType String  // task, comment, project_member
  entityId  String?  @db.Uuid
  action    String   // created, updated, deleted, moved
  oldValue  String?
  newValue  String?
  createdAt DateTime @default(now())

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@index([projectId, userId])
  @@index([entityType, entityId])
  @@index([createdAt])
}

// ============ NOTIFICATIONS ============

model Notification {
  id                String   @id @default(uuid()) @db.Uuid
  userId            String   @db.Uuid
  type              String   // task_assigned, comment_added, etc
  title             String
  message           String
  relatedEntityType String?
  relatedEntityId   String?  @db.Uuid
  isRead            Boolean  @default(false)
  readAt            DateTime?
  createdAt         DateTime @default(now())

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([createdAt])
}
```

---

## 🎨 DOMAIN-DRIVEN DESIGN IMPLEMENTATION

### 1. Entity Example (Task Entity)

```typescript
// src/modules/tasks/domain/entities/task.entity.ts

import { TaskStatus } from '../value-objects/task-status.value-object';
import { TaskPriority } from '../value-objects/task-priority.value-object';

export class TaskEntity {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  createdBy: string;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  private constructor(props: TaskEntityProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.title = props.title;
    this.description = props.description;
    this.status = props.status;
    this.priority = props.priority;
    this.assignedTo = props.assignedTo;
    this.createdBy = props.createdBy;
    this.dueDate = props.dueDate;
    this.completedAt = props.completedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: CreateTaskProps): TaskEntity {
    const entity = new TaskEntity({
      id: props.id,
      projectId: props.projectId,
      title: props.title,
      description: props.description,
      status: TaskStatus.TODO,
      priority: props.priority || TaskPriority.MEDIUM,
      assignedTo: props.assignedTo,
      createdBy: props.createdBy,
      dueDate: props.dueDate,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return entity;
  }

  static fromPersistence(raw: any): TaskEntity {
    return new TaskEntity({
      id: raw.id,
      projectId: raw.projectId,
      title: raw.title,
      description: raw.description,
      status: new TaskStatus(raw.status),
      priority: new TaskPriority(raw.priority),
      assignedTo: raw.assignedTo,
      createdBy: raw.createdBy,
      dueDate: raw.dueDate,
      completedAt: raw.completedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
    });
  }

  updateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new Error('Task title cannot be empty');
    }
    this.title = title;
    this.updatedAt = new Date();
  }

  updateStatus(status: TaskStatus): void {
    this.status = status;
    if (status.equals(TaskStatus.DONE)) {
      this.completedAt = new Date();
    }
    this.updatedAt = new Date();
  }

  assign(userId: string): void {
    this.assignedTo = userId;
    this.updatedAt = new Date();
  }

  toPersistence(): any {
    return {
      id: this.id,
      projectId: this.projectId,
      title: this.title,
      description: this.description,
      status: this.status.value,
      priority: this.priority.value,
      assignedTo: this.assignedTo,
      createdBy: this.createdBy,
      dueDate: this.dueDate,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}

interface TaskEntityProps {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  createdBy: string;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

interface CreateTaskProps {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assignedTo?: string;
  createdBy: string;
  dueDate?: Date;
}
```

### 2. Value Objects

```typescript
// src/modules/tasks/domain/value-objects/task-status.value-object.ts

export class TaskStatus {
  public static readonly TODO = new TaskStatus('todo');
  public static readonly IN_PROGRESS = new TaskStatus('in_progress');
  public static readonly DONE = new TaskStatus('done');

  private constructor(readonly value: string) {
    const validStatuses = ['todo', 'in_progress', 'done'];
    if (!validStatuses.includes(value)) {
      throw new Error(`Invalid task status: ${value}`);
    }
  }

  static create(value: string): TaskStatus {
    return new TaskStatus(value);
  }

  equals(other: TaskStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

// src/modules/tasks/domain/value-objects/task-priority.value-object.ts

export class TaskPriority {
  public static readonly LOW = new TaskPriority('low');
  public static readonly MEDIUM = new TaskPriority('medium');
  public static readonly HIGH = new TaskPriority('high');
  public static readonly CRITICAL = new TaskPriority('critical');

  private constructor(readonly value: string) {
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(value)) {
      throw new Error(`Invalid priority: ${value}`);
    }
  }

  static create(value: string): TaskPriority {
    return new TaskPriority(value);
  }

  equals(other: TaskPriority): boolean {
    return this.value === other.value;
  }

  isHigherThan(other: TaskPriority): boolean {
    const priorityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    return priorityOrder[this.value] > priorityOrder[other.value];
  }

  toString(): string {
    return this.value;
  }
}
```

### 3. Repository Interface (Domain)

```typescript
// src/modules/tasks/domain/repositories/task.repository.interface.ts

import { TaskEntity } from '../entities/task.entity';

export interface ITaskRepository {
  save(task: TaskEntity): Promise<void>;
  findById(id: string): Promise<TaskEntity | null>;
  findByProjectId(projectId: string, filters?: TaskFilters): Promise<TaskEntity[]>;
  delete(id: string): Promise<void>;
  findByIdOrThrow(id: string): Promise<TaskEntity>;
  updateStatus(id: string, status: string): Promise<void>;
}

export interface TaskFilters {
  status?: string;
  assignedTo?: string;
  priority?: string;
  dueDate?: Date;
  search?: string;
  skip?: number;
  take?: number;
}

export const TASK_REPOSITORY = Symbol('ITaskRepository');
```

### 4. Repository Implementation (Infrastructure)

```typescript
// src/modules/tasks/infrastructure/persistence/task.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { TaskEntity } from '../../domain/entities/task.entity';
import { ITaskRepository, TaskFilters } from '../../domain/repositories/task.repository.interface';

@Injectable()
export class TaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(task: TaskEntity): Promise<void> {
    const data = task.toPersistence();
    
    await this.prisma.task.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  async findById(id: string): Promise<TaskEntity | null> {
    const raw = await this.prisma.task.findUnique({
      where: { id },
      include: { subtasks: true, labels: { include: { label: true } } },
    });

    return raw ? TaskEntity.fromPersistence(raw) : null;
  }

  async findByProjectId(projectId: string, filters?: TaskFilters): Promise<TaskEntity[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.assignedTo && { assignedTo: filters.assignedTo }),
        ...(filters?.priority && { priority: filters.priority }),
      },
      include: { subtasks: true, labels: { include: { label: true } } },
      skip: filters?.skip,
      take: filters?.take,
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map(task => TaskEntity.fromPersistence(task));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findByIdOrThrow(id: string): Promise<TaskEntity> {
    const task = await this.findById(id);
    if (!task) {
      throw new Error(`Task with id ${id} not found`);
    }
    return task;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.prisma.task.update({
      where: { id },
      data: { 
        status,
        completedAt: status === 'done' ? new Date() : null,
        updatedAt: new Date(),
      },
    });
  }
}
```

### 5. Domain Service

```typescript
// src/modules/tasks/domain/services/task.domain.service.ts

import { Injectable } from '@nestjs/common';
import { TaskEntity } from '../entities/task.entity';
import { TaskStatus } from '../value-objects/task-status.value-object';
import { TaskPriority } from '../value-objects/task-priority.value-object';
import { TASK_REPOSITORY, ITaskRepository } from '../repositories/task.repository.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class TaskDomainService {
  constructor(
    @Inject(TASK_REPOSITORY)
    private readonly taskRepository: ITaskRepository,
  ) {}

  async createTask(props: CreateTaskProps): Promise<TaskEntity> {
    const task = TaskEntity.create({
      id: props.id,
      projectId: props.projectId,
      title: props.title,
      description: props.description,
      priority: TaskPriority.create(props.priority || 'medium'),
      assignedTo: props.assignedTo,
      createdBy: props.createdBy,
      dueDate: props.dueDate,
    });

    await this.taskRepository.save(task);
    return task;
  }

  async moveTask(taskId: string, newStatus: string): Promise<void> {
    const task = await this.taskRepository.findByIdOrThrow(taskId);
    task.updateStatus(TaskStatus.create(newStatus));
    await this.taskRepository.save(task);
  }

  async assignTask(taskId: string, userId: string): Promise<void> {
    const task = await this.taskRepository.findByIdOrThrow(taskId);
    task.assign(userId);
    await this.taskRepository.save(task);
  }
}

interface CreateTaskProps {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  priority?: string;
  assignedTo?: string;
  createdBy: string;
  dueDate?: Date;
}
```

### 6. Application Command Handler (CQRS)

```typescript
// src/modules/tasks/application/commands/create-task.command.ts

export class CreateTaskCommand {
  constructor(
    public readonly projectId: string,
    public readonly title: string,
    public readonly description: string,
    public readonly assignedTo: string,
    public readonly dueDate: Date,
    public readonly priority: string,
    public readonly userId: string,
  ) {}
}

// src/modules/tasks/application/commands/create-task.handler.ts

import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { CreateTaskCommand } from './create-task.command';
import { TaskDomainService } from '../../domain/services/task.domain.service';
import { TaskCreatedEvent } from '../../domain/events/task-created.event';
import { v4 as uuid } from 'uuid';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  constructor(
    private readonly taskDomainService: TaskDomainService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateTaskCommand): Promise<any> {
    const task = await this.taskDomainService.createTask({
      id: uuid(),
      projectId: command.projectId,
      title: command.title,
      description: command.description,
      priority: command.priority,
      assignedTo: command.assignedTo,
      createdBy: command.userId,
      dueDate: command.dueDate,
    });

    // Publish domain event
    this.eventBus.publish(
      new TaskCreatedEvent(task.id, task.projectId, task.assignedTo),
    );

    return task;
  }
}
```

### 7. Domain Events

```typescript
// src/modules/tasks/domain/events/task-created.event.ts

export class TaskCreatedEvent {
  constructor(
    public readonly taskId: string,
    public readonly projectId: string,
    public readonly assignedTo?: string,
  ) {}
}

// src/modules/tasks/domain/events/task-assigned.event.ts

export class TaskAssignedEvent {
  constructor(
    public readonly taskId: string,
    public readonly assignedTo: string,
    public readonly projectId: string,
  ) {}
}
```

### 8. Event Handler

```typescript
// src/modules/tasks/infrastructure/event-handlers/task-assigned.handler.ts

import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { TaskAssignedEvent } from '../../domain/events/task-assigned.event';
import { NotificationDomainService } from '../../../notifications/domain/services/notification.domain.service';

@EventsHandler(TaskAssignedEvent)
export class TaskAssignedHandler implements IEventHandler<TaskAssignedEvent> {
  constructor(
    private readonly notificationService: NotificationDomainService,
  ) {}

  async handle(event: TaskAssignedEvent): Promise<void> {
    // Create notification for assigned user
    await this.notificationService.createNotification({
      userId: event.assignedTo,
      type: 'task_assigned',
      title: 'New task assigned to you',
      relatedEntityType: 'task',
      relatedEntityId: event.taskId,
    });
  }
}
```

### 9. Application DTO

```typescript
// src/modules/tasks/application/dtos/create-task.dto.ts

import { IsString, IsOptional, IsUUID, IsDateString, IsEnum } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'critical'])
  priority?: string;
}

// src/modules/tasks/application/dtos/task-response.dto.ts

export class TaskResponseDto {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignedTo?: string;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### 10. Controller

```typescript
// src/modules/tasks/presentation/controllers/tasks.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CreateTaskCommand } from '../../application/commands/create-task.command';
import { UpdateTaskCommand } from '../../application/commands/update-task.command';
import { DeleteTaskCommand } from '../../application/commands/delete-task.command';
import { MoveTaskCommand } from '../../application/commands/move-task.command';
import { GetTasksQuery } from '../../application/queries/get-tasks.query';
import { GetTaskQuery } from '../../application/queries/get-task.query';
import { CreateTaskDto } from '../../application/dtos/create-task.dto';
import { UpdateTaskDto } from '../../application/dtos/update-task.dto';
import { MoveTaskDto } from '../../application/dtos/move-task.dto';

@Controller('projects/:projectId/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async createTask(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @Req() req: any,
  ) {
    return this.commandBus.execute(
      new CreateTaskCommand(
        projectId,
        dto.title,
        dto.description,
        dto.assignedTo,
        dto.dueDate ? new Date(dto.dueDate) : null,
        dto.priority || 'medium',
        req.user.id,
      ),
    );
  }

  @Get()
  async getTasks(
    @Param('projectId') projectId: string,
    @Query() filters: any,
  ) {
    return this.queryBus.execute(
      new GetTasksQuery(projectId, filters),
    );
  }

  @Get(':taskId')
  async getTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.queryBus.execute(
      new GetTaskQuery(taskId, projectId),
    );
  }

  @Patch(':taskId')
  async updateTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: any,
  ) {
    return this.commandBus.execute(
      new UpdateTaskCommand(taskId, projectId, dto, req.user.id),
    );
  }

  @Patch(':taskId/move')
  async moveTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: MoveTaskDto,
    @Req() req: any,
  ) {
    return this.commandBus.execute(
      new MoveTaskCommand(taskId, projectId, dto.status, req.user.id),
    );
  }

  @Delete(':taskId')
  async deleteTask(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() req: any,
  ) {
    return this.commandBus.execute(
      new DeleteTaskCommand(taskId, projectId, req.user.id),
    );
  }
}
```

---

## 🚀 MODULE STRUCTURE

### Tasks Module

```typescript
// src/modules/tasks/tasks.module.ts

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { TasksController } from './presentation/controllers/tasks.controller';

// Handlers
import { CreateTaskHandler } from './application/commands/create-task.handler';
import { UpdateTaskHandler } from './application/commands/update-task.handler';
import { DeleteTaskHandler } from './application/commands/delete-task.handler';
import { MoveTaskHandler } from './application/commands/move-task.handler';

import { GetTasksQueryHandler } from './application/queries/get-tasks.query.handler';
import { GetTaskQueryHandler } from './application/queries/get-task.query.handler';

import { TaskCreatedHandler } from './infrastructure/event-handlers/task-created.handler';
import { TaskAssignedHandler } from './infrastructure/event-handlers/task-assigned.handler';

// Services
import { TaskDomainService } from './domain/services/task.domain.service';
import { TaskRepository } from './infrastructure/persistence/task.repository';
import { TASK_REPOSITORY } from './domain/repositories/task.repository.interface';

// Shared
import { SharedModule } from '../../shared/shared.module';

const CommandHandlers = [
  CreateTaskHandler,
  UpdateTaskHandler,
  DeleteTaskHandler,
  MoveTaskHandler,
];

const QueryHandlers = [
  GetTasksQueryHandler,
  GetTaskQueryHandler,
];

const EventHandlers = [
  TaskCreatedHandler,
  TaskAssignedHandler,
];

const Services = [
  TaskDomainService,
  {
    provide: TASK_REPOSITORY,
    useClass: TaskRepository,
  },
];

@Module({
  imports: [CqrsModule, SharedModule],
  controllers: [TasksController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventHandlers,
    ...Services,
  ],
  exports: [TaskDomainService],
})
export class TasksModule {}
```

---

## 🔐 AUTH MODULE

```typescript
// src/modules/auth/presentation/controllers/auth.controller.ts

import { Controller, Post, Body } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { LoginCommand } from '../../application/commands/login.command';
import { RegisterCommand } from '../../application/commands/register.command';
import { LoginDto } from '../../application/dtos/login.dto';
import { RegisterDto } from '../../application/dtos/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.commandBus.execute(
      new RegisterCommand(dto.email, dto.password, dto.name),
    );
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.commandBus.execute(
      new LoginCommand(dto.email, dto.password),
    );
  }
}

// src/modules/auth/application/commands/register.command.ts

export class RegisterCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly name: string,
  ) {}
}

// src/modules/auth/application/commands/register.handler.ts

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RegisterCommand } from './register.command';
import { AuthDomainService } from '../../domain/services/auth.domain.service';
import { UserRepository } from '../../../users/infrastructure/persistence/user.repository';
import { ConflictException } from '@nestjs/common';

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  constructor(
    private readonly authService: AuthDomainService,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(command: RegisterCommand) {
    // Check if user exists
    const existingUser = await this.userRepository.findByEmail(command.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Create user through domain service
    const user = await this.authService.register({
      email: command.email,
      password: command.password,
      name: command.name,
    });

    // Generate tokens
    const tokens = await this.authService.generateTokens(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      tokens,
    };
  }
}
```

---

## ⚙️ ROOT MODULE

```typescript
// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { CommentsModule } from './modules/comments/comments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiModule } from './modules/ai/ai.module';

// Shared
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    EventEmitterModule.forRoot(),
    SharedModule,
    AuthModule,
    ProjectsModule,
    TasksModule,
    CommentsModule,
    NotificationsModule,
    AiModule,
  ],
})
export class AppModule {}
```

---

## 🔌 SHARED MODULE

```typescript
// src/shared/shared.module.ts

import { Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { JwtService } from './services/jwt.service';
import { EmailService } from './services/email.service';
import { LoggerService } from './services/logger.service';

@Module({
  providers: [
    PrismaService,
    JwtService,
    EmailService,
    LoggerService,
  ],
  exports: [
    PrismaService,
    JwtService,
    EmailService,
    LoggerService,
  ],
})
export class SharedModule {}

// src/shared/services/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// src/shared/services/jwt.service.ts

import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  generateToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId },
      {
        expiresIn: '24h',
      },
    );
  }

  generateRefreshToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId },
      {
        expiresIn: '30d',
      },
    );
  }

  verifyToken(token: string): any {
    return this.jwtService.verify(token);
  }
}
```

---

## 📦 PACKAGE.JSON

```json
{
  "name": "collabai-backend",
  "version": "0.0.1",
  "description": "CollabAI Backend - NestJS + DDD",
  "author": "",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "prebuild": "rimraf dist",
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:migrate": "npx prisma migrate dev",
    "prisma:generate": "npx prisma generate",
    "prisma:studio": "npx prisma studio",
    "db:seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@nestjs/cqrs": "^10.0.6",
    "@nestjs/common": "^10.2.10",
    "@nestjs/config": "^3.1.1",
    "@nestjs/core": "^10.2.10",
    "@nestjs/event-emitter": "^2.0.3",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.2.10",
    "@nestjs/websockets": "^10.2.10",
    "@prisma/client": "^5.7.1",
    "axios": "^1.6.2",
    "bcryptjs": "^2.4.3",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "dotenv": "^16.3.1",
    "openai": "^4.24.1",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1",
    "socket.io": "^4.7.2",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.2.1",
    "@nestjs/schematics": "^10.0.3",
    "@nestjs/testing": "^10.2.10",
    "@types/bcryptjs": "^2.4.4",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.10",
    "@types/node": "^20.10.5",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "eslint": "^8.56.0",
    "jest": "^29.7.0",
    "prettier": "^3.1.1",
    "prisma": "^5.7.1",
    "rimraf": "^5.0.5",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.1",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.3.3"
  }
}
```

---

## 🐳 DOCKER SETUP

```dockerfile
# Dockerfile

FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
```

```yaml
# docker-compose.yml

version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: development
    depends_on:
      - postgres
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  postgres_data:
```

---

## ✅ SETUP CHECKLIST

- [ ] Create NestJS project: `nest new collabai-backend`
- [ ] Install all dependencies from package.json
- [ ] Create `.env.local` with DATABASE_URL and JWT_SECRET
- [ ] Copy Prisma schema
- [ ] Run `npx prisma migrate dev --name init`
- [ ] Run `npx prisma generate`
- [ ] Copy all domain/application/infrastructure folders
- [ ] Update app.module.ts with all feature modules
- [ ] Run `npm run start:dev`
- [ ] Test endpoints with Postman/Insomnia
- [ ] Set up Docker and docker-compose.yml
- [ ] Configure CI/CD pipeline (GitHub Actions)

---

## 🎯 NEXT STEPS

1. **Implement remaining modules** (Auth, Projects, Comments)
2. **Add WebSocket support** for real-time updates
3. **Implement AI integration** (OpenAI/Claude)
4. **Add comprehensive testing** (unit + e2e)
5. **Setup monitoring** (Sentry, CloudWatch)
6. **Configure production deployment**

