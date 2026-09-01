// src/modules/comments/application/dtos/add-comment.dto.ts
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  body: string;
}

