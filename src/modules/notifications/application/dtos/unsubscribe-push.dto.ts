// src/modules/notifications/application/dtos/unsubscribe-push.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl } from 'class-validator';

export class UnsubscribePushDto {
  @ApiProperty({
    example: 'https://fcm.googleapis.com/fcm/send/dK5...',
    description: 'Unique push endpoint URL to unsubscribe',
  })
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  endpoint: string;
}
