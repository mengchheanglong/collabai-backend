// src/modules/users/presentation/controllers/users.controller.spec.ts

import { UsersController } from './users.controller';
import { SearchUsersQuery } from '../../application/queries/search-users.query';

describe('UsersController', () => {
  let controller: UsersController;
  let mockQueryBus: any;

  beforeEach(() => {
    mockQueryBus = {
      execute: jest.fn(),
    };
    controller = new UsersController(mockQueryBus);
  });

  it('delegates search to SearchUsersQuery with capped limit', async () => {
    mockQueryBus.execute.mockResolvedValueOnce([
      { id: 'u1', name: 'Alice', email: 'alice@example.com', avatarUrl: null },
    ]);

    const res = await controller.search('alice', '15');

    expect(mockQueryBus.execute).toHaveBeenCalledWith(
      new SearchUsersQuery('alice', 15),
    );
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe('Alice');
  });

  it('defaults and clamps limit between 1 and 20', async () => {
    mockQueryBus.execute.mockResolvedValueOnce([]);

    await controller.search('alice', '100');
    expect(mockQueryBus.execute).toHaveBeenCalledWith(
      new SearchUsersQuery('alice', 20),
    );

    mockQueryBus.execute.mockResolvedValueOnce([]);
    await controller.search('alice', '0');
    expect(mockQueryBus.execute).toHaveBeenCalledWith(
      new SearchUsersQuery('alice', 10),
    );
  });
});
