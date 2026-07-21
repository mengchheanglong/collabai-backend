// src/modules/projects/application/dtos/update-member-role.dto.ts
import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { ProjectRole } from '../../domain/value-objects/project-role.value-object';

const ASSIGNABLE_ROLES: ProjectRole[] = ['owner', 'admin', 'member', 'viewer'];

export class UpdateMemberRoleDto {
  @ApiProperty({ example: 'admin', enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role: ProjectRole;
}
