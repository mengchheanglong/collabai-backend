import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { PROJECT_REPOSITORY } from '../../projects/domain/repositories/project.repository.interface';
import type { IProjectRepository } from '../../projects/domain/repositories/project.repository.interface';
import { PresignDownloadDto, PresignUploadDto } from './dtos/presign-upload.dto';

const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ATTACHMENT_TYPES = new Set(['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'application/zip', 'application/octet-stream']);

@Injectable()
export class UploadsService {
  private readonly client: S3Client;

  constructor(
    private readonly config: ConfigService,
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
  ) {
    const endpoint = config.get<string>('S3_ENDPOINT');
    this.client = new S3Client({
      region: config.get<string>('AWS_REGION') ?? 'us-east-1',
      requestChecksumCalculation: 'WHEN_REQUIRED',
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }

  async presign(userId: string, dto: PresignUploadDto) {
    const bucket = this.config.get<string>('S3_BUCKET');
    if (!bucket) throw new ServiceUnavailableException('File uploads are not configured');
    const allowed = dto.kind === 'avatar' ? AVATAR_TYPES : ATTACHMENT_TYPES;
    const maxSize = dto.kind === 'avatar' ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
    if (!allowed.has(dto.contentType.toLowerCase())) throw new BadRequestException('Unsupported file type');
    if (dto.contentLength > maxSize) throw new BadRequestException(`File exceeds the ${Math.floor(maxSize / (1024 * 1024))} MB limit`);
    if (dto.kind === 'attachment') {
      if (!dto.projectId) throw new BadRequestException('projectId is required for attachments');
      if (!await this.projects.findMembership(dto.projectId, userId)) throw new BadRequestException('Project not found');
    }

    const extension = dto.fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    const key = dto.kind === 'avatar'
      ? `avatars/${userId}/${randomUUID()}.${extension}`
      : `projects/${dto.projectId}/attachments/${randomUUID()}.${extension}`;
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: dto.contentType, ContentLength: dto.contentLength });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 300 });
    const publicBase = this.config.get<string>('S3_PUBLIC_BASE_URL')?.replace(/\/$/, '');
    const region = this.config.get<string>('AWS_REGION') ?? 'us-east-1';
    const objectUrl = publicBase ? `${publicBase}/${key}` : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    return { uploadUrl, key, objectUrl, expiresIn: 300, requiredHeaders: { 'Content-Type': dto.contentType } };
  }

  async presignDownload(userId: string, dto: PresignDownloadDto) {
    const bucket = this.config.get<string>('S3_BUCKET');
    if (!bucket) throw new ServiceUnavailableException('File uploads are not configured');
    if (!dto.key.startsWith(`projects/${dto.projectId}/attachments/`)) throw new BadRequestException('Invalid attachment key');
    if (!await this.projects.findMembership(dto.projectId, userId)) throw new BadRequestException('Project not found');
    const url = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: bucket, Key: dto.key }), { expiresIn: 300 });
    return { url, expiresIn: 300 };
  }
}
