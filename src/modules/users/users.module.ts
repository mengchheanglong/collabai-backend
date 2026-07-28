// src/modules/users/users.module.ts
//
// Minimal users module exposing user search. SharedModule supplies PrismaService; AuthModule
// supplies the TokenBlacklistService that JwtAuthGuard depends on.

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './presentation/controllers/users.controller';
import { SearchUsersHandler } from './application/queries/search-users.handler';

@Module({
  imports: [CqrsModule, SharedModule, AuthModule],
  controllers: [UsersController],
  providers: [SearchUsersHandler],
})
export class UsersModule {}
