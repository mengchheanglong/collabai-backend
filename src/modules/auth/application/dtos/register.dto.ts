// src/modules/auth/application/dtos/register.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'jane@example.com', format: 'email' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'S3curePass',
    minLength: 8,
    maxLength: 72,
    description: 'Min 8 chars, must include upper, lower and a number.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt truncates beyond 72 bytes
  password: string;

  @ApiProperty({ example: 'Jane Doe', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
