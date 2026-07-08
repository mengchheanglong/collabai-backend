# 🚀 NestJS + DDD Backend - Quick Start Guide

Complete setup and best practices for running the CollabAI backend.

---

## 📋 PREREQUISITES

- Node.js 18+ installed
- npm or yarn
- PostgreSQL (or Supabase account)
- Git
- Postman or Insomnia (for API testing)

---

## 🏃 QUICK START (5 MINUTES)

### Step 1: Create Project

```bash
# Install NestJS CLI globally
npm install -g @nestjs/cli

# Create new project
nest new collabai-backend
cd collabai-backend

# Choose npm as package manager
```

### Step 2: Install Dependencies

```bash
# Core dependencies
npm install @nestjs/core @nestjs/common @nestjs/platform-express

# Authentication
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcryptjs

# Database & ORM
npm install @prisma/client prisma dotenv

# CQRS & Event Bus
npm install @nestjs/cqrs @nestjs/event-emitter

# Configuration
npm install @nestjs/config

# Validation
npm install class-validator class-transformer

# Real-time
npm install socket.io @nestjs/websockets

# Utilities
npm install uuid axios

# Development
npm install -D @types/node @nestjs/testing jest ts-jest
npm install -D @types/jest @types/bcryptjs
npm install -D typescript @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D eslint prettier
```

### Step 3: Setup Database

```bash
# Initialize Prisma
npx prisma init

# Create .env.local file
cat > .env.local << EOF
DATABASE_URL="postgresql://user:password@localhost:5432/collabai"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
OPENAI_API_KEY="sk-..."
NODE_ENV="development"
PORT=3000
EOF

# Copy Prisma schema from documentation
# Then run migration
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate
```

### Step 4: Create Project Structure

```bash
# Create directories
mkdir -p src/config
mkdir -p src/common/{decorators,filters,guards,interceptors,pipes,middleware,utils}
mkdir -p src/modules/{auth,projects,tasks,comments,notifications,ai}
mkdir -p src/shared/{services,event-bus,query-bus,command-bus}
mkdir -p test/{e2e,unit}
mkdir -p prisma

# Copy all files from documentation
# Update app.module.ts
# Update main.ts
```

### Step 5: Run Application

```bash
# Development mode with hot reload
npm run start:dev

# Application should be running on http://localhost:3000
```

---

## 🗂️ FILE STRUCTURE CREATION

### Create Main Entry Point

```typescript
// src/main.ts

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggerService } from './shared/services/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = app.get(LoggerService);

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
```

### Create App Module

```typescript
// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';

// Shared
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    CqrsModule,
    EventEmitterModule.forRoot(),
    SharedModule,
    AuthModule,
    ProjectsModule,
    TasksModule,
  ],
})
export class AppModule {}
```

### Create Shared Module

```typescript
// src/shared/shared.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './services/prisma.service';
import { JwtService as CustomJwtService } from './services/jwt.service';
import { LoggerService } from './services/logger.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [PrismaService, CustomJwtService, LoggerService],
  exports: [PrismaService, CustomJwtService, LoggerService, JwtModule],
})
export class SharedModule {}
```

---

## 📝 ENVIRONMENT VARIABLES

```bash
# .env.local

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/collabai"

# JWT
JWT_SECRET="your-secret-key-min-32-characters-long"
JWT_REFRESH_SECRET="your-refresh-secret-key"

# AI
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Email
SENDGRID_API_KEY="SG...."
SENDGRID_FROM_EMAIL="noreply@collabai.com"

# Application
NODE_ENV="development"
PORT=3000
FRONTEND_URL="http://localhost:3000"

# Supabase (optional, if using Supabase managed DB)
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_ANON_KEY="eyJhbGc..."

# Redis (for production)
REDIS_URL="redis://localhost:6379"
```

---

## 🔑 KEY CONCEPTS IN DDD

### 1. **Entities**
- Objects with identity that persist over time
- Example: `TaskEntity`, `ProjectEntity`, `UserEntity`
- Contain business logic related to their domain

### 2. **Value Objects**
- Objects without identity, immutable
- Example: `TaskStatus`, `TaskPriority`, `Money`
- Encapsulate domain-specific concepts

```typescript
export class TaskStatus {
  private constructor(public readonly value: string) {}

  static create(value: string): TaskStatus {
    if (!['todo', 'in_progress', 'done'].includes(value)) {
      throw new Error('Invalid status');
    }
    return new TaskStatus(value);
  }

  equals(other: TaskStatus): boolean {
    return this.value === other.value;
  }
}
```

### 3. **Repositories**
- Abstract data persistence
- Domain layer defines interface, infrastructure implements
- Example: `ITaskRepository` (interface) → `TaskRepository` (implementation)

### 4. **Domain Services**
- Complex business logic that doesn't belong to a single entity
- Example: `TaskDomainService`, `AuthDomainService`
- Orchestrate entities and value objects

