// src/modules/tasks/application/commands/update-subtask.handler.ts
// Rename a subtask and/or toggle its done state. Writer role required. The subtask must
// belong to the given task.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateSubtaskCommand } from './update-subtask.command';
import {
  type ITaskRepository,
  TASK_REPOSITORY,
  TaskView,
} from '../../domain/repositories/task.repository.interface';
import { TaskAccessService } from '../services/task-access.service';
import {
  SubtaskNotFoundError,
  TaskNotFoundError,
} from '../errors/task.errors';

@CommandHandler(UpdateSubtaskCommand)
export class UpdateSubtaskHandler
  implements ICommandHandler<UpdateSubtaskCommand>
{
  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly access: TaskAccessService,
  ) {}

  async execute(command: UpdateSubtaskCommand): Promise<TaskView> {
    const task = await this.repo.findById(command.taskId);
    if (!task) throw new TaskNotFoundError();
    await this.access.requireWriter(task.projectId, command.actingUserId);

    const subtask = await this.repo.findSubtask(command.subtaskId);
    if (!subtask || subtask.taskId !== task.id) {
      throw new SubtaskNotFoundError();
    }

    if (command.title !== undefined) subtask.rename(command.title);
    if (command.done !== undefined) subtask.setDone(command.done);
    await this.repo.updateSubtask(subtask);

    const view = await this.repo.findViewById(task.id);
    if (!view) throw new TaskNotFoundError();
    return view;
  }
}
