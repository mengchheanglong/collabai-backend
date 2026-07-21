// src/modules/tasks/tasks.module.ts
//
// Wires the tasks module. Binds the task repository port, registers the pure
// TaskDomainService, the TaskAccessService (project-membership bridge), and all CQRS
// handlers. Imports ProjectsModule for PROJECT_REPOSITORY and AuthModule for the
// JwtAuthGuard dependency.

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksController } from './presentation/controllers/tasks.controller';

import { TASK_REPOSITORY } from './domain/repositories/task.repository.interface';
import { TaskRepository } from './infrastructure/persistence/task.repository';
import { TaskDomainService } from './domain/services/task.domain.service';
import { TaskAccessService } from './application/services/task-access.service';

import { CreateTaskHandler } from './application/commands/create-task.handler';
import { UpdateTaskHandler } from './application/commands/update-task.handler';
import { MoveTaskHandler } from './application/commands/move-task.handler';
import { DeleteTaskHandler } from './application/commands/delete-task.handler';
import { AddSubtaskHandler } from './application/commands/add-subtask.handler';
import { UpdateSubtaskHandler } from './application/commands/update-subtask.handler';
import { DeleteSubtaskHandler } from './application/commands/delete-subtask.handler';
import { GetTasksHandler } from './application/queries/get-tasks.handler';
import { GetTaskHandler } from './application/queries/get-task.handler';

const CommandHandlers = [
  CreateTaskHandler,
  UpdateTaskHandler,
  MoveTaskHandler,
  DeleteTaskHandler,
  AddSubtaskHandler,
  UpdateSubtaskHandler,
  DeleteSubtaskHandler,
];

const QueryHandlers = [GetTasksHandler, GetTaskHandler];

@Module({
  imports: [CqrsModule, SharedModule, AuthModule, ProjectsModule],
  controllers: [TasksController],
  providers: [
    { provide: TASK_REPOSITORY, useClass: TaskRepository },
    TaskDomainService,
    TaskAccessService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [TASK_REPOSITORY],
})
export class TasksModule {}
