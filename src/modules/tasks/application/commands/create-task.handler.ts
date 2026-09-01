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
import {
  BOARD_REPOSITORY,
  type IBoardRepository,
} from '../../../boards/domain/repositories/board.repository.interface';
import { TaskCreatedEvent } from '../../domain/events/task-created.event';
import { TaskAssignedEvent } from '../../domain/events/task-assigned.event';
import {
  AssigneeNotMemberError,
  InvalidTaskFieldError,
  TaskNotFoundError,
} from '../errors/task.errors';

import { SubtaskEntity } from '../../domain/entities/subtask.entity';

@CommandHandler(CreateTaskCommand)
export class CreateTaskHandler implements ICommandHandler<CreateTaskCommand> {
  constructor(
    @Inject(TASK_REPOSITORY) private readonly repo: ITaskRepository,
    @Inject(BOARD_REPOSITORY) private readonly boardRepo: IBoardRepository,
    private readonly access: TaskAccessService,
    private readonly domain: TaskDomainService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: CreateTaskCommand): Promise<TaskView> {
    await this.access.requireWriter(command.projectId, command.actingUserId);

    let board = command.boardId
      ? await this.boardRepo.findById(command.boardId)
      : null;
    if (!board || board.projectId !== command.projectId) {
      const projectBoards = await this.boardRepo.listForProject(
        command.projectId,
      );
      if (projectBoards.length > 0) {
        board = await this.boardRepo.findById(projectBoards[0].id);
      }
    }
    if (!board) {
      throw new InvalidTaskFieldError('No board found for this project');
    }

    if (command.assigneeId) {
      const ok = await this.access.isMember(
        command.projectId,
        command.assigneeId,
      );
      if (!ok) throw new AssigneeNotMemberError();
    }

    // Idempotent replay check for offline mutation sync
    if (command.id) {
      const existing = await this.repo.findViewById(command.id);
      if (existing) {
        if (existing.projectId === command.projectId) {
          return existing;
        }
        throw new InvalidTaskFieldError(
          'Task ID already exists in a different project',
        );
      }
    }

    const status = command.status ?? 'todo';
    const max = await this.repo.maxPosition(command.projectId, status);
    const task = TaskEntity.create({
      id: command.id || uuidv4(),
      projectId: command.projectId,
      boardId: board.id,
      title: command.title,
      description: command.description,
      status,
      priority: command.priority,
      position: this.domain.nextPosition(max),
      assigneeId: command.assigneeId,
      createdById: command.actingUserId,
      dueDate: command.dueDate,
    });

    try {
      await this.repo.create(task);
    } catch (err: any) {
      if (command.id) {
        const existing = await this.repo.findViewById(command.id);
        if (existing) {
          if (existing.projectId === command.projectId) {
            return existing;
          }
          throw new InvalidTaskFieldError(
            'Task ID already exists in a different project',
          );
        }
      }
      throw err;
    }
    if (command.labels && command.labels.length > 0) {
      await this.repo.setLabels(
        task.id,
        task.projectId,
        command.actingUserId,
        command.labels,
      );
    }
    if (command.subtasks && command.subtasks.length > 0) {
      let order = 0;
      for (const st of command.subtasks) {
        if (typeof st === 'string' && st.trim()) {
          order += 1;
          const subtask = SubtaskEntity.create({
            id: uuidv4(),
            taskId: task.id,
            title: st.trim(),
            orderIndex: order,
          });
          await this.repo.addSubtask(subtask);
        }
      }
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
