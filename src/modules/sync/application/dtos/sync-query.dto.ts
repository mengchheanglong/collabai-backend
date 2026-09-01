// src/modules/sync/application/dtos/sync-query.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class SyncQueryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Target project UUID to calculate sync delta for',
  })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({
    format: 'date-time',
    example: '2026-08-30T12:00:00.000Z',
    description:
      'Timestamp of client’s last local snapshot. If omitted, returns current state.',
  })
  @IsOptional()
  @IsISO8601()
  since?: string;
}
