// src/modules/tasks/application/commands/create-task.handler.ts
// Create a task in a project. Writer role required; an assignee (if given) must itself be
// a project member. Position appends to the end of the destination status column.

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { CreateTaskCommand } from './create-task.command';
import {
  type ITaskRepository,
  TASK_REPOSITORY,
  TaskView,
} from '../../domain/repositories/task.repository.interface';
import { TaskEntity } from '../../domain/entities/task.entity';
import { TaskDomainService } from '../../domain/services/task.domain.service';
import { TaskAccessService } from '../services/task-access.service';
import { TaskCreatedEvent } from '../../domain/events/task-created.event';
import { TaskAssignedEvent } from '../../domain/events/task-assigned.event';
import {
  AssigneeNotMemberError,
  TaskNotFoundError,
} from '../errors/task.errors';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    private readonly access: TaskAccessService,
    private readonly domain: TaskDomainService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: CreateTaskCommand): Promise<TaskView> {
    await this.access.requireWriter(command.projectId, command.actingUserId);

    if (command.assigneeId) {
      const ok = await this.access.isMember(
        command.projectId,
        command.assigneeId,
      );
      if (!ok) throw new AssigneeNotMemberError();
    }

    const status = command.status ?? 'todo';
    const max = await this.repo.maxPosition(command.projectId, status);
    const task = TaskEntity.create({
      id: uuidv4(),
      projectId: command.projectId,
      title: command.title,
      description: command.description,
      status,
      priority: command.priority,
      position: this.domain.nextPosition(max),
      assigneeId: command.assigneeId,
      createdById: command.actingUserId,
      dueDate: command.dueDate,
    });

    await this.repo.create(task);
    if (command.labels) {
      await this.repo.setLabels(
        task.id,
        task.projectId,
        command.actingUserId,
        command.labels,
      );
    }

    this.events.emit(
      TaskCreatedEvent.eventName,
      new TaskCreatedEvent(
        task.id,
        task.projectId,
        command.actingUserId,
        task.title,
      ),
    );
    if (task.assigneeId) {
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
