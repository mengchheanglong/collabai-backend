import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class PresignUploadDto {
  @ApiProperty({ enum: ['avatar', 'attachment'] })
  @IsIn(['avatar', 'attachment'])
  kind: 'avatar' | 'attachment';

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fileName: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @MaxLength(100)
  contentType: string;

  @ApiProperty({ minimum: 1, maximum: 26214400 })
  @IsInt()
  @Min(1)
  @Max(26214400)
  contentLength: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for project attachments' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class PresignDownloadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ maxLength: 512 })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  key: string;
}
