import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../shared/services/prisma.service';
class ActivityQuery {
 @Type(() => Number) @IsInt() @Min(1) page = 1;
 @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 30;
}
@Controller('projects/:projectId/activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
 constructor(private readonly db: PrismaService) {}
 @Get()
 async list(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser('id') userId: string, @Query() query: ActivityQuery) {
  if (!await this.db.projectMember.findFirst({ where: { projectId, userId, isActive: true, project: { deletedAt: null } } })) throw new NotFoundException('Project not found');
  const [rows, total] = await this.db.$transaction([
   this.db.activity.findMany({ where: { projectId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.limit, take: query.limit, include: { user: { select: { id: true, name: true, email: true } } } }),
   this.db.activity.count({ where: { projectId } }),
  ]);
  return { items: rows.map(row => ({ id: row.id, projectId, actorId: row.userId, actor: row.user, type: `${row.entityType}.${row.action}`, entityType: row.entityType, entityId: row.entityId, message: row.entityType === 'ai' && row.action === 'approved_plan_applied' ? `${row.user.name} approved and applied an AI task plan` : `${row.user.name} ${row.action} a ${row.entityType}`, ...(row.entityType === 'ai' && row.action === 'approved_plan_applied' ? { details: { previous: JSON.parse(row.oldValue ?? '[]'), applied: JSON.parse(row.newValue ?? '[]') } } : {}), createdAt: row.createdAt.toISOString() })), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
 }
}
