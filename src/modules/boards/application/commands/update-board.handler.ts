import { toBoardResponse } from '../dtos/board-response.dto';
import { WorkspaceChangedEvent } from '../../../../shared/events/workspace-changed.event';
import { EventEmitter2 } from '@nestjs/event-emitter';
// src/modules/boards/application/commands/update-board.handler.ts
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateBoardCommand } from './update-board.command';
import {
  BOARD_REPOSITORY,
  type BoardView,
} from '../../domain/repositories/board.repository.interface';
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

@CommandHandler(UpdateBoardCommand)
export class UpdateBoardHandler implements ICommandHandler<UpdateBoardCommand> {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boardRepo: IBoardRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: IProjectRepository,
    private readonly events: EventEmitter2 = new EventEmitter2(),
  ) {}

  async execute(command: UpdateBoardCommand): Promise<BoardView> {
    const board = await this.boardRepo.findById(command.boardId);
    if (!board) throw new BoardNotFoundError();

    const membership = await this.projectRepo.findMembership(
      board.projectId,
      command.userId,
    );
    if (!membership || !ProjectRoles.canEditProject(membership.role)) {
      throw new BoardForbiddenError();
    }

    board.applyUpdate(command.patch);
    await this.boardRepo.update(board);

    const view = await this.boardRepo.findViewById(board.id);
    this.events.emit(WorkspaceChangedEvent.eventName, new WorkspaceChangedEvent('board:updated', board.projectId, command.userId, { board: toBoardResponse(view!) }));
    return view!;
  }
}
