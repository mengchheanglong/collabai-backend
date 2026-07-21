// src/modules/tasks/presentation/controllers/tasks.controller.ts
//
// REST surface for tasks. Task list is nested under a project; task/subtask operations are
// addressed by task id. All routes require a valid access token; handlers enforce project
// membership/role. Domain errors -> TaskExceptionFilter.

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { TaskExceptionFilter } from '../exception-filters/task-exception.filter';

import { CreateTaskCommand } from '../../application/commands/create-task.command';
import { UpdateTaskCommand } from '../../application/commands/update-task.command';
import { MoveTaskCommand } from '../../application/commands/move-task.command';
import { DeleteTaskCommand } from '../../application/commands/delete-task.command';
import { AddSubtaskCommand } from '../../application/commands/add-subtask.command';
import { UpdateSubtaskCommand } from '../../application/commands/update-subtask.command';
import { DeleteSubtaskCommand } from '../../application/commands/delete-subtask.command';
import { GetTasksQuery } from '../../application/queries/get-tasks.query';
import { GetTaskQuery } from '../../application/queries/get-task.query';

import { CreateTaskDto } from '../../application/dtos/create-task.dto';
import { UpdateTaskDto } from '../../application/dtos/update-task.dto';
import { MoveTaskDto } from '../../application/dtos/move-task.dto';
import {
  AddSubtaskDto,
  UpdateSubtaskDto,
} from '../../application/dtos/subtask.dto';
import { toTaskResponse } from '../../application/dtos/task-response.dto';
import {
  Paginated,
  TaskView,
} from '../../domain/repositories/task.repository.interface';
import { TaskStatus } from '../../domain/value-objects/task-status.value-object';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
@UseFilters(TaskExceptionFilter)
export class TasksController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('projects/:projectId/tasks')
  @ApiOperation({ summary: 'List tasks in a project (filterable)' })
  async list(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('q') q?: string,
    @Query('label') label?: string,
    @Query('dueBefore') dueBefore?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = (await this.queryBus.execute(
      new GetTasksQuery(userId, projectId, {
        status: asStatus(status),
        assigneeId,
        q,
        label,
        dueBefore: dueBefore ? new Date(dueBefore) : undefined,
        page: toInt(page, 1),
        limit: toInt(limit, 50),
      }),
    )) as Paginated<TaskView>;

    return {
      items: result.items.map(toTaskResponse),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    };
  }

  @Post('tasks')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a task' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateTaskDto) {
    const view = (await this.commandBus.execute(
      new CreateTaskCommand(
        userId,
        dto.projectId,
        dto.title,
        dto.description,
        dto.status,
        dto.priority,
        dto.assigneeId,
        dto.dueDate ? new Date(dto.dueDate) : undefined,
        dto.labels,
      ),
    )) as TaskView;
    return { task: toTaskResponse(view) };
  }

  @Get('tasks/:taskId')
  @ApiOperation({ summary: 'Get a task' })
  async get(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    const view = (await this.queryBus.execute(
      new GetTaskQuery(userId, taskId),
    )) as TaskView;
    return { task: toTaskResponse(view) };
  }

  @Patch('tasks/:taskId')
  @ApiOperation({ summary: 'Update task fields' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const view = (await this.commandBus.execute(
      new UpdateTaskCommand(
        userId,
        taskId,
        {
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          assigneeId: dto.assigneeId,
          dueDate:
            dto.dueDate === undefined
              ? undefined
              : dto.dueDate === null
                ? null
                : new Date(dto.dueDate),
        },
        dto.labels,
      ),
    )) as TaskView;
    return { task: toTaskResponse(view) };
  }

  @Patch('tasks/:taskId/status')
  @ApiOperation({ summary: 'Move a task between columns (status + position)' })
  async move(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: MoveTaskDto,
  ) {
    const view = (await this.commandBus.execute(
      new MoveTaskCommand(userId, taskId, dto.status, dto.position),
    )) as TaskView;
    return { task: toTaskResponse(view) };
  }

  @Delete('tasks/:taskId')
  @ApiOperation({ summary: 'Delete a task' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.commandBus.execute(new DeleteTaskCommand(userId, taskId));
    return { success: true, message: 'Task deleted' };
  }

  // ----- subtasks -----

  @Post('tasks/:taskId/subtasks')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a subtask' })
  async addSubtask(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: AddSubtaskDto,
  ) {
    const view = (await this.commandBus.execute(
      new AddSubtaskCommand(userId, taskId, dto.title),
    )) as TaskView;
    return { task: toTaskResponse(view) };
  }

  @Patch('tasks/:taskId/subtasks/:subtaskId')
  @ApiOperation({ summary: 'Rename or toggle a subtask' })
  async updateSubtask(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('subtaskId') subtaskId: string,
    @Body() dto: UpdateSubtaskDto,
  ) {
    const view = (await this.commandBus.execute(
      new UpdateSubtaskCommand(userId, taskId, subtaskId, dto.title, dto.done),
    )) as TaskView;
    return { task: toTaskResponse(view) };
  }

  @Delete('tasks/:taskId/subtasks/:subtaskId')
  @ApiOperation({ summary: 'Delete a subtask' })
  async deleteSubtask(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    const view = (await this.commandBus.execute(
      new DeleteSubtaskCommand(userId, taskId, subtaskId),
    )) as TaskView;
    return { task: toTaskResponse(view) };
  }
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function asStatus(value: string | undefined): TaskStatus | undefined {
  return value === 'todo' || value === 'in_progress' || value === 'done'
    ? value
    : undefined;
}
