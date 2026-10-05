// src/shared/infrastructure/rabbitmq/workers/activity-log.worker.ts
//
// Consumes `collabai.activity` (activity.*) jobs queued by ActivityEventsListener, writes the
// Activity row (with its human-readable message) and emits `activity.created`, which
// EventsGateway broadcasts as `activity:created`. Registered by ActivityModule.
//
// Idempotent: the Activity id comes from the job, so a redelivered job is skipped. A job
// whose project or actor no longer exists is dropped instead of being retried.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../services/prisma.service';
import { RabbitMQService } from '../rabbitmq.service';
import { QUEUE } from '../rabbitmq.constants';
import {
  ActivityLogJob,
  buildActivityMessage,
} from '../../../../modules/activity/domain/activity-message';
import {
  ACTIVITY_INCLUDE,
  toActivityResponse,
} from '../../../../modules/activity/application/dtos/activity-response.dto';

@Injectable()
export class ActivityLogWorker implements OnModuleInit {
  private readonly logger = new Logger(ActivityLogWorker.name);

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.rabbitmq.consume(QUEUE.ACTIVITY, (payload) =>
      this.handle(payload as ActivityLogJob),
    );
  }

  async handle(job: ActivityLogJob): Promise<void> {
    const actor = await this.prisma.user.findUnique({
      where: { id: job.actorId },
      select: { name: true },
    });
    const subject = job.subject ?? (await this.taskTitle(job.subjectTaskId));
    const message = buildActivityMessage({
      actorName: actor?.name ?? 'Someone',
      entityType: job.entityType,
      action: job.action,
      subject,
      oldValue: job.oldValue,
      newValue: job.newValue,
    });

    let row;
    try {
      row = await this.prisma.activity.create({
        data: {
          id: job.id,
          projectId: job.projectId,
          userId: job.actorId,
          entityType: job.entityType,
          entityId: job.entityId ?? null,
          action: job.action,
          oldValue: job.oldValue ?? null,
          newValue: job.newValue ?? subject ?? null,
          message,
        },
        include: ACTIVITY_INCLUDE,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') return; // already persisted (redelivery)
        if (err.code === 'P2003') {
          this.logger.warn(
            `Dropping activity ${job.id}: project ${job.projectId} or actor ${job.actorId} no longer exists`,
          );
          return;
        }
      }
      throw err; // transient — let the bus retry / dead-letter
    }

    this.events.emit('activity.created', {
      projectId: row.projectId,
      actorId: row.userId,
      activity: toActivityResponse(row),
    });
  }

  private async taskTitle(
    taskId: string | undefined,
  ): Promise<string | undefined> {
    if (!taskId) return undefined;
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true },
    });
    return task?.title;
  }
}