### 5. **Application Services**
- Orchestrate domain services
- Handle CQRS commands and queries
- Publish domain events

### 6. **Domain Events**
- Record that something important happened in the domain
- Example: `TaskCreatedEvent`, `TaskAssignedEvent`
- Enable decoupled communication between modules

---

## 🔄 CQRS PATTERN EXPLANATION

### Commands (State-changing operations)

```typescript
// Create a command
export class CreateTaskCommand {
  constructor(
    public readonly projectId: string,
    public readonly title: string,
    public readonly userId: string,
  ) {}
}

// Handle the command
@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  constructor(private readonly taskService: TaskDomainService) {}

  async execute(command: CreateTaskCommand) {
    const task = await this.taskService.createTask({
      projectId: command.projectId,
      title: command.title,
      createdBy: command.userId,
    });
    return task;
  }
}

// Use in controller
@Post()
async create(@Body() dto: CreateTaskDto, @Req() req: any) {
  return this.commandBus.execute(
    new CreateTaskCommand(req.params.projectId, dto.title, req.user.id)
  );
}
```

### Queries (Read operations)

```typescript
// Create a query
export class GetTasksQuery {
  constructor(
    public readonly projectId: string,
    public readonly filters?: TaskFilters,
  ) {}
}

// Handle the query
@QueryHandler(GetTasksQuery)
export class GetTasksHandler implements IQueryHandler<GetTasksQuery> {
  constructor(@Inject(TASK_REPOSITORY) private readonly taskRepo: ITaskRepository) {}

  async execute(query: GetTasksQuery) {
    return this.taskRepo.findByProjectId(query.projectId, query.filters);
  }
}

// Use in controller
@Get()
async getAll(@Param('projectId') projectId: string) {
  return this.queryBus.execute(
    new GetTasksQuery(projectId)
  );
}
```

---

## 📊 DOMAIN EVENT FLOW

```
1. USER ACTION
   └─ Create task in controller

2. COMMAND HANDLER
   ├─ Call domain service
   ├─ Domain service creates entity
   ├─ Entity saved to database
   └─ Emit domain event

3. EVENT PUBLISHER
   ├─ Publish TaskCreatedEvent
   └─ Event bus distributes to handlers

4. EVENT HANDLERS
   ├─ TaskCreatedHandler
   ├─ Create notification
   ├─ Send email
   └─ Update read models (optional)

5. EVENTUALLY CONSISTENT STATE
   └─ All systems synchronized
```

---

## 🧪 TESTING STRUCTURE

### Unit Test Example

```typescript
// test/unit/tasks/domain/task.entity.spec.ts

import { TaskEntity } from '../../../../src/modules/tasks/domain/entities/task.entity';
import { TaskStatus } from '../../../../src/modules/tasks/domain/value-objects/task-status.value-object';

describe('TaskEntity', () => {
  let task: TaskEntity;

  beforeEach(() => {
    task = TaskEntity.create({
      id: '123',
      projectId: 'proj-123',
      title: 'Test task',
      createdBy: 'user-123',
    });
  });

  it('should create a task', () => {
    expect(task.id).toBe('123');
    expect(task.title).toBe('Test task');
    expect(task.status.equals(TaskStatus.TODO)).toBe(true);
  });

  it('should update task status', () => {
    task.updateStatus(TaskStatus.IN_PROGRESS);
    expect(task.status.equals(TaskStatus.IN_PROGRESS)).toBe(true);
  });

  it('should throw error on invalid title', () => {
    expect(() => task.updateTitle('')).toThrow();
  });
});
```

### E2E Test Example

```typescript
// test/e2e/tasks.e2e-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Tasks E2E', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login and get token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    authToken = loginRes.body.tokens.access_token;
  });

  describe('POST /projects/:projectId/tasks', () => {
    it('should create a task', async () => {
      const res = await request(app.getHttpServer())
        .post('/projects/proj-123/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'New task',
          priority: 'high',
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New task');
    });
  });

  describe('GET /projects/:projectId/tasks', () => {
    it('should get all tasks', async () => {
      const res = await request(app.getHttpServer())
        .get('/projects/proj-123/tasks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## 🛡️ AUTHENTICATION GUARD

```typescript
// src/common/guards/jwt-auth.guard.ts

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: any) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}

// Usage in controller
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  @Get()
  getProjects(@Req() req: any) {
    // req.user contains current user
    return this.queryBus.execute(new GetProjectsQuery(req.user.id));
  }
}
```

---

## 🚨 GLOBAL EXCEPTION FILTER

```typescript
// src/common/filters/all-exceptions.filter.ts

import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = (exceptionResponse as any).message || exception.message;
    }

    this.logger.error(
      `[${request.method}] ${request.url} - ${status} - ${JSON.stringify(exception)}`,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}

