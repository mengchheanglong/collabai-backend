import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { io, Socket } from 'socket.io-client';
import { AddressInfo } from 'node:net';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { EventsGateway } from './events.gateway';
import { RealtimeListener } from './realtime.listener';
import { PrismaService } from '../../shared/services/prisma.service';
import { TokenBlacklistService } from '../auth/infrastructure/services/token-blacklist.service';
import { TASK_REPOSITORY } from '../tasks/domain/repositories/task.repository.interface';
import { COMMENT_REPOSITORY } from '../comments/domain/repositories/comment.repository.interface';
import { WorkspaceChangedEvent } from '../../shared/events/workspace-changed.event';
import { TaskCreatedEvent } from '../tasks/domain/events/task-created.event';
import { DeleteTaskHandler } from '../tasks/application/commands/delete-task.handler';
import { DeleteTaskCommand } from '../tasks/application/commands/delete-task.command';

const user = '00000000-0000-4000-8000-000000000001';
const viewer = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';
const project = '00000000-0000-4000-8000-000000000004';
const taskId = '00000000-0000-4000-8000-000000000005';
const boardId = '00000000-0000-4000-8000-000000000006';
function once(socket: Socket, event: string): Promise<any> {
 return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 2500); socket.once(event, data => { clearTimeout(timer); resolve(data); }); });
}
function ack(socket: Socket, event: string, payload: unknown): Promise<any> { return new Promise((resolve, reject) => socket.timeout(2000).emit(event, payload, (error: Error | null, result: unknown) => error ? reject(error) : resolve(result))); }

