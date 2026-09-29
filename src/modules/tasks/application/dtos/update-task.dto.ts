// src/modules/tasks/application/dtos/update-task.dto.ts
// All fields optional. `assigneeId: null` unassigns; omitting it leaves the assignee.
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TASK_PRIORITIES } from '../../domain/value-objects/task-priority.value-object';
import {
  IsSafeDate,
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class UpdateTaskDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 150 })
  @IsOptional()
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 2, maxLength: 150 })
  title?: string;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @SanitizeHtml()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES as readonly string[])
  priority?: (typeof TASK_PRIORITIES)[number];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  @IsSafeDate()
  dueDate?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  labels?: string[];
}
