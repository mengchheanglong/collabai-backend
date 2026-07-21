// src/modules/tasks/application/dtos/move-task.dto.ts
import { IsIn, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TASK_STATUSES } from '../../domain/value-objects/task-status.value-object';

export class MoveTaskDto {
  @ApiProperty({ enum: TASK_STATUSES })
  @IsIn(TASK_STATUSES as readonly string[])
  status: (typeof TASK_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Target position within the column. Omit to append to the end.',
    example: 2000,
  })
  @IsOptional()
  @IsNumber()
  position?: number;
}
