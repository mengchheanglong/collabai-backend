// src/modules/tasks/application/commands/delete-task.handler.ts
// Delete a task (Prisma cascade removes its subtasks, comments, label links). Writer role.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteTaskCommand } from './delete-task.command';
import {
  type ITaskRepository,
  TASK_REPOSITORY,
} from '../../domain/repositories/task.repository.interface';
import { TaskAccessService } from '../services/task-access.service';
import { TaskNotFoundError } from '../errors/task.errors';

@CommandHandler(DeleteTaskCommand)
export class DeleteTaskHandler implements ICommandHandler<DeleteTaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly access: TaskAccessService,
  ) {}

  async execute(command: DeleteTaskCommand): Promise<void> {
    const task = await this.repo.findById(command.taskId);
    if (!task) throw new TaskNotFoundError();
    await this.access.requireWriter(task.projectId, command.actingUserId);
    await this.repo.delete(task.id);
  }
}
