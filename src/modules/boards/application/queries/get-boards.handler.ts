// src/modules/boards/application/queries/get-boards.handler.ts
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetBoardsQuery } from './get-boards.query';
import {
  BOARD_REPOSITORY,
  type BoardView,
} from '../../domain/repositories/board.repository.interface';
import { PROJECT_REPOSITORY, type IProjectRepository } from '../../../projects/domain/repositories/project.repository.interface';
import { BoardForbiddenError } from '../errors/board.errors';

import type { IBoardRepository } from '../../domain/repositories/board.repository.interface';

@QueryHandler(GetBoardsQuery)
export class GetBoardsHandler implements IQueryHandler<GetBoardsQuery> {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boardRepo: IBoardRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: IProjectRepository,
  ) {}

  async execute(query: GetBoardsQuery): Promise<BoardView[]> {
    const membership = await this.projectRepo.findMembership(
      query.projectId,
      query.userId,
    );
    if (!membership) {
      throw new BoardForbiddenError();
    }

    return this.boardRepo.listForProject(query.projectId);
  }
}
