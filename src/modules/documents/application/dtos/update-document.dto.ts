// src/modules/documents/application/dtos/update-document.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import {
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

import { DocumentAttachmentDto } from './create-document.dto';

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

  @ApiPropertyOptional({
    description: 'Attached files (e.g. PDF, Word, Markdown, etc.)',
    type: [DocumentAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentAttachmentDto)
  attachments?: DocumentAttachmentDto[];

  @ApiPropertyOptional({ description: 'File type format (e.g. pdf, docx, doc, md, etc.)' })
  @IsOptional()
  @IsString()
  fileType?: string;

  @ApiPropertyOptional({ description: 'Expected document version for optimistic concurrency control' })
  @IsOptional()
  @IsInt()
  version?: number;
}
