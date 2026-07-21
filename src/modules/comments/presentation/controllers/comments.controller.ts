// src/modules/comments/presentation/controllers/comments.controller.ts
//
// REST surface for comments. Listing/creating is nested under a task; edit/delete are
// addressed by comment id. All routes require a valid access token; handlers enforce
// project membership and author/moderator rules. Errors -> CommentExceptionFilter.

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { CommentExceptionFilter } from '../exception-filters/comment-exception.filter';

import { AddCommentCommand } from '../../application/commands/add-comment.command';
import { EditCommentCommand } from '../../application/commands/edit-comment.command';
import { DeleteCommentCommand } from '../../application/commands/delete-comment.command';
import { GetTaskCommentsQuery } from '../../application/queries/get-task-comments.query';

import { AddCommentDto } from '../../application/dtos/add-comment.dto';
import { EditCommentDto } from '../../application/dtos/edit-comment.dto';
import { toCommentResponse } from '../../application/dtos/comment-response.dto';
import { CommentView } from '../../domain/repositories/comment.repository.interface';

@ApiTags('Comments')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
@UseFilters(CommentExceptionFilter)
export class CommentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('tasks/:taskId/comments')
  @ApiOperation({ summary: 'List a task\'s comments (oldest first)' })
  async list(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
  ) {
    const comments = (await this.queryBus.execute(
      new GetTaskCommentsQuery(userId, taskId),
    )) as CommentView[];
    return { comments: comments.map(toCommentResponse) };
  }

  @Post('tasks/:taskId/comments')
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a comment to a task' })
  async add(
    @CurrentUser('id') userId: string,
    @Param('taskId') taskId: string,
    @Body() dto: AddCommentDto,
  ) {
    const view = (await this.commandBus.execute(
      new AddCommentCommand(userId, taskId, dto.body),
    )) as CommentView;
    return { comment: toCommentResponse(view) };
  }

  @Patch('comments/:commentId')
  @ApiOperation({ summary: 'Edit a comment (author or moderator)' })
  async edit(
    @CurrentUser('id') userId: string,
    @Param('commentId') commentId: string,
    @Body() dto: EditCommentDto,
  ) {
    const view = (await this.commandBus.execute(
      new EditCommentCommand(userId, commentId, dto.body),
    )) as CommentView;
    return { comment: toCommentResponse(view) };
  }

  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Delete a comment (author or moderator)' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('commentId') commentId: string,
  ) {
    await this.commandBus.execute(new DeleteCommentCommand(userId, commentId));
    return { success: true, message: 'Comment deleted' };
  }
}
