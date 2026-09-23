// src/modules/boards/application/dtos/create-board.dto.ts
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class CreateBoardDto {
  @ApiProperty({ example: 'Sprint 1', minLength: 2, maxLength: 100 })
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 2, maxLength: 100 })
  name: string;

  @ApiPropertyOptional({ example: 'First sprint board', maxLength: 500 })
  @IsOptional()
  @SanitizeHtml()
  @IsString()
  @MaxLength(500)
  description?: string;
}
