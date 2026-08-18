// src/modules/boards/application/commands/create-board.handler.ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { CreateBoardCommand } from './create-board.command';
import {
  BOARD_REPOSITORY,
  type BoardView,
} from '../../domain/repositories/board.repository.interface';
import { BoardEntity } from '../../domain/entities/board.entity';
import {
  DuplicateBoardNameError,
  BoardForbiddenError,
} from '../errors/board.errors';
import {
  PROJECT_REPOSITORY,
  type IProjectRepository,
} from '../../../projects/domain/repositories/project.repository.interface';
import { ProjectRoles } from '../../../projects/domain/value-objects/project-role.value-object';

import type { IBoardRepository } from '../../domain/repositories/board.repository.interface';

@CommandHandler(CreateBoardCommand)
export class CreateBoardHandler implements ICommandHandler<CreateBoardCommand> {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boardRepo: IBoardRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: IProjectRepository,
  ) {}

  async execute(command: CreateBoardCommand): Promise<BoardView> {
    const membership = await this.projectRepo.findMembership(
      command.projectId,
      command.userId,
    );
    if (!membership || !ProjectRoles.canEditProject(membership.role)) {
      throw new BoardForbiddenError();
    }

    const name = command.name.trim();
    // In a real app we might want to check for duplicate board names within the project
    // but for now we'll just allow it unless explicitly specified otherwise.

    const board = BoardEntity.create({
      id: uuidv4(),
      projectId: command.projectId,
      name,
      description: command.description,
    });

    await this.boardRepo.create(board);

    const view = await this.boardRepo.findViewById(board.id);
    return view!;
  }
}
