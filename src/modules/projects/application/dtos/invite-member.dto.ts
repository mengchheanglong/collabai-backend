// src/modules/projects/application/dtos/invite-member.dto.ts
import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectRole } from '../../domain/value-objects/project-role.value-object';

// Owner cannot be assigned via invite — a project has exactly one owner (its creator).
const ASSIGNABLE_ROLES: ProjectRole[] = ['admin', 'member', 'viewer'];

export class InviteMemberDto {
  @ApiProperty({ example: 'sophea@example.com', format: 'email' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: 'member',
    enum: ASSIGNABLE_ROLES,
    default: 'member',
  })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: Exclude<ProjectRole, 'owner'>;
}
