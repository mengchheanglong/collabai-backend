import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../shared/services/prisma.service';
import { TokenBlacklistService } from '../auth/infrastructure/services/token-blacklist.service';

export interface LiveEvent { projectId: string; actorId: string; data: Record<string, unknown>; createdAt: string; }
interface Claims { sub: string; exp: number; jti?: string; }

@WebSocketGateway({
 cors: { origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
  const allowed = process.env.NODE_ENV !== 'production' || !origin || origin === (process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200');
  callback(allowed ? null : new Error('Origin not allowed'), allowed);
 }, credentials: true },
 maxHttpBufferSize: 16384,
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
 @WebSocketServer() server!: Server;
 private readonly logger = new Logger(EventsGateway.name);
 private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
 constructor(private readonly jwt: JwtService, private readonly blacklist: TokenBlacklistService, private readonly db: PrismaService) {}

 afterInit(server: Server) {
  server.use((socket, next) => { void this.authenticate(socket).then(() => next()).catch(() => {
   const error = new Error('Invalid token') as Error & { data: unknown };
   error.data = { code: 'UNAUTHORIZED', message: 'Invalid token' }; next(error);
  }); });
 }
 async authenticate(socket: Socket): Promise<Claims> {
  const token: unknown = socket.handshake.auth?.token;
  if (typeof token !== 'string' || token.length > 8192) throw new Error('Invalid token');
  const claims = this.jwt.verify<Claims>(token);
  if (!isUUID(claims.sub) || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) throw new Error('Invalid token');
  if (claims.jti && await this.blacklist.isBlacklisted(claims.jti)) throw new Error('Revoked token');
  const user = await this.db.user.findFirst({ where: { id: claims.sub, isActive: true, deletedAt: null }, select: { id: true, name: true } });
  if (!user) throw new Error('Inactive user');
  socket.data.user = user; socket.data.claims = claims;
  return claims;
 }
 handleConnection(socket: Socket) {
  void socket.join(`user:${socket.data.user.id}`);
  const delay = Math.min(socket.data.claims.exp * 1000 - Date.now(), 2147483647);
  const timer = setTimeout(() => { socket.emit('auth:expired', { code: 'UNAUTHORIZED' }); socket.disconnect(true); }, Math.max(0, delay));
  timer.unref(); this.timers.set(socket.id, timer);
 }
 handleDisconnect(socket: Socket) { const timer = this.timers.get(socket.id); if (timer) clearTimeout(timer); this.timers.delete(socket.id); }
 onModuleDestroy() { for (const timer of this.timers.values()) clearTimeout(timer); this.timers.clear(); }

 private projectId(payload: unknown): string | null {
  const id = (payload as { projectId?: unknown } | null)?.projectId;
  return typeof id === 'string' && isUUID(id) ? id : null;
 }
 private async member(projectId: string, userId: string) {
  return this.db.projectMember.findFirst({ where: { projectId, userId, isActive: true, project: { deletedAt: null } }, select: { role: true } });
 }
 private failure(code: string) { return { success: false, error: { code, message: code === 'UNAUTHORIZED' ? 'Invalid token' : 'Project unavailable or invalid request' } }; }

 @SubscribeMessage('project:join')
 async join(@ConnectedSocket() socket: Socket, @MessageBody() payload: unknown) {
  const projectId = this.projectId(payload); if (!projectId) return this.failure('VALIDATION_ERROR');
  try {
   await this.authenticate(socket);
   if (!await this.member(projectId, socket.data.user.id)) return this.failure('FORBIDDEN');
   await socket.join(`project:${projectId}`);
   // Recheck after the asynchronous join so a concurrent removal cannot retain access.
   if (!await this.member(projectId, socket.data.user.id)) { await socket.leave(`project:${projectId}`); return this.failure('FORBIDDEN'); }
   const ack = { success: true, projectId }; socket.emit('project:joined', ack); return ack;
  } catch { socket.disconnect(true); return this.failure('UNAUTHORIZED'); }
 }
 @SubscribeMessage('project:leave')
 async leave(@ConnectedSocket() socket: Socket, @MessageBody() payload: unknown) {
  const projectId = this.projectId(payload); if (!projectId) return this.failure('VALIDATION_ERROR');
  await socket.leave(`project:${projectId}`); return { success: true, projectId };
 }
 @SubscribeMessage('typing:start')
 start(@ConnectedSocket() socket: Socket, @MessageBody() payload: unknown) { return this.typing(socket, payload, true); }
 @SubscribeMessage('typing:stop')
 stop(@ConnectedSocket() socket: Socket, @MessageBody() payload: unknown) { return this.typing(socket, payload, false); }
 private async typing(socket: Socket, payload: unknown, start: boolean) {
  const projectId = this.projectId(payload); const taskId = (payload as { taskId?: unknown } | null)?.taskId;
  if (!projectId || typeof taskId !== 'string' || !isUUID(taskId)) return this.failure('VALIDATION_ERROR');
  try {
   await this.authenticate(socket);
   const member = await this.member(projectId, socket.data.user.id);
   if (!member || !['owner', 'admin', 'member'].includes(member.role) || !socket.rooms.has(`project:${projectId}`)) return this.failure('FORBIDDEN');
   if (!await this.db.task.findFirst({ where: { id: taskId, projectId, deletedAt: null }, select: { id: true } })) return this.failure('FORBIDDEN');
   if (start && Date.now() - (socket.data.lastTyping ?? 0) < 1000) return { success: true };
   socket.data.lastTyping = Date.now();
   await this.publish(start ? 'typing:started' : 'typing:stopped', { projectId, actorId: socket.data.user.id, data: { taskId, userId: socket.data.user.id, name: socket.data.user.name }, createdAt: new Date().toISOString() }, socket.id);
   return { success: true };
  } catch { return this.failure('UNAUTHORIZED'); }
 }

 /** Revalidate recipients before delivery; room possession alone never grants access. */
 async publish(name: string, event: LiveEvent, excludeSocketId?: string) {
  if (!this.server) return;
  const ids = [...(this.server.sockets.adapter.rooms.get(`project:${event.projectId}`) ?? [])];
  for (const id of ids) {
   if (id === excludeSocketId) continue;
   const socket = this.server.sockets.sockets.get(id); if (!socket) continue;
   try {
    await this.authenticate(socket);
    if (!socket.rooms.has(`project:${event.projectId}`)) continue;
    if (name !== 'project:deleted' && !await this.member(event.projectId, socket.data.user.id)) { await socket.leave(`project:${event.projectId}`); continue; }
    socket.emit(name, event);
   } catch { socket.disconnect(true); }
  }
  if (name === 'project:deleted') this.server.in(`project:${event.projectId}`).socketsLeave(`project:${event.projectId}`);
 }
 async publishToUser(userId: string, name: string, event: LiveEvent) {
  if (!this.server) return;
  for (const id of this.server.sockets.adapter.rooms.get(`user:${userId}`) ?? []) {
   const socket = this.server.sockets.sockets.get(id); if (!socket) continue;
   try { await this.authenticate(socket); socket.emit(name, event); } catch { socket.disconnect(true); }
  }
 }
 evict(projectId: string, userId: string) { this.server?.in(`user:${userId}`).socketsLeave(`project:${projectId}`); }
}
