// src/modules/auth/application/dtos/login.dto.ts
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '../../../../common/decorators/sanitizers.decorator';

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com', format: 'email' })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'S3curePass' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
