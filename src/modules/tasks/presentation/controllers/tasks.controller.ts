// src/modules/tasks/presentation/controllers/tasks.controller.ts
//
// REST surface for tasks. Task list is nested under a project; task/subtask operations are
// addressed by task id. All routes require a valid access token; handlers enforce project
// membership/role. Domain errors -> TaskExceptionFilter.

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
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

import { parsePaginationParams } from '../../../../common/utils/pagination.util';
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
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query('boardId') boardId?: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('q') q?: string,
    @Query('label') label?: string,
    @Query('dueBefore') dueBefore?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('page[]') pageBracket?: string | string[],
    @Query('limit[]') limitBracket?: string | string[],
  ) {
    const { page: parsedPage, limit: parsedLimit } = parsePaginationParams(
      page ?? pageBracket,
      limit ?? limitBracket,
      50,
    );
    const result = await this.queryBus.execute(
      new GetTasksQuery(userId, projectId, {
        boardId,
        status: asStatus(status),
        assigneeId,
        q,
        label,
        dueBefore: parseDate(dueBefore),
        page: parsedPage,
        limit: parsedLimit,
      }),
    );

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
    const view = await this.commandBus.execute(
      new CreateTaskCommand(
        userId,
        dto.projectId,
        dto.boardId,
        dto.title,
        dto.description,
        dto.status,
        dto.priority,
        dto.assigneeId,
        dto.dueDate ? new Date(dto.dueDate) : undefined,
        dto.labels,
        dto.subtasks,
        dto.id,
      ),
    );
    return { task: toTaskResponse(view) };
  }

  @Get('tasks/:taskId')
  @ApiOperation({ summary: 'Get a task' })
  async get(
    @CurrentUser('id') userId: string,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
  ) {
    const view = await this.queryBus.execute(new GetTaskQuery(userId, taskId));
    return { task: toTaskResponse(view) };
  }

  @Patch('tasks/:taskId')
  @ApiOperation({ summary: 'Update task fields' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const view = await this.commandBus.execute(
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
    );
    return { task: toTaskResponse(view) };
  }

  @Patch('tasks/:taskId/status')
  @ApiOperation({ summary: 'Move a task between columns (status + position)' })
  async move(
    @CurrentUser('id') userId: string,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: MoveTaskDto,
  ) {
    const status = dto.status ?? dto.destinationStatus;
    if (!status) {
      throw new BadRequestException('Status or destinationStatus is required');
    }
    const position = dto.position ?? dto.destinationPosition;
    const view = await this.commandBus.execute(
      new MoveTaskCommand(userId, taskId, status, position),
    );
    return { task: toTaskResponse(view) };
  }

  @Patch('tasks/:taskId/move')
  @ApiOperation({ summary: 'Move a task between columns (PATCH alias)' })
  async movePatch(
    @CurrentUser('id') userId: string,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: MoveTaskDto,
  ) {
    return this.move(userId, taskId, dto);
  }

  @Post('tasks/:taskId/move')
  @HttpCode(200)
  @ApiOperation({ summary: 'Move a task between columns (POST alias)' })
  async movePost(
    @CurrentUser('id') userId: string,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: MoveTaskDto,
  ) {
    return this.move(userId, taskId, dto);
  }

  @Delete('tasks/:taskId')
  @ApiOperation({ summary: 'Delete a task' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
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
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Body() dto: AddSubtaskDto,
  ) {
    const view = await this.commandBus.execute(
      new AddSubtaskCommand(userId, taskId, dto.title),
    );
    const task = toTaskResponse(view);
    const subtask = task.subtasks[task.subtasks.length - 1];
    return { task, subtask };
  }

  @Patch('tasks/:taskId/subtasks/:subtaskId')
  @ApiOperation({ summary: 'Rename or toggle a subtask' })
  async updateSubtask(
    @CurrentUser('id') userId: string,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Param('subtaskId', new ParseUUIDPipe({ version: '4' })) subtaskId: string,
    @Body() dto: UpdateSubtaskDto,
  ) {
    const view = await this.commandBus.execute(
      new UpdateSubtaskCommand(userId, taskId, subtaskId, dto.title, dto.done),
    );
    const task = toTaskResponse(view);
    const subtask = task.subtasks.find((s) => s.id === subtaskId);
    return { task, subtask };
  }

  @Delete('tasks/:taskId/subtasks/:subtaskId')
  @ApiOperation({ summary: 'Delete a subtask' })
  async deleteSubtask(
    @CurrentUser('id') userId: string,
    @Param('taskId', new ParseUUIDPipe({ version: '4' })) taskId: string,
    @Param('subtaskId', new ParseUUIDPipe({ version: '4' })) subtaskId: string,
  ) {
    const view = await this.commandBus.execute(
      new DeleteSubtaskCommand(userId, taskId, subtaskId),
    );
    return {
      task: toTaskResponse(view),
      success: true,
      message: 'Subtask deleted',
    };
  }
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function asStatus(value: string | undefined): TaskStatus | undefined {
  return value === 'todo' || value === 'in_progress' || value === 'done'
    ? value
    : undefined;
}
