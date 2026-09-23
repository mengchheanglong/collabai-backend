// src/modules/comments/application/dtos/add-comment.dto.ts
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class AddCommentDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Client-assigned UUID for offline comment sync',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({
    example: 'I started working on this. cc @alice@example.com',
    minLength: 1,
    maxLength: 3000,
  })
  @Trim()
  @SanitizeHtml()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 1, maxLength: 3000 })
  body: string;
}
