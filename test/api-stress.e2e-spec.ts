// test/api-stress.e2e-spec.ts
// Comprehensive Phase 1 API Stress & Edge-Case Test Suite

import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

jest.setTimeout(180000);

describe('CollabAI Phase 1 - Comprehensive API Stress & Edge Case Test Suite', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let server: import('http').Server;

  const testEmails: string[] = [];

  let userA: { id: string; email: string; token: string };
  let userB: { id: string; email: string; token: string };
  let userC: { id: string; email: string; token: string }; // Unrelated third user for isolation tests

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer();
    prisma = new PrismaClient();

    // Register User A
    const emailA = `test_user_a_${Date.now()}@example.com`;
    testEmails.push(emailA);
    const agentA = request.agent(server);
    await agentA
      .post('/auth/register')
      .send({
        email: emailA,
        password: 'StrongPassword123!',
        firstName: 'Alice',
        lastName: 'Admin',
      })
      .expect(201);
    const codeA = (await prisma.user.findUnique({ where: { email: emailA } }))
      ?.verificationCode;
    await agentA.post('/auth/verify-email').send({ code: codeA }).expect(200);
    const loginA = await agentA
      .post('/auth/login')
      .send({ email: emailA, password: 'StrongPassword123!' })
      .expect(200);
    const recA = await prisma.user.findUnique({ where: { email: emailA } });
    userA = { id: recA!.id, email: emailA, token: loginA.body.accessToken };

    // Register User B
    const emailB = `test_user_b_${Date.now()}@example.com`;
    testEmails.push(emailB);
    const agentB = request.agent(server);
    await agentB
      .post('/auth/register')
      .send({
        email: emailB,
        password: 'StrongPassword123!',
        firstName: 'Bob',
        lastName: 'Member',
      })
      .expect(201);
    const codeB = (await prisma.user.findUnique({ where: { email: emailB } }))
      ?.verificationCode;
    await agentB.post('/auth/verify-email').send({ code: codeB }).expect(200);
    const loginB = await agentB
      .post('/auth/login')
      .send({ email: emailB, password: 'StrongPassword123!' })
      .expect(200);
    const recB = await prisma.user.findUnique({ where: { email: emailB } });
    userB = { id: recB!.id, email: emailB, token: loginB.body.accessToken };

    // Register User C (Isolated outsider)
    const emailC = `test_user_c_${Date.now()}@example.com`;
    testEmails.push(emailC);
    const agentC = request.agent(server);
    await agentC
      .post('/auth/register')
      .send({
        email: emailC,
        password: 'StrongPassword123!',
        firstName: 'Charlie',
        lastName: 'Outsider',
      })
      .expect(201);
    const codeC = (await prisma.user.findUnique({ where: { email: emailC } }))
      ?.verificationCode;
    await agentC.post('/auth/verify-email').send({ code: codeC }).expect(200);
    const loginC = await agentC
      .post('/auth/login')
      .send({ email: emailC, password: 'StrongPassword123!' })
      .expect(200);
    const recC = await prisma.user.findUnique({ where: { email: emailC } });
    userC = { id: recC!.id, email: emailC, token: loginC.body.accessToken };
  });

  afterAll(async () => {
    if (testEmails.length) {
      const users = await prisma.user.findMany({
        where: { email: { in: testEmails } },
        select: { id: true },
      });
      const userIds = users.map((u) => u.id);
      const userProjects = await prisma.project.findMany({
        where: { ownerId: { in: userIds } },
      });
      const projectIds = userProjects.map((p) => p.id);
      await prisma.subtask.deleteMany({
        where: { task: { projectId: { in: projectIds } } },
      });
      await prisma.comment.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.task.deleteMany({ where: { createdBy: { in: userIds } } });
      await prisma.board.deleteMany({
        where: { projectId: { in: projectIds } },
      });
      await prisma.projectMember.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.project.deleteMany({ where: { ownerId: { in: userIds } } });
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user
        .deleteMany({ where: { id: { in: userIds } } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
    await app.close();
  });

  // ==========================================
  // 1.1 Authentication Endpoints Stress Tests
  // ==========================================
  describe('1.1 Auth Endpoints Edge Cases', () => {
    it('1.1.1 Rejects empty firstName or lastName', async () => {
      await request(server)
        .post('/auth/register')
        .send({
          email: `edge_${Date.now()}@example.com`,
          password: 'Password123!',
          firstName: '',
          lastName: 'Test',
        })
        .expect(400);
    });

    it('1.1.2 Rejects password shorter than min length', async () => {
      await request(server)
        .post('/auth/register')
        .send({
          email: `edge_${Date.now()}@example.com`,
          password: 'short',
          firstName: 'Short',
          lastName: 'Pass',
        })
        .expect(400);
    });

    it('1.1.3 Rejects malformed email formats', async () => {
      await request(server)
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'Password123!',
          firstName: 'Bad',
          lastName: 'Email',
        })
        .expect(400);
    });

    it('1.1.4 Prevents duplicate email registration (409 Conflict)', async () => {
      await request(server)
        .post('/auth/register')
        .send({
          email: userA.email,
          password: 'Password123!',
          firstName: 'Duplicate',
          lastName: 'User',
        })
        .expect(409);
    });

    it('1.1.5 Rejects extra non-whitelisted fields (privilege escalation protection)', async () => {
      await request(server)
        .post('/auth/register')
        .send({
          email: `edge_role_${Date.now()}@example.com`,
          password: 'Password123!',
          firstName: 'Hacker',
          lastName: 'Guy',
          role: 'admin',
          isAdmin: true,
        })
        .expect(400);
    });

    it('1.1.6 Returns 401 on wrong password during login without leaking details', async () => {
      const res = await request(server)
        .post('/auth/login')
        .send({ email: userA.email, password: 'WrongPassword999!' })
        .expect(401);
      expect(res.body.error).toBeDefined();
    });

    it('1.1.7 Returns 401 for non-existent email during login', async () => {
      await request(server)
        .post('/auth/login')
        .send({
          email: 'nonexistent_user_99999@example.com',
          password: 'Password123!',
        })
        .expect(401);
    });

    it('1.1.8 Complete Password Reset Flow: request -> verify -> reset -> login with new password', async () => {
      const resetEmail = `reset_${Date.now()}@example.com`;
      testEmails.push(resetEmail);
      const agent = request.agent(server);

      // Register & verify
      await agent
        .post('/auth/register')
        .send({
          email: resetEmail,
          password: 'InitialPassword123!',
          firstName: 'Reset',
          lastName: 'User',
        })
        .expect(201);
      const code = (
        await prisma.user.findUnique({ where: { email: resetEmail } })
      )?.verificationCode;
      await agent.post('/auth/verify-email').send({ code }).expect(200);

      // 1. Request password reset
      await agent
        .post('/auth/request-password-reset')
        .send({ email: resetEmail })
        .expect(200);

      const resetCode = (
        await prisma.user.findUnique({ where: { email: resetEmail } })
      )?.passwordResetCode;
      expect(resetCode).toBeTruthy();

      // 2. Verify password reset code
      await agent
        .post('/auth/verify-password-reset')
        .send({ code: resetCode })
        .expect(200);

      // 3. Reset password
      await agent
        .post('/auth/reset-password')
        .send({ password: 'NewStrongPassword123!' })
        .expect(200);

      // 4. Log in with new password
      const loginRes = await request(server)
        .post('/auth/login')
        .send({ email: resetEmail, password: 'NewStrongPassword123!' })
        .expect(200);

      expect(loginRes.body.accessToken).toBeDefined();
    });

    it('1.1.9 Rejects unauthenticated request on /auth/me (401)', async () => {
      await request(server).get('/auth/me').expect(401);
    });

    it('1.1.10 Returns current user profile on /auth/me when authenticated', async () => {
      const res = await request(server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(userA.email);
    });
  });

  // ==========================================
  // 1.2 Project CRUD & Multi-Tenant Isolation
  // ==========================================
  let projectAId: string;
  let projectABoardId: string;

  describe('1.2 Project CRUD & Multi-Tenant Isolation', () => {
    it('1.2.1 Creates project and auto-provisions a default board', async () => {
      const res = await request(server)
        .post('/projects')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          name: 'Alpha Suite',
          description: 'Primary engineering workspace',
          color: '#8b6fff',
        })
        .expect(201);

      expect(res.body.project).toBeDefined();
      projectAId = res.body.project.id || res.body.project._id;
      expect(projectAId).toBeTruthy();

      const boardsRes = await request(server)
        .get(`/projects/${projectAId}/boards`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      const boards = boardsRes.body.boards || boardsRes.body;
      expect(boards.length).toBeGreaterThanOrEqual(1);
      projectABoardId = boards[0].id || boards[0]._id;
      expect(projectABoardId).toBeTruthy();
    });

    it('1.2.2 Rejects project creation with empty name', async () => {
      await request(server)
        .post('/projects')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ name: '' })
        .expect(400);
    });

    it('1.2.3 Enforces Multi-Tenant Isolation: User B cannot access User A project (403)', async () => {
      await request(server)
        .get(`/projects/${projectAId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(403);
    });

    it('1.2.4 Enforces Multi-Tenant Isolation: User B cannot update User A project (403)', async () => {
      await request(server)
        .patch(`/projects/${projectAId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({ name: 'Hacked Project Name' })
        .expect(403);
    });

    it('1.2.5 Allows User A to update own project name and description', async () => {
      const res = await request(server)
        .patch(`/projects/${projectAId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          name: 'Alpha Suite Pro',
          description: 'Updated engineering workspace',
        })
        .expect(200);

      const project = res.body.project || res.body;
      expect(project.name).toBe('Alpha Suite Pro');
    });

    it('1.2.6 Adds User B as a member to User A project', async () => {
      const res = await request(server)
        .post(`/projects/${projectAId}/members`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ email: userB.email, role: 'member' })
        .expect(201);

      expect(res.body).toBeDefined();
    });

    it('1.2.7 User B can now read the project after membership is granted', async () => {
      const res = await request(server)
        .get(`/projects/${projectAId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(200);

      const project = res.body.project || res.body;
      expect(project.id || project._id).toBe(projectAId);
    });

    it('1.2.8 Rejects adding duplicate member (409 Conflict)', async () => {
      await request(server)
        .post(`/projects/${projectAId}/members`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ email: userB.email, role: 'member' })
        .expect(409);
    });

    it('1.2.9 Rejects inviting non-existent email (404 Not Found)', async () => {
      await request(server)
        .post(`/projects/${projectAId}/members`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ email: 'nobody_exists_12345@example.com', role: 'member' })
        .expect(404);
    });

    it('1.2.10 Lists project members', async () => {
      const res = await request(server)
        .get(`/projects/${projectAId}/members`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      const members = res.body.members || res.body;
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBeGreaterThanOrEqual(2);
    });

    it('1.2.11 Prevents removing sole owner from project (409 Conflict)', async () => {
      await request(server)
        .delete(`/projects/${projectAId}/members/${userA.id}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(409);
    });

    it('1.2.12 Multi-Tenant Isolation: User C (outsider) is forbidden from listing members (403)', async () => {
      await request(server)
        .get(`/projects/${projectAId}/members`)
        .set('Authorization', `Bearer ${userC.token}`)
        .expect(403);
    });
  });

  // ==========================================
  // 1.3 Board Endpoints
  // ==========================================
  describe('1.3 Board Endpoints', () => {
    it('1.3.1 Lists boards for project', async () => {
      const res = await request(server)
        .get(`/projects/${projectAId}/boards`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      const boards = res.body.boards || res.body;
      expect(boards.length).toBeGreaterThanOrEqual(1);
    });

    it('1.3.2 Gets board view with columns and tasks', async () => {
      const res = await request(server)
        .get(`/boards/${projectABoardId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      const board = res.body.board || res.body;
      expect(board.columns).toBeDefined();
      expect(Array.isArray(board.columns)).toBe(true);
    });

    it('1.3.3 Gets board with includeTasks=true query', async () => {
      const res = await request(server)
        .get(`/boards/${projectABoardId}?includeTasks=true`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      expect(res.body.board).toBeDefined();
      expect(res.body.tasks).toBeDefined();
      expect(Array.isArray(res.body.tasks)).toBe(true);
    });

    it('1.3.4 User C (outsider) is forbidden from accessing board (403)', async () => {
      await request(server)
        .get(`/boards/${projectABoardId}`)
        .set('Authorization', `Bearer ${userC.token}`)
        .expect(403);
    });

    it('1.3.5 Creates secondary board in project', async () => {
      const res = await request(server)
        .post(`/projects/${projectAId}/boards`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          name: 'Backend Sprint Board',
          description: 'Sprint tracking board',
        })
        .expect(201);

      expect(res.body.board).toBeDefined();
      expect(res.body.board.name).toBe('Backend Sprint Board');
    });
  });

  // ==========================================
  // 1.4 Task CRUD, Position & Operations
  // ==========================================
  let taskId1: string;
  let taskId2: string;

  describe('1.4 Task CRUD & Operations', () => {
    it('1.4.1 Creates task with valid inputs and default position', async () => {
      const res = await request(server)
        .post('/tasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          projectId: projectAId,
          boardId: projectABoardId,
          title: 'Implement Dark Mode Architecture',
          description:
            'Establish global CSS variables for colors, panels, and borders.',
          priority: 'high',
          status: 'todo',
          assigneeId: userB.id,
        })
        .expect(201);

      const task = res.body.task || res.body;
      taskId1 = task.id || task._id;
      expect(taskId1).toBeTruthy();
      expect(task.title).toBe('Implement Dark Mode Architecture');
      expect(task.priority).toBe('high');
      expect(task.assigneeId).toBe(userB.id);
    });

    it('1.4.2 Creates a second task in the same column', async () => {
      const res = await request(server)
        .post('/tasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          projectId: projectAId,
          boardId: projectABoardId,
          title: 'Setup automated CI/CD pipeline',
          priority: 'medium',
          status: 'todo',
        })
        .expect(201);

      const task = res.body.task || res.body;
      taskId2 = task.id || task._id;
      expect(taskId2).toBeTruthy();
    });

    it('1.4.3 Rejects task creation with empty title (400)', async () => {
      await request(server)
        .post('/tasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          projectId: projectAId,
          boardId: projectABoardId,
          title: '',
        })
        .expect(400);
    });

    it('1.4.4 Rejects task creation with non-member assignee (400 Bad Request)', async () => {
      await request(server)
        .post('/tasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          projectId: projectAId,
          boardId: projectABoardId,
          title: 'Assign to non-member',
          assigneeId: userC.id,
        })
        .expect(400);
    });

    it('1.4.5 Moves task from todo to in_progress column via /tasks/:id/move', async () => {
      const res = await request(server)
        .post(`/tasks/${taskId1}/move`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          destinationStatus: 'in_progress',
          destinationPosition: 1000,
        })
        .expect(200);

      const task = res.body.task || res.body;
      expect(task.status).toBe('in_progress');
    });

    it('1.4.6 Updates task properties inline (title, priority, description, dueDate)', async () => {
      const dueDateStr = new Date(Date.now() + 86400000).toISOString();
      const res = await request(server)
        .patch(`/tasks/${taskId1}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          title: 'Implement Dark Mode Architecture [Polished]',
          priority: 'urgent',
          description: 'Updated with full token definitions.',
          dueDate: dueDateStr,
        })
        .expect(200);

      const task = res.body.task || res.body;
      expect(task.title).toBe('Implement Dark Mode Architecture [Polished]');
      expect(task.priority).toBe('urgent');
      expect(task.description).toBe('Updated with full token definitions.');
    });

    it('1.4.7 Lists tasks for project with filters (status=in_progress)', async () => {
      const res = await request(server)
        .get(`/projects/${projectAId}/tasks?status=in_progress`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      const items = res.body.items || res.body;
      expect(Array.isArray(items)).toBe(true);
      expect(items.some((t: any) => (t.id || t._id) === taskId1)).toBe(true);
    });

    // Subtasks
    let subtaskId: string;
    it('1.4.8 Adds a subtask to task', async () => {
      const res = await request(server)
        .post(`/tasks/${taskId1}/subtasks`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ title: 'Define surface background tokens' })
        .expect(201);

      const subtask =
        res.body.subtask ||
        (res.body.task?.subtasks
          ? res.body.task.subtasks[res.body.task.subtasks.length - 1]
          : res.body);
      subtaskId = subtask.id || subtask._id;
      expect(subtaskId).toBeTruthy();
      expect(subtask.title).toBe('Define surface background tokens');
      expect(subtask.done).toBe(false);
    });

    it('1.4.9 Toggles subtask to done', async () => {
      const res = await request(server)
        .patch(`/tasks/${taskId1}/subtasks/${subtaskId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ done: true })
        .expect(200);

      const subtask =
        res.body.subtask ||
        (res.body.task?.subtasks
          ? res.body.task.subtasks.find(
              (s: any) => (s.id || s._id) === subtaskId,
            )
          : res.body);
      expect(subtask.done).toBe(true);
    });

    it('1.4.10 Deletes subtask', async () => {
      await request(server)
        .delete(`/tasks/${taskId1}/subtasks/${subtaskId}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);
    });

    // Comments
    let commentId: string;
    it('1.4.11 Adds a comment to task', async () => {
      const res = await request(server)
        .post(`/tasks/${taskId1}/comments`)
        .set('Authorization', `Bearer ${userB.token}`)
        .send({
          body: 'I have started testing the color tokens across Safari and Chrome.',
        })
        .expect(201);

      const comment = res.body.comment || res.body;
      commentId = comment.id || comment._id;
      expect(commentId).toBeTruthy();
    });

    it('1.4.12 Lists comments for task', async () => {
      const res = await request(server)
        .get(`/tasks/${taskId1}/comments`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      const comments = res.body.comments || res.body;
      expect(comments.length).toBeGreaterThanOrEqual(1);
    });

    it('1.4.13 Deletes comment by author', async () => {
      await request(server)
        .delete(`/tasks/${taskId1}/comments/${commentId}`)
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(200);
    });
  });

  // ==========================================
  // 1.5 AI Endpoints
  // ==========================================
  describe('1.5 AI Endpoints', () => {
    it('1.5.1 Generates subtasks for task via AI endpoint', async () => {
      const res = await request(server)
        .post('/ai/subtasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          title: 'Implement OAuth authentication with Google and GitHub',
          description:
            'Add OAuth provider configurations, callbacks, and user account linking.',
          count: 3,
        })
        .expect(200);

      expect(res.body.subtasks).toBeDefined();
      expect(Array.isArray(res.body.subtasks)).toBe(true);
      expect(res.body.subtasks.length).toBeGreaterThan(0);
    });

    it('1.5.2 Improves task description via AI endpoint', async () => {
      const res = await request(server)
        .post('/ai/description')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          title: 'Refactor database indexing',
          description: 'speed up queries',
          mode: 'improve',
        })
        .expect(200);

      expect(res.body.description).toBeDefined();
      expect(typeof res.body.description).toBe('string');
      expect(res.body.description.length).toBeGreaterThan(15);
    });

    it('1.5.3 Summarizes task discussion comments via AI endpoint', async () => {
      const res = await request(server)
        .post('/ai/summarize-comments')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ taskId: taskId1 })
        .expect(200);

      expect(res.body.summary).toBeDefined();
      expect(typeof res.body.summary).toBe('string');
    });

    it('1.5.4 Performs semantic search for tasks via AI endpoint', async () => {
      const res = await request(server)
        .post('/ai/search-tasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          projectId: projectAId,
          query: 'Dark mode styling architecture',
        })
        .expect(200);

      expect(res.body.taskIds).toBeDefined();
      expect(Array.isArray(res.body.taskIds)).toBe(true);
    });

    it('1.5.5 Generates structured tasks via AI endpoint', async () => {
      const res = await request(server)
        .post('/ai/generate-tasks')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({
          projectId: projectAId,
          prompt: 'Implement end-to-end integration tests for payment module',
          count: 3,
        })
        .expect(200);

      expect(res.body.tasks).toBeDefined();
      expect(Array.isArray(res.body.tasks)).toBe(true);
      expect(res.body.tasks.length).toBe(3);
      expect(res.body.tasks[0].title).toBeDefined();
    });
  });

  // ==========================================
  // 1.6 Malformed IDs & Edge Case Error Handling
  // ==========================================
  describe('1.6 Malformed IDs & Edge Cases', () => {
    it('1.6.1 Non-UUID project ID returns 404 cleanly (no 500 unhandled Prisma crash)', async () => {
      await request(server)
        .get('/projects/not-a-valid-uuid')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(404);
    });

    it('1.6.2 Non-UUID task ID returns 404 cleanly', async () => {
      await request(server)
        .get('/tasks/invalid-uuid-format')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(404);
    });

    it('1.6.3 Non-UUID board ID returns 404 cleanly', async () => {
      await request(server)
        .get('/boards/invalid-uuid-format')
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(404);
    });

    it('1.6.4 Case-insensitive email login works seamlessly', async () => {
      const upperEmail = userA.email.toUpperCase();
      const loginRes = await request(server)
        .post('/auth/login')
        .send({ email: upperEmail, password: 'StrongPassword123!' })
        .expect(200);

      expect(loginRes.body.accessToken).toBeDefined();
    });

    it('1.6.5 Verify-email with body fallback succeeds without cookies', async () => {
      const freshEmail = `fallback_verify_${Date.now()}@example.com`;
      testEmails.push(freshEmail);

      // Register without cookie persistence
      await request(server)
        .post('/auth/register')
        .send({
          email: freshEmail,
          password: 'StrongPassword123!',
          firstName: 'Fallback',
          lastName: 'Tester',
        })
        .expect(201);

      const code = (
        await prisma.user.findUnique({ where: { email: freshEmail } })
      )?.verificationCode;

      // Call verify-email directly without cookie, providing email in body
      await request(server)
        .post('/auth/verify-email')
        .send({ code, email: freshEmail.toUpperCase() })
        .expect(200);

      const verifiedUser = await prisma.user.findUnique({
        where: { email: freshEmail },
      });
      expect(verifiedUser?.emailVerified).toBe(true);
    });
  });
});