// Register in main.ts
app.useGlobalFilters(new AllExceptionsFilter());
```

---

## 🔍 LOGGING SERVICE

```typescript
// src/shared/services/logger.service.ts

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private logger = new Logger();

  log(message: string, context?: string) {
    this.logger.log(message, context);
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, trace, context);
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, context);
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, context);
  }
}

// Usage
constructor(private readonly logger: LoggerService) {}

this.logger.log('Task created', 'TaskService');
this.logger.error('Database error', error.stack, 'TaskRepository');
```

---

## 🎯 BEST PRACTICES

### ✅ DO

```typescript
// 1. Use dependency injection
constructor(
  @Inject(TASK_REPOSITORY) private readonly taskRepo: ITaskRepository,
) {}

// 2. Validate inputs with DTOs
@Post()
async create(@Body() dto: CreateTaskDto) {
  // DTO validation happens automatically
}

// 3. Use value objects for domain concepts
const priority = TaskPriority.create('high');

// 4. Emit domain events for important changes
this.eventBus.publish(new TaskCreatedEvent(taskId, projectId));

// 5. Use CQRS for complex operations
return this.commandBus.execute(new CreateTaskCommand(...));

// 6. Separate concerns - domain, application, infrastructure
src/modules/tasks/
  ├── domain/        (pure business logic)
  ├── application/   (use cases, CQRS handlers)
  └── infrastructure/ (database, external services)
```

### ❌ DON'T

```typescript
// 1. Don't mix domain logic with infrastructure
// ❌ BAD
await db.query('UPDATE tasks SET status = ...');

// ✅ GOOD
const task = await this.taskRepository.findById(id);
task.updateStatus(status);
await this.taskRepository.save(task);

// 2. Don't expose entities directly
// ❌ BAD
return task; // TaskEntity

// ✅ GOOD
return this.mapper.toPersistence(task);

// 3. Don't have circular dependencies
// ✅ Use event bus for communication between modules

// 4. Don't put business logic in controllers
// ❌ BAD
if (task.status === 'done') { /* logic */ }

// ✅ GOOD - put in domain service
task.complete();

// 5. Don't skip error handling
// ❌ BAD
const user = await userRepository.findById(id);

// ✅ GOOD
const user = await userRepository.findByIdOrThrow(id);
```

---

## 🔧 COMMON COMMANDS

```bash
# Development
npm run start:dev          # Start with hot reload
npm run build              # Build for production
npm run lint               # Run ESLint
npm run format             # Format with Prettier

# Database
npx prisma migrate dev     # Create migration
npx prisma migrate deploy  # Deploy migrations (production)
npx prisma studio         # Open Prisma Studio UI
npx prisma generate       # Generate Prisma client

# Testing
npm run test               # Run unit tests
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
npm run test:e2e           # Run E2E tests

# Prisma
npx prisma db push        # Push schema changes
npx prisma db seed        # Seed database
npx prisma validate       # Validate schema
```

---

## 🐛 DEBUGGING

### VSCode Debug Configuration

```json
// .vscode/launch.json

{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/nest",
      "args": ["start", "--watch", "--debug"],
      "cwd": "${workspaceFolder}",
      "preLaunchTask": "npm: start:debug"
    }
  ]
}
```

### Debug with breakpoints

```bash
# Run in debug mode
npm run start:debug

# Then attach VS Code debugger or use Chrome DevTools
# chrome://inspect
```

---

## 📦 DEPLOYMENT CHECKLIST

- [ ] Update `.env` variables for production
- [ ] Run database migrations: `npx prisma migrate deploy`
- [ ] Build application: `npm run build`
- [ ] Run linter: `npm run lint`
- [ ] Run tests: `npm run test:cov`
- [ ] Build Docker image: `docker build -t collabai-api:latest .`
- [ ] Push to container registry
- [ ] Deploy to AWS/Heroku/DigitalOcean
- [ ] Setup monitoring (Sentry, CloudWatch)
- [ ] Configure CI/CD pipeline (GitHub Actions)
- [ ] Setup SSL certificates
- [ ] Configure database backups
- [ ] Setup Redis (if production)

---

## 🎓 LEARNING RESOURCES

- [NestJS Documentation](https://docs.nestjs.com)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## 🆘 TROUBLESHOOTING

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database Connection Issues

```bash
# Check DATABASE_URL in .env.local
# Verify PostgreSQL is running
psql -U user -h localhost -d collabai

# Check Prisma can connect
npx prisma db execute --stdin < /dev/null
```

### Prisma Client Not Generated

```bash
# Regenerate Prisma client
npx prisma generate

# Or during migration
npx prisma migrate dev
```

### JWT Token Validation Fails

```bash
# Check JWT_SECRET is set correctly
echo $JWT_SECRET

# Make sure token hasn't expired
# Check Authorization header format: "Bearer <token>"
```

---

**Last Updated**: January 2024
**Status**: Ready for Development

