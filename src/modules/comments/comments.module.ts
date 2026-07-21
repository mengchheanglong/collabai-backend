// src/modules/comments/comments.module.ts
//
// Wires the comments module. Binds the comment repository port, registers the pure
// CommentDomainService (mention extraction), the CommentAccessService (project-membership
// bridge), and CQRS handlers. Imports ProjectsModule for PROJECT_REPOSITORY and AuthModule
// for the JwtAuthGuard dependency.

import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../shared/shared.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { CommentsController } from './presentation/controllers/comments.controller';

import { COMMENT_REPOSITORY } from './domain/repositories/comment.repository.interface';
import { CommentRepository } from './infrastructure/persistence/comment.repository';
import { CommentDomainService } from './domain/services/comment.domain.service';
import { CommentAccessService } from './application/services/comment-access.service';

import { AddCommentHandler } from './application/commands/add-comment.handler';
import { EditCommentHandler } from './application/commands/edit-comment.handler';
import { DeleteCommentHandler } from './application/commands/delete-comment.handler';
import { GetTaskCommentsHandler } from './application/queries/get-task-comments.handler';

const CommandHandlers = [
  AddCommentHandler,
  EditCommentHandler,
  DeleteCommentHandler,
];

const QueryHandlers = [GetTaskCommentsHandler];

@Module({
  imports: [CqrsModule, SharedModule, AuthModule, ProjectsModule],
  controllers: [CommentsController],
  providers: [
    { provide: COMMENT_REPOSITORY, useClass: CommentRepository },
    CommentDomainService,
    CommentAccessService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [COMMENT_REPOSITORY],
})
export class CommentsModule {}
