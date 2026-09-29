// src/modules/documents/application/dtos/create-document.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import {
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class CreateDocumentDto {
  @ApiProperty({ description: 'Title of the document', example: 'Product Requirements Document' })
  @Trim()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 1, maxLength: 200 })
  title: string;

  @ApiPropertyOptional({ description: 'Markdown content of the document' })
  @IsOptional()
  @SanitizeHtml()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Attached files (e.g. PDF, Word, Markdown, etc.)' })
  @IsOptional()
  attachments?: any[];

  @ApiPropertyOptional({ description: 'File type format (e.g. pdf, docx, doc, md, etc.)' })
  @IsOptional()
  @IsString()
  fileType?: string;
}
