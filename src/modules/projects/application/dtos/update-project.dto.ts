// src/modules/projects/application/dtos/update-project.dto.ts
// Every field optional — a partial metadata update. At least one should be provided.
import { IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class UpdateProjectDto {
  @ApiPropertyOptional({
    example: 'Renamed Project',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 2, maxLength: 100 })
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description', maxLength: 500 })
  @IsOptional()
  @SanitizeHtml()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '#0F766E' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: '🚀' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;
}
