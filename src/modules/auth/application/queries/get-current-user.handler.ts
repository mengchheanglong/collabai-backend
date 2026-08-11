// src/modules/auth/application/queries/get-current-user.handler.ts
// Returns the authenticated user's safe projection (for GET /auth/me).

import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCurrentUserQuery } from './get-current-user.query';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { SafeUser } from '../../domain/entities/safe-user.entity';
import { UserNotFoundError } from '../errors/auth.errors';

@QueryHandler(GetCurrentUserQuery)
export class GetCurrentUserHandler
  implements IQueryHandler<GetCurrentUserQuery>
{
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(query: GetCurrentUserQuery): Promise<SafeUser> {
    const user = await this.userRepo.findById(query.userId);
    if (!user) throw new UserNotFoundError();
    return user.toSafe();
  }
}
