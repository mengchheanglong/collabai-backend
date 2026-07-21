// src/modules/comments/application/dtos/add-comment.dto.ts
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddCommentDto {
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
