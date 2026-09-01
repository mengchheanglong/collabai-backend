// src/modules/boards/application/commands/delete-board.handler.ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteBoardCommand } from './delete-board.command';
import { BOARD_REPOSITORY } from '../../domain/repositories/board.repository.interface';
import {
  BoardNotFoundError,
  BoardForbiddenError,
} from '../errors/board.errors';
import {
  PROJECT_REPOSITORY,
  type IProjectRepository,
} from '../../../projects/domain/repositories/project.repository.interface';
import { ProjectRoles } from '../../../projects/domain/value-objects/project-role.value-object';

import type { IBoardRepository } from '../../domain/repositories/board.repository.interface';

@CommandHandler(DeleteBoardCommand)
export class DeleteBoardHandler implements ICommandHandler<DeleteBoardCommand> {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boardRepo: IBoardRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: IProjectRepository,
  ) {}

  async execute(command: DeleteBoardCommand): Promise<void> {
    const board = await this.boardRepo.findById(command.boardId);
    if (!board) throw new BoardNotFoundError();

    const membership = await this.projectRepo.findMembership(
      board.projectId,
      command.userId,
    );
    if (!membership || !ProjectRoles.canEditProject(membership.role)) {
      throw new BoardForbiddenError();
    }

    await this.boardRepo.delete(board.id);
  }
}
