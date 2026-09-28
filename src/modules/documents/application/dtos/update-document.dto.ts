// src/modules/documents/application/dtos/update-document.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDocumentDto {
  @ApiPropertyOptional({ description: 'Title of the document' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Markdown content of the document' })
  @IsString()
  @IsOptional()
  content?: string;
}
