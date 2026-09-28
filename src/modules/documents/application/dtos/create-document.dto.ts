// src/modules/documents/application/dtos/create-document.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ description: 'Title of the document', example: 'Product Requirements Document' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Markdown content of the document' })
  @IsString()
  @IsOptional()
  content?: string;
}
