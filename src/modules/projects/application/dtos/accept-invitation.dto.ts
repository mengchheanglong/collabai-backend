import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'One-time invitation token from the email link' })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token: string;
}
