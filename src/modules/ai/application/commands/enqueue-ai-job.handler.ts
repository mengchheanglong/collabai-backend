// src/modules/ai/application/commands/enqueue-ai-job.handler.ts
//
// Validates membership up front (so the 403 is synchronous), then queues the job on
// `collabai.ai.jobs`. AiInsightsWorker runs it and notifies the requester over Socket.io.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import {
  EVENT_BUS,
  type IEventBus,
} from '../../../../shared/event-bus/event-bus.interface';
import {
  AI_JOB_ROUTING_KEY,
  type AiJob,
} from '../../../../shared/infrastructure/rabbitmq/workers/ai-insights.worker';
import { AiAccessService } from '../services/ai-access.service';
import { EnqueueAiJobCommand } from './enqueue-ai-job.command';

export interface EnqueuedAiJob {
  jobId: string;
  type: AiJob['type'];
  status: 'queued';
}

@CommandHandler(EnqueueAiJobCommand)
export class EnqueueAiJobHandler implements ICommandHandler<EnqueueAiJobCommand> {
  constructor(
    private readonly access: AiAccessService,
    @Inject(EVENT_BUS) private readonly bus: IEventBus,
  ) {}

  async execute(command: EnqueueAiJobCommand): Promise<EnqueuedAiJob> {
    await this.access.requireMember(command.projectId, command.userId);

    const job: AiJob = {
      jobId: uuidv4(),
      type: command.type,
      userId: command.userId,
      projectId: command.projectId,
      prompt: command.prompt,
      count: command.count,
      requestedAt: new Date().toISOString(),
    };
    await this.bus.publish(AI_JOB_ROUTING_KEY[command.type], job);

    return { jobId: job.jobId, type: job.type, status: 'queued' };
  }
}
