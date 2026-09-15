// src/modules/tasks/application/dtos/subtask.dto.ts
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class AddSubtaskDto {
  @ApiProperty({ example: 'Create login form', minLength: 1, maxLength: 200 })
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 1, maxLength: 200 })
  title: string;
}

export class UpdateSubtaskDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 200 })
  @IsOptional()
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 1, maxLength: 200 })
  title?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
