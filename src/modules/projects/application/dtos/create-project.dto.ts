// src/modules/projects/application/dtos/create-project.dto.ts
import { IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Final Year Project', minLength: 2, maxLength: 100 })
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 2, maxLength: 100 })
  name: string;

  @ApiPropertyOptional({ example: 'Build the CollabAI MVP', maxLength: 500 })
  @IsOptional()
  @SanitizeHtml()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '#6750A4' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: '📋' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;
}
