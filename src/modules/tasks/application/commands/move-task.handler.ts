// src/modules/tasks/application/commands/move-task.handler.ts
// Move a task to a status column at a position. Omitted position appends to the end.
// Keeps completedAt in sync via TaskEntity.move(). Writer role required.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MoveTaskCommand } from './move-task.command';
import {
  type ITaskRepository,
  TASK_REPOSITORY,
  TaskView,
} from '../../domain/repositories/task.repository.interface';
import { TaskAccessService } from '../services/task-access.service';
import { TaskDomainService } from '../../domain/services/task.domain.service';
import { TaskMovedEvent } from '../../domain/events/task-moved.event';
import { TaskNotFoundError } from '../errors/task.errors';

@CommandHandler(MoveTaskCommand)
export class MoveTaskHandler implements ICommandHandler<MoveTaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly access: TaskAccessService,
    private readonly domain: TaskDomainService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: MoveTaskCommand): Promise<TaskView> {
    const task = await this.repo.findById(command.taskId);
    if (!task) throw new TaskNotFoundError();
    await this.access.requireWriter(task.projectId, command.actingUserId);

    const fromStatus = task.status;
    const position =
      command.position ??
      this.domain.nextPosition(
        await this.repo.maxPosition(task.projectId, command.status),
      );

    task.move(command.status, position);
    await this.repo.update(task);

    this.events.emit(
      TaskMovedEvent.eventName,
      new TaskMovedEvent(
        task.id,
        task.projectId,
        command.actingUserId,
        fromStatus,
        task.status,
        task.position,
      ),
    );

    const view = await this.repo.findViewById(task.id);
    if (!view) throw new TaskNotFoundError();
    return view;
  }
}
