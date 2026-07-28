// src/modules/users/presentation/controllers/users.controller.ts
//
// GET /users/search?q=&limit= — find users by name/email to invite to projects.
// Requires a valid access token. Returns [{ _id, name, email, avatarUrl }] (via the
// global envelope: { success, data: [...] }).

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { SearchUsersQuery } from '../../application/queries/search-users.query';
import { UserSearchResult } from '../../application/queries/search-users.handler';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('search')
  @ApiOperation({ summary: 'Search users by name or email' })
  async search(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): Promise<UserSearchResult[]> {
    const capped = Math.min(20, Math.max(1, toInt(limit, 10)));
    return this.queryBus.execute(new SearchUsersQuery(q ?? '', capped));
  }
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
