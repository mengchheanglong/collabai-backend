import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../../shared/services/prisma.service';
import { EmailService } from '../../../shared/services/email.service';
import { ProjectRoles, ProjectRole } from '../domain/value-objects/project-role.value-object';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class ProjectInvitationsService {
  constructor(private readonly prisma: PrismaService, private readonly email: EmailService, private readonly config: ConfigService) {}

  private async assertManager(projectId: string, actorId: string, role?: string): Promise<void> {
    const member = await this.prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: actorId } } });
    if (!member || !ProjectRoles.canManageMembers(member.role as ProjectRole)) throw new ForbiddenException('Only project admins and owners can manage invitations');
    if (role === 'admin' && member.role !== 'owner') throw new ForbiddenException('Only an owner can grant the admin role');
  }

  async invite(projectId: string, actorId: string, email: string, role: string) {
    await this.assertManager(projectId, actorId, role);
    const normalized = email.trim().toLowerCase();
    const project = await this.prisma.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { name: true } });
    if (!project) throw new NotFoundException('Project not found');
    const user = await this.prisma.user.findUnique({ where: { email: normalized }, select: { id: true, name: true } });
    const duplicate = user ? await this.prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } } }) : await this.prisma.projectMember.findFirst({ where: { projectId, invitedEmail: normalized } });
    if (duplicate) throw new ConflictException('User already belongs to this project or has a pending invitation');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const inviter = await this.prisma.user.findUnique({ where: { id: actorId }, select: { name: true } });
    await this.prisma.projectMember.create({ data: { projectId, userId: user?.id ?? null, invitedEmail: user ? null : normalized, role, invitedBy: actorId, invitedAt: new Date(), invitationToken: user ? null : hashToken(token), invitationExpiresAt: user ? null : expiresAt, joinedAt: user ? new Date() : null } });
    const frontend = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
    await this.email.sendProjectInvitation(normalized, project.name, inviter?.name ?? 'A teammate', user ? `${frontend.replace(/\/$/, '')}/dashboard` : `${frontend.replace(/\/$/, '')}/accept-invite?token=${encodeURIComponent(token)}`, user ? undefined : expiresAt);
    return { email: normalized, role, pending: !user, expiresAt };
  }

  async list(projectId: string, actorId: string) {
    await this.assertManager(projectId, actorId);
    return this.prisma.projectMember.findMany({ where: { projectId, userId: null }, select: { id: true, invitedEmail: true, role: true, invitedAt: true, invitationExpiresAt: true }, orderBy: { invitedAt: 'desc' } });
  }

  async revoke(projectId: string, invitationId: string, actorId: string) {
    await this.assertManager(projectId, actorId);
    const item = await this.prisma.projectMember.findFirst({ where: { id: invitationId, projectId, userId: null } });
    if (!item) throw new NotFoundException('Invitation not found');
    await this.prisma.projectMember.delete({ where: { id: item.id } });
    return { revoked: true };
  }

  async resend(projectId: string, invitationId: string, actorId: string) {
    await this.assertManager(projectId, actorId);
    const item = await this.prisma.projectMember.findFirst({ where: { id: invitationId, projectId, userId: null } });
    if (!item?.invitedEmail) throw new NotFoundException('Invitation not found');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await this.prisma.projectMember.update({ where: { id: item.id }, data: { invitationToken: hashToken(token), invitationExpiresAt: expiresAt, invitedAt: new Date() } });
    const [project, inviter] = await Promise.all([this.prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }), this.prisma.user.findUnique({ where: { id: actorId }, select: { name: true } })]);
    const frontend = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
    await this.email.sendProjectInvitation(item.invitedEmail, project?.name ?? 'a project', inviter?.name ?? 'A teammate', `${frontend.replace(/\/$/, '')}/accept-invite?token=${encodeURIComponent(token)}`, expiresAt);
    return { resent: true, expiresAt };
  }

  async accept(token: string, userId: string) {
    const row = await this.prisma.projectMember.findUnique({ where: { invitationToken: hashToken(token) }, include: { user: { select: { email: true } } } });
    if (!row || row.userId !== null || !row.invitedEmail || !row.invitationExpiresAt || row.invitationExpiresAt <= new Date()) throw new UnauthorizedException('Invitation is invalid or expired');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user || user.email.toLowerCase() !== row.invitedEmail.toLowerCase()) throw new ForbiddenException('Sign in with the email address that was invited');
    const claimed = await this.prisma.projectMember.updateMany({ where: { id: row.id, userId: null, invitationToken: hashToken(token), invitationExpiresAt: { gt: new Date() } }, data: { userId, invitedEmail: null, joinedAt: new Date(), invitationToken: null, invitationExpiresAt: null } });
    if (claimed.count !== 1) throw new UnauthorizedException('Invitation is invalid or expired');
    return { projectId: row.projectId, role: row.role };
  }
}
