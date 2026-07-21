// src/modules/tasks/application/commands/update-task.handler.ts
// Edit task fields (not status/position). Writer role required; a new assignee must be a
// project member. Emits task.assigned when the assignee changes to a new user.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UpdateTaskCommand } from './update-task.command';
import {
  type ITaskRepository,
  TASK_REPOSITORY,
  TaskView,
} from '../../domain/repositories/task.repository.interface';
import { TaskAccessService } from '../services/task-access.service';
import { TaskAssignedEvent } from '../../domain/events/task-assigned.event';
import {
  AssigneeNotMemberError,
  TaskNotFoundError,
} from '../errors/task.errors';

@CommandHandler(UpdateTaskCommand)
export class UpdateTaskHandler implements ICommandHandler<UpdateTaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly access: TaskAccessService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: UpdateTaskCommand): Promise<TaskView> {
    const task = await this.repo.findById(command.taskId);
    if (!task) throw new TaskNotFoundError();
    await this.access.requireWriter(task.projectId, command.actingUserId);

    const newAssignee = command.fields.assigneeId;
    if (newAssignee) {
      const ok = await this.access.isMember(task.projectId, newAssignee);
      if (!ok) throw new AssigneeNotMemberError();
    }

    const previousAssignee = task.assigneeId;
    task.applyUpdate(command.fields);
    await this.repo.update(task);

    if (command.labels) {
      await this.repo.setLabels(
        task.id,
        task.projectId,
        command.actingUserId,
        command.labels,
      );
    }

    // Notify only when the assignee actually changed to a real user.
    if (task.assigneeId && task.assigneeId !== previousAssignee) {
      this.events.emit(
        TaskAssignedEvent.eventName,
        new TaskAssignedEvent(
          task.id,
          task.projectId,
          task.assigneeId,
          command.actingUserId,
          task.title,
        ),
      );
    }

    const view = await this.repo.findViewById(task.id);
    if (!view) throw new TaskNotFoundError();
    return view;
  }
}
