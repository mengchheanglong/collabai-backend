// src/modules/boards/presentation/controllers/boards.controller.ts
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
import { BoardExceptionFilter } from '../exception-filters/board-exception.filter';

import { CreateBoardCommand } from '../../application/commands/create-board.command';
import { UpdateBoardCommand } from '../../application/commands/update-board.command';
import { DeleteBoardCommand } from '../../application/commands/delete-board.command';
import { GetBoardsQuery } from '../../application/queries/get-boards.query';
import { GetBoardQuery } from '../../application/queries/get-board.query';

import { CreateBoardDto } from '../../application/dtos/create-board.dto';
import { UpdateBoardDto } from '../../application/dtos/update-board.dto';
import { toBoardResponse } from '../../application/dtos/board-response.dto';
import {
  BoardView,
  BoardWithTasksView,
} from '../../domain/repositories/board.repository.interface';

@ApiTags('Boards')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
@UseFilters(BoardExceptionFilter)
export class BoardsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('projects/:projectId/boards')
  @ApiOperation({ summary: 'List boards in a project' })
  async listBoards(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
  ) {
    const views = await this.queryBus.execute(
      new GetBoardsQuery(userId, projectId),
    );
    return views.map(toBoardResponse);
  }

  @Post('projects/:projectId/boards')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a board' })
  async createBoard(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateBoardDto,
  ) {
    const view = await this.commandBus.execute(
      new CreateBoardCommand(userId, projectId, dto.name, dto.description),
    );
    return { board: toBoardResponse(view) };
  }

  @Get('boards/:boardId')
  @ApiOperation({ summary: 'Get a board and optionally its tasks' })
  async getBoard(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Query('includeTasks') includeTasks?: string,
  ) {
    const view = await this.queryBus.execute(
      new GetBoardQuery(userId, boardId, includeTasks === 'true'),
    );
    if (includeTasks === 'true') {
      const data = view as BoardWithTasksView;
      return {
        board: toBoardResponse(data),
        tasks: data.tasks.map((t) => ({
          _id: t.id,
          projectId: t.projectId,
          boardId: t.boardId,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          position: t.position,
          assigneeId: t.assigneeId,
          createdById: t.createdById,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          labels: t.labels,
          subtasks: t.subtasks.map((s) => ({
            _id: s.id,
            title: s.title,
            done: s.done,
          })),
          commentCount: t.commentCount,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      };
    }
    return { board: toBoardResponse(view as BoardView) };
  }

  @Patch('boards/:boardId')
  @ApiOperation({ summary: 'Update board metadata' })
  async updateBoard(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
    @Body() dto: UpdateBoardDto,
  ) {
    const view = await this.commandBus.execute(
      new UpdateBoardCommand(userId, boardId, {
        name: dto.name,
        description: dto.description,
      }),
    );
    return { board: toBoardResponse(view) };
  }

  @Delete('boards/:boardId')
  @ApiOperation({ summary: 'Delete a board' })
  async deleteBoard(
    @CurrentUser('id') userId: string,
    @Param('boardId') boardId: string,
  ) {
    await this.commandBus.execute(new DeleteBoardCommand(userId, boardId));
    return { success: true, message: 'Board deleted' };
  }
}
