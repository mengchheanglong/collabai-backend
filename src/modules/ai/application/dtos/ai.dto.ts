// src/modules/ai/application/dtos/ai.dto.ts
// Request DTOs for the AI endpoints.
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DescriptionMode } from '../../domain/services/ai-provider.interface';

export class SuggestSubtasksDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ example: 'Build login page' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
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
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    enum: ['generate', 'improve', 'shorten'],
    default: 'generate',
  })
  @IsIn(['generate', 'improve', 'shorten'])
  mode: DescriptionMode;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  currentDescription?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
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
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  query: string;
}

export class GenerateTasksDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ example: 'Create 10 experimental tasks for psychology study' })
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  prompt: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 15, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(15)
  count?: number;
}
