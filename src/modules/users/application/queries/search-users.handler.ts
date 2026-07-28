// src/modules/users/application/queries/search-users.handler.ts
// Search users by name or email (for inviting to projects). Case-insensitive, capped.
// Requires a term of at least 2 chars; returns [] otherwise.

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SearchUsersQuery } from './search-users.query';
import { PrismaService } from '../../../../shared/services/prisma.service';

export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

@QueryHandler(SearchUsersQuery)
export class SearchUsersHandler implements IQueryHandler<SearchUsersQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: SearchUsersQuery): Promise<UserSearchResult[]> {
    const term = query.term.trim();
    if (term.length < 2) return [];

    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: 'asc' },
      take: query.limit,
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      avatarUrl: r.avatarUrl ?? null,
    }));
  }
}
