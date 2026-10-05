// src/modules/ai/application/dtos/automation-proposals.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ProposeTaskActionsDto {
  @ApiProperty({ description: 'ID of the project containing the tasks' })
  @IsUUID('4')
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    description: 'Natural language batch task change request',
    example: 'Reassign overdue tasks to Sarah and set priority urgent',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  request: string;
}

export class ApplyTaskActionsDto {
  @ApiPropertyOptional({
    description: 'Optional subset of action IDs to approve and apply',
    example: ['action-1', 'action-2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionIds?: string[];
}
