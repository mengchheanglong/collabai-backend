import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PresignDownloadDto, PresignUploadDto } from '../application/dtos/presign-upload.dto';
import { UploadsService } from '../application/uploads.service';

@ApiTags('Uploads')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Create a short-lived S3 upload URL for an avatar or attachment' })
  presign(@CurrentUser('id') userId: string, @Body() dto: PresignUploadDto) {
    return this.uploads.presign(userId, dto);
  }

  @Post('download')
  @ApiOperation({ summary: 'Create a short-lived download URL for a project attachment' })
  download(@CurrentUser('id') userId: string, @Body() dto: PresignDownloadDto) {
    return this.uploads.presignDownload(userId, dto);
  }
}
