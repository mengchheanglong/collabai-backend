// src/modules/tasks/application/dtos/create-task.dto.ts
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TASK_STATUSES } from '../../domain/value-objects/task-status.value-object';
import { TASK_PRIORITIES } from '../../domain/value-objects/task-priority.value-object';
import {
  IsSafeDate,
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class CreateTaskDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Client-assigned UUID for offline mutation sync',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  boardId?: string;

  @ApiProperty({ example: 'Build login page', minLength: 2, maxLength: 150 })
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 2, maxLength: 150 })
  title: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @SanitizeHtml()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: TASK_STATUSES, default: 'todo' })
  @IsOptional()
  @IsIn(TASK_STATUSES as readonly string[])
  status?: (typeof TASK_STATUSES)[number];

  @ApiPropertyOptional({ enum: TASK_PRIORITIES, default: 'medium' })
  @IsOptional()
  @IsIn(TASK_PRIORITIES as readonly string[])
  priority?: (typeof TASK_PRIORITIES)[number];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsISO8601()
  @IsSafeDate()
  dueDate?: string;

  @ApiPropertyOptional({ type: [String], example: ['frontend', 'auth'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  labels?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['Write unit tests', 'Code review'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  subtasks?: string[];
}
