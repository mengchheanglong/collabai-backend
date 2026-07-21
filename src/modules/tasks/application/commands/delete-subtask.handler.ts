// src/modules/tasks/application/commands/delete-subtask.handler.ts
// Remove a subtask from a task. Writer role required.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteSubtaskCommand } from './delete-subtask.command';
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

@CommandHandler(DeleteSubtaskCommand)
export class DeleteSubtaskHandler
  implements ICommandHandler<DeleteSubtaskCommand>
{
  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly access: TaskAccessService,
  ) {}

  async execute(command: DeleteSubtaskCommand): Promise<TaskView> {
    const task = await this.repo.findById(command.taskId);
    if (!task) throw new TaskNotFoundError();
    await this.access.requireWriter(task.projectId, command.actingUserId);

    const subtask = await this.repo.findSubtask(command.subtaskId);
    if (!subtask || subtask.taskId !== task.id) {
      throw new SubtaskNotFoundError();
    }
    await this.repo.deleteSubtask(subtask.id);

    const view = await this.repo.findViewById(task.id);
    if (!view) throw new TaskNotFoundError();
    return view;
  }
}
