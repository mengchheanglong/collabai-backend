import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    example: '123456',
    pattern: '^\\d{6}$',
    description: '6-digit verification code emailed on registration.',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description:
      'Optional email fallback if registration_verification cookie is absent.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
