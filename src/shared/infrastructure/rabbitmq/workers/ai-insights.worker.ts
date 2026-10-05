// src/shared/infrastructure/rabbitmq/workers/ai-insights.worker.ts
//
// Consumes `collabai.ai.jobs` (ai.project-insights, ai.generate-tasks) queued by
// POST /ai/jobs, runs the same CQRS command as the synchronous endpoint, and emits
// `ai.job.completed` / `ai.job.failed` (EventsGateway → the requester's `user:{id}` room).
// AI calls are expensive and their failures are usually not transient, so a failed job is
// reported to the user instead of being retried. Registered by AiModule.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RabbitMQService } from '../rabbitmq.service';
import { QUEUE, ROUTING_KEY } from '../rabbitmq.constants';
import { GenerateProjectInsightsCommand } from '../../../../modules/ai/application/commands/generate-project-insights.command';
import { GenerateTasksCommand } from '../../../../modules/ai/application/commands/generate-tasks.command';
import type { AiJobType } from '../../../../modules/ai/application/dtos/ai-jobs.dto';

export interface AiJob {
  jobId: string;
  type: AiJobType;
  userId: string;
  projectId: string;
  prompt?: string;
  count?: number;
  requestedAt: string;
}

@Injectable()
export class AiInsightsWorker implements OnModuleInit {
  private readonly logger = new Logger(AiInsightsWorker.name);

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly commandBus: CommandBus,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.rabbitmq.consume(QUEUE.AI_JOBS, (payload) =>
      this.handle(payload as AiJob),
    );
  }

  async handle(job: AiJob): Promise<void> {
    const base = {
      jobId: job.jobId,
      type: job.type,
      userId: job.userId,
      projectId: job.projectId,
    };
    try {
      const result: unknown = await this.commandBus.execute(
        this.toCommand(job),
      );
      this.events.emit('ai.job.completed', { ...base, result });
    } catch (err) {
      const message = (err as Error).message || 'AI job failed';
      this.logger.warn(`AI job ${job.jobId} (${job.type}) failed: ${message}`);
      this.events.emit('ai.job.failed', { ...base, error: message });
    }
  }

  private toCommand(job: AiJob) {
    switch (job.type) {
      case 'project-insights':
        return new GenerateProjectInsightsCommand(job.userId, job.projectId);
      case 'generate-tasks':
        return new GenerateTasksCommand(
          job.userId,
          job.projectId,
          job.prompt ?? '',
          job.count ?? 5,
        );
      default:
        throw new Error(`Unknown AI job type "${String(job.type)}"`);
    }
  }
}

export const AI_JOB_ROUTING_KEY: Record<AiJobType, string> = {
  'project-insights': ROUTING_KEY.AI_PROJECT_INSIGHTS,
  'generate-tasks': ROUTING_KEY.AI_GENERATE_TASKS,
};
