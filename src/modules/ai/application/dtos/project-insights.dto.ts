// src/modules/ai/application/dtos/project-insights.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ProjectInsightsDto {
  @ApiProperty({
    description: 'Target project UUID',
    example: '11111111-1111-4111-a111-111111111111',
  })
  @IsUUID('4')
  projectId!: string;
}
