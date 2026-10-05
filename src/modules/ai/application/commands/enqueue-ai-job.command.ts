// src/modules/ai/application/commands/enqueue-ai-job.command.ts
import type { AiJobType } from '../dtos/ai-jobs.dto';

export class EnqueueAiJobCommand {
  constructor(
    public readonly userId: string,
    public readonly type: AiJobType,
    public readonly projectId: string,
    public readonly prompt?: string,
    public readonly count?: number,
  ) {}
}
