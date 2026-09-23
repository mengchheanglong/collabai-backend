// src/modules/comments/application/dtos/edit-comment.dto.ts
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsTrimmedNotEmpty,
  SanitizeHtml,
  Trim,
} from '../../../../common/decorators/sanitizers.decorator';

export class EditCommentDto {
  @ApiProperty({ example: 'Updated comment', minLength: 1, maxLength: 3000 })
  @Trim()
  @SanitizeHtml()
  @IsString()
  @IsTrimmedNotEmpty({ minLength: 1, maxLength: 3000 })
  body: string;
}
