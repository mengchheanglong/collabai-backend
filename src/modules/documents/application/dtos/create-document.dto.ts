import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import {
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class DocumentAttachmentDto {
  @ApiProperty({ description: 'Unique identifier for attachment', example: 'att-123' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'File name', example: 'spec.pdf' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Data URL or base64 representation of attachment' })
  @IsOptional()
  @IsString()
  dataUrl?: string;

  @ApiPropertyOptional({ description: 'URL of the attachment' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'File size in bytes', example: 1024 })
  @IsOptional()
  @IsNumber()
  size?: number;

  @ApiPropertyOptional({ description: 'MIME type of the attachment', example: 'application/pdf' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'MIME type fallback' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ description: 'ISO date string when file was uploaded' })
  @IsOptional()
  @IsString()
  uploadedAt?: string;
}

export type DocumentAttachment = DocumentAttachmentDto;

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
}
