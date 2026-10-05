// src/modules/users/application/queries/search-users.handler.spec.ts

import { SearchUsersHandler } from './search-users.handler';
import { SearchUsersQuery } from './search-users.query';

describe('SearchUsersHandler', () => {
  let handler: SearchUsersHandler;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: jest.fn(),
      },
    };
    handler = new SearchUsersHandler(mockPrisma);
  });

  it('returns empty array if search term is less than 2 characters', async () => {
    const res = await handler.execute(new SearchUsersQuery('a', 10));
    expect(res).toEqual([]);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it('searches users by name or email with case-insensitive matching', async () => {
    const dbRows = [
      { id: 'u1', name: 'John Doe', email: 'john@example.com', avatarUrl: 'http://avatar.png' },
      { id: 'u2', name: 'Johnny', email: 'johnny@test.com', avatarUrl: null },
    ];
    mockPrisma.user.findMany.mockResolvedValueOnce(dbRows);

    const res = await handler.execute(new SearchUsersQuery('john', 10));

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { name: { contains: 'john', mode: 'insensitive' } },
          { email: { contains: 'john', mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: 'asc' },
      take: 10,
    });

    expect(res).toEqual([
      { id: 'u1', name: 'John Doe', email: 'john@example.com', avatarUrl: 'http://avatar.png' },
      { id: 'u2', name: 'Johnny', email: 'johnny@test.com', avatarUrl: null },
    ]);
  });
});
