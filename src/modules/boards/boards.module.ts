// src/modules/boards/boards.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';

import { BOARD_REPOSITORY } from './domain/repositories/board.repository.interface';
import { BoardRepository } from './infrastructure/persistence/board.repository';

import { BoardsController } from './presentation/controllers/boards.controller';

import { CreateBoardHandler } from './application/commands/create-board.handler';
import { UpdateBoardHandler } from './application/commands/update-board.handler';
import { DeleteBoardHandler } from './application/commands/delete-board.handler';
import { GetBoardsHandler } from './application/queries/get-boards.handler';
import { GetBoardHandler } from './application/queries/get-board.handler';

const CommandHandlers = [
  CreateBoardHandler,
  UpdateBoardHandler,
  DeleteBoardHandler,
];

const QueryHandlers = [
  GetBoardsHandler,
  GetBoardHandler,
];

@Module({
  imports: [CqrsModule, SharedModule, AuthModule, ProjectsModule],
  controllers: [BoardsController],
  providers: [
    { provide: BOARD_REPOSITORY, useClass: BoardRepository },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [BOARD_REPOSITORY],
})
export class BoardsModule {}
