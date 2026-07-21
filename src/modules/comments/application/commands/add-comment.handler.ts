// src/modules/comments/application/commands/add-comment.handler.ts
// Post a comment on a task. Writer role required. Extracts @email mentions and emits a
// MentionCreatedEvent per mentioned project member (excluding the author).

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { AddCommentCommand } from './add-comment.command';
import {
  type ICommentRepository,
  COMMENT_REPOSITORY,
  CommentView,
} from '../../domain/repositories/comment.repository.interface';
import { CommentEntity } from '../../domain/entities/comment.entity';
import { CommentDomainService } from '../../domain/services/comment.domain.service';
import { CommentAccessService } from '../services/comment-access.service';
import { CommentAddedEvent } from '../../domain/events/comment-added.event';
import { MentionCreatedEvent } from '../../domain/events/mention-created.event';
import {
  CommentNotFoundError,
  TaskNotFoundError,
} from '../errors/comment.errors';

@CommandHandler(AddCommentCommand)
export class AddCommentHandler implements ICommandHandler<AddCommentCommand> {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly repo: ICommentRepository,
    private readonly access: CommentAccessService,
    private readonly domain: CommentDomainService,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: AddCommentCommand): Promise<CommentView> {
    const projectId = await this.repo.getTaskProjectId(command.taskId);
    if (!projectId) throw new TaskNotFoundError();
    await this.access.requireWriter(projectId, command.actingUserId);

    const comment = CommentEntity.create({
      id: uuidv4(),
      taskId: command.taskId,
      authorId: command.actingUserId,
      body: command.body,
    });
    await this.repo.create(comment);

    this.events.emit(
      CommentAddedEvent.eventName,
      new CommentAddedEvent(
        comment.id,
        comment.taskId,
        projectId,
        comment.authorId,
      ),
    );

    // Resolve @email mentions to project members and notify each (except the author).
    const emails = this.domain.extractMentionEmails(comment.body);
    const mentionedIds = await this.access.resolveMentionedMemberIds(
      projectId,
      emails,
    );
    for (const userId of mentionedIds) {
      if (userId === comment.authorId) continue;
      this.events.emit(
        MentionCreatedEvent.eventName,
        new MentionCreatedEvent(
          userId,
          comment.id,
          comment.taskId,
          projectId,
          comment.authorId,
        ),
      );
    }

    const view = await this.repo.findViewById(comment.id);
    if (!view) throw new CommentNotFoundError();
    return view;
  }
}
