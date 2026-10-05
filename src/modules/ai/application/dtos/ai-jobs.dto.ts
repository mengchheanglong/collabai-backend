// src/modules/ai/application/dtos/ai-jobs.dto.ts
//
// POST /ai/jobs — queue a long-running AI job on `collabai.ai.jobs`. The result is pushed to
// the caller's socket room as `ai:job:completed` / `ai:job:failed`.

import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsTrimmedNotEmpty,
  SanitizePrompt,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export const AI_JOB_TYPES = ['project-insights', 'generate-tasks'] as const;
export type AiJobType = (typeof AI_JOB_TYPES)[number];

export class CreateAiJobDto {
  @ApiProperty({ enum: AI_JOB_TYPES })
  @IsIn(AI_JOB_TYPES)
  type!: AiJobType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({ description: 'Required for generate-tasks' })
  @ValidateIf((o: CreateAiJobDto) => o.type === 'generate-tasks')
  @SanitizePrompt()
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 2, maxLength: 5000 })
  prompt?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 15, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(15)
  count?: number;
}
