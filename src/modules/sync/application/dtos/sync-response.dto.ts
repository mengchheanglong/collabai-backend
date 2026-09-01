// src/modules/sync/application/dtos/sync-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class SyncDeltaTasksDto {
  @ApiProperty({ description: 'Tasks created or updated since checkpoint' })
  upserted: any[];

  @ApiProperty({
    type: [String],
    description: 'IDs of tasks deleted since checkpoint',
  })
  deletedIds: string[];
}

export class SyncDeltaCommentsDto {
  @ApiProperty({ description: 'Comments created or edited since checkpoint' })
  upserted: any[];

  @ApiProperty({
    type: [String],
    description: 'IDs of comments deleted since checkpoint',
  })
  deletedIds: string[];
}

export class SyncDeltaBoardsDto {
  @ApiProperty({ description: 'Boards created or updated since checkpoint' })
  upserted: any[];
}

export class SyncResponseDto {
  @ApiProperty({
    example: '2026-09-01T13:40:00.000Z',
    description: 'Server time to be stored by PWA client as next sync checkpoint',
  })
  serverTime: string;

  @ApiProperty({ type: SyncDeltaTasksDto })
  tasks: SyncDeltaTasksDto;

  @ApiProperty({ type: SyncDeltaCommentsDto })
  comments: SyncDeltaCommentsDto;

  @ApiProperty({ type: SyncDeltaBoardsDto })
  boards: SyncDeltaBoardsDto;
}
