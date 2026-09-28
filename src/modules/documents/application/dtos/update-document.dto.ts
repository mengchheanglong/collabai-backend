// src/modules/documents/application/dtos/update-document.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';
import {
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class UpdateDocumentDto {
  @ApiPropertyOptional({ description: 'Title of the document' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 1, maxLength: 200 })
  title?: string;

  @ApiPropertyOptional({ description: 'Markdown content of the document' })
  @IsOptional()
  @SanitizeHtml()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Expected document version for optimistic concurrency control' })
  @IsOptional()
  @IsInt()
  version?: number;
}
