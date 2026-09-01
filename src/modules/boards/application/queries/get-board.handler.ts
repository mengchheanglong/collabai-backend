// src/modules/boards/application/queries/get-board.handler.ts
import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetBoardQuery } from './get-board.query';
import {
  BOARD_REPOSITORY,
  type BoardView,
  type BoardWithTasksView,
} from '../../domain/repositories/board.repository.interface';
import {
  PROJECT_REPOSITORY,
  type IProjectRepository,
} from '../../../projects/domain/repositories/project.repository.interface';
import {
  BoardForbiddenError,
  BoardNotFoundError,
} from '../errors/board.errors';

import type { IBoardRepository } from '../../domain/repositories/board.repository.interface';

@QueryHandler(GetBoardQuery)
export class GetBoardHandler implements IQueryHandler<GetBoardQuery> {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boardRepo: IBoardRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: IProjectRepository,
  ) {}

  async execute(query: GetBoardQuery): Promise<BoardView | BoardWithTasksView> {
    const board = await this.boardRepo.findById(query.boardId);
    if (!board) throw new BoardNotFoundError();

    const membership = await this.projectRepo.findMembership(
      board.projectId,
      query.userId,
    );
    if (!membership) {
      throw new BoardForbiddenError();
    }

    if (query.includeTasks) {
      const view = await this.boardRepo.findViewWithTasks(query.boardId);
      if (!view) throw new BoardNotFoundError();
      return view;
    } else {
      const view = await this.boardRepo.findViewById(query.boardId);
      if (!view) throw new BoardNotFoundError();
      return view;
    }
  }
}
