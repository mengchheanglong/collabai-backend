// src/modules/comments/application/dtos/edit-comment.dto.ts
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EditCommentDto {
  @ApiProperty({ example: 'Updated comment', minLength: 1, maxLength: 3000 })
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  body: string;
}
