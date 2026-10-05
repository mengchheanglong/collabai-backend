// src/modules/documents/application/dtos/create-document.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import {
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export interface DocumentAttachment {
  id: string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
}

export class CreateDocumentDto {
  @ApiPropertyOptional({ description: 'Title of the document (optional; defaults to uploaded filename)', example: 'Product Requirements Document' })
  @IsOptional()
  @Trim()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Markdown content of the document' })
  @IsOptional()
  @SanitizeHtml()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Attached files (e.g. PDF, Word, Markdown, etc.)' })
  @IsOptional()
  attachments?: DocumentAttachment[];

  @ApiPropertyOptional({ description: 'File type format (e.g. pdf, docx, doc, md, etc.)' })
  @IsOptional()
  @IsString()
  fileType?: string;
}