describe('Realtime gateway over real Socket.io connections (in-memory persistence)', () => {
 let app: INestApplication; let url: string; let gateway: EventsGateway; let events: EventEmitter2;
 const jwt = new JwtService({ secret: 'socket-integration-test-secret' });
 const clients: Socket[] = []; const members = new Map<string, string>(); const revoked = new Set<string>();
 const task = { id: taskId, projectId: project, boardId, title: 'Committed task', description: null, status: 'todo', priority: 'medium', position: 1000, assigneeId: null, createdById: user, dueDate: null, completedAt: null, labels: [], subtasks: [], commentCount: 0, createdAt: new Date(), updatedAt: new Date() };
 const db = {
  user: { findFirst: jest.fn(async ({ where }) => ({ id: where.id, name: 'Teammate' })) },
  projectMember: { findFirst: jest.fn(async ({ where }) => where.projectId === project && members.has(where.userId) ? { role: members.get(where.userId) } : null) },
  task: { findFirst: jest.fn(async ({ where }) => where.id === taskId && where.projectId === project ? { id: taskId } : null) },
  activity: { create: jest.fn(async ({ data }) => ({ ...data, id: 'activity-1', createdAt: new Date(), user: { id: user, name: 'Teammate', email: 'test@example.com' } })) },
 };
 const token = (id: string, jti = id, expiresIn = 60) => jwt.sign({ sub: id, jti }, { expiresIn });
 async function connect(id: string, accessToken = token(id)) {
  const socket = io(url, { transports: ['websocket'], auth: { token: accessToken }, forceNew: true, reconnection: false, autoConnect: false }); clients.push(socket);
  const connected = once(socket, 'connect'); socket.connect(); await connected; return socket;
 }
 beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [EventEmitterModule.forRoot()], providers: [EventsGateway, RealtimeListener,
   { provide: JwtService, useValue: jwt }, { provide: PrismaService, useValue: db },
   { provide: TokenBlacklistService, useValue: { isBlacklisted: async (jti: string) => revoked.has(jti) } },
   { provide: TASK_REPOSITORY, useValue: { findViewById: async () => task } },
   { provide: COMMENT_REPOSITORY, useValue: { findViewById: async () => null } },
  ] }).compile();
  app = module.createNestApplication(); app.useWebSocketAdapter(new IoAdapter(app)); await app.listen(0, '127.0.0.1');
  url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  gateway = app.get(EventsGateway); events = app.get(EventEmitter2);
 });
 beforeEach(() => { members.clear(); members.set(user, 'member'); members.set(viewer, 'viewer'); revoked.clear(); });
 afterEach(() => { for (const socket of clients.splice(0)) socket.disconnect(); });
 afterAll(async () => { await app?.close(); });
 it('rejects an invalid JWT at handshake', async () => {
  const socket = io(url, { auth: { token: 'invalid' }, reconnection: false, autoConnect: false }); clients.push(socket);
  const error = once(socket, 'connect_error'); socket.connect(); expect((await error).data.code).toBe('UNAUTHORIZED');
 });
 it('rejects malformed IDs and nonmembers joining a project', async () => {
  const socket = await connect(outsider);
  expect((await ack(socket, 'project:join', { projectId: project })).error.code).toBe('FORBIDDEN');
  expect((await ack(socket, 'project:join', { projectId: '../other' })).error.code).toBe('VALIDATION_ERROR');
 });
 it('delivers a committed domain event to two browsers of the same user, but not outsiders', async () => {
  const a = await connect(user); const b = await connect(user); const c = await connect(outsider);
  await ack(a, 'project:join', { projectId: project }); await ack(b, 'project:join', { projectId: project });
  const leaked = jest.fn(); c.on('task:created', leaked);
  const first = once(a, 'task:created'); const second = once(b, 'task:created');
  await events.emitAsync(TaskCreatedEvent.eventName, new TaskCreatedEvent(taskId, project, user, task.title));
  expect((await first).data.task._id).toBe(taskId); expect((await second).data.task.title).toBe(task.title); expect(leaked).not.toHaveBeenCalled();
 });
 it('emits deletion only after a successful write', async () => {
  const socket = await connect(user); await ack(socket, 'project:join', { projectId: project });
  const repo = { findById: jest.fn().mockResolvedValue(task), delete: jest.fn().mockRejectedValue(new Error('DB failed')) };
  const handler = new DeleteTaskHandler(repo as any, { requireWriter: jest.fn() } as any, events);
  const received = jest.fn(); socket.on('task:deleted', received);
  await expect(handler.execute(new DeleteTaskCommand(user, taskId))).rejects.toThrow('DB failed'); expect(received).not.toHaveBeenCalled();
  repo.delete.mockResolvedValue(undefined); const delivered = once(socket, 'task:deleted');
  await handler.execute(new DeleteTaskCommand(user, taskId)); expect((await delivered).data.taskId).toBe(taskId);
 });
 it('evicts removed members and prevents subsequent project delivery', async () => {
  const socket = await connect(user); await ack(socket, 'project:join', { projectId: project }); members.delete(user);
  const removed = once(socket, 'member:removed');
  await events.emitAsync(WorkspaceChangedEvent.eventName, new WorkspaceChangedEvent('member:removed', project, viewer, { userId: user }));
  await removed; expect(gateway.server.sockets.sockets.get(socket.id!)?.rooms.has(`project:${project}`)).toBe(false);
  expect((await ack(socket, 'project:join', { projectId: project })).success).toBe(false);
 });
 it('validates typing against task project and writer role', async () => {
  const a = await connect(user); const b = await connect(viewer);
  await ack(a, 'project:join', { projectId: project }); await ack(b, 'project:join', { projectId: project });
  expect((await ack(b, 'typing:start', { projectId: project, taskId })).success).toBe(false);
  expect((await ack(a, 'typing:start', { projectId: project, taskId: boardId })).success).toBe(false);
  const typing = once(b, 'typing:started'); await ack(a, 'typing:start', { projectId: project, taskId }); expect((await typing).data.taskId).toBe(taskId);
 });
 it('delivers notifications only to the recipient user room', async () => {
  const a = await connect(user); const b = await connect(viewer); const leaked = jest.fn(); b.on('notification:created', leaked);
  const notification = once(a, 'notification:created');
  await events.emitAsync(WorkspaceChangedEvent.eventName, new WorkspaceChangedEvent('notification:created', '', user, { notification: { _id: 'notice' } }, user));
  expect((await notification).data.notification._id).toBe('notice'); expect(leaked).not.toHaveBeenCalled();
 });
 it('rechecks token revocation before sending project data', async () => {
  const socket = await connect(user); await ack(socket, 'project:join', { projectId: project }); revoked.add(user);
  const disconnected = once(socket, 'disconnect');
  await gateway.publish('task:updated', { projectId: project, actorId: viewer, data: { task }, createdAt: new Date().toISOString() });
  await disconnected; expect(socket.connected).toBe(false);
 });
 it('requires rejoining after reconnect', async () => {
  const socket = await connect(user); await ack(socket, 'project:join', { projectId: project }); socket.disconnect();
  const connected = once(socket, 'connect'); socket.connect(); await connected;
  expect(gateway.server.sockets.sockets.get(socket.id!)?.rooms.has(`project:${project}`)).toBe(false);
  expect((await ack(socket, 'project:join', { projectId: project })).success).toBe(true);
 });
 it('disconnects an idle socket when its JWT expires', async () => {
  const socket = await connect(user, token(user, 'short-lived', 1));
  const disconnected = once(socket, 'disconnect'); await disconnected; expect(socket.connected).toBe(false);
 });
});
