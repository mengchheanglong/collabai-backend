// src/modules/ai/application/dtos/ai.dto.ts
// Request DTOs for the AI endpoints.
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  ArrayUnique,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DescriptionMode } from '../../domain/services/ai-provider.interface';
import {
  IsTrimmedNotEmpty,
  SanitizeHtml,
  SanitizePrompt,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class SuggestSubtasksDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ example: 'Build login page' })
  @SanitizePrompt()
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 2, maxLength: 200 })
  title: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @SanitizePrompt()
  @SanitizeHtml()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ minimum: 3, maximum: 10, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(10)
  count?: number;
}

export class GenerateDescriptionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ example: 'Build login page' })
  @SanitizePrompt()
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 2, maxLength: 200 })
  title: string;

  @ApiProperty({
    enum: ['generate', 'improve', 'shorten'],
    default: 'generate',
  })
  @IsIn(['generate', 'improve', 'shorten'])
  mode: DescriptionMode;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @SanitizePrompt()
  @SanitizeHtml()
  @IsString()
  @MaxLength(5000)
  currentDescription?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @SanitizePrompt()
  @SanitizeHtml()
  @IsString()
  @MaxLength(5000)
  description?: string;
}

export class SummarizeCommentsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  taskId: string;
}

export class SearchTasksDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ example: 'frontend tasks due this week that are not done' })
  @SanitizePrompt()
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 2, maxLength: 300 })
  query: string;
}

export class GenerateTasksDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ example: 'Create 10 experimental tasks for psychology study' })
  @SanitizePrompt()
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 2, maxLength: 5000 })
  prompt: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 15, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(15)
  count?: number;
}

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty({ maxLength: 5000 })
  @SanitizePrompt()
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 1, maxLength: 5000 })
  content: string;
}

export class ChatDto {
  @ApiProperty({ example: 'What tasks do we need to finish this sprint?' })
  @SanitizePrompt()
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 1, maxLength: 5000 })
  message: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ type: () => [ChatMessageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
}

export class ProjectInsightsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId: string;
}

export class ProposeTaskActionsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ maxLength: 1200, example: 'Move overdue high priority work to in progress' })
  @IsString()
  @MinLength(3)
  @MaxLength(1200)
  request: string;
}

export class ApplyTaskActionPlanDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 5, format: 'uuid' })
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  actionIds: string[];
}
