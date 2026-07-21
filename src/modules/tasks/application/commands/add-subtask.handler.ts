// src/modules/tasks/application/commands/add-subtask.handler.ts
// Append a subtask to a task. Writer role required.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { AddSubtaskCommand } from './add-subtask.command';
import {
  type ITaskRepository,
  TASK_REPOSITORY,
  TaskView,
} from '../../domain/repositories/task.repository.interface';
import { SubtaskEntity } from '../../domain/entities/subtask.entity';
import { TaskAccessService } from '../services/task-access.service';
import { TaskNotFoundError } from '../errors/task.errors';

@CommandHandler(AddSubtaskCommand)
export class AddSubtaskHandler implements ICommandHandler<AddSubtaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly access: TaskAccessService,
  ) {}

  async execute(command: AddSubtaskCommand): Promise<TaskView> {
    const task = await this.repo.findById(command.taskId);
    if (!task) throw new TaskNotFoundError();
    await this.access.requireWriter(task.projectId, command.actingUserId);

    const maxOrder = await this.repo.maxSubtaskOrder(task.id);
    const subtask = SubtaskEntity.create({
      id: uuidv4(),
      taskId: task.id,
      title: command.title,
      orderIndex: maxOrder + 1,
    });
    await this.repo.addSubtask(subtask);

    const view = await this.repo.findViewById(task.id);
    if (!view) throw new TaskNotFoundError();
    return view;
  }
}
