// src/modules/auth/application/dtos/request-password-reset.dto.ts
import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '../../../../common/decorators/sanitizers.decorator';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'jane@example.com', format: 'email' })
  @NormalizeEmail()
  @IsEmail()
  email: string;
}
