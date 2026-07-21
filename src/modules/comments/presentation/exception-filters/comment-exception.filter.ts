// src/modules/comments/presentation/exception-filters/comment-exception.filter.ts
// Maps domain CommentErrors -> HTTP responses (same shape as the other module filters).

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  CommentError,
  CommentModerationForbiddenError,
  CommentNotFoundError,
  CommentWriteForbiddenError,
  NotProjectMemberError,
  TaskNotFoundError,
} from '../../application/errors/comment.errors';

@Catch(CommentError)
export class CommentExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Comments');

  catch(exception: CommentError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = this.statusFor(exception);

    this.logger.warn(
      `${exception.code} (${status}) [${request.method} ${request.originalUrl}]`,
    );

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }

  private statusFor(exception: CommentError): number {
    if (
      exception instanceof CommentNotFoundError ||
      exception instanceof TaskNotFoundError
    ) {
      return HttpStatus.NOT_FOUND; // 404
    }
    if (
      exception instanceof NotProjectMemberError ||
      exception instanceof CommentWriteForbiddenError ||
      exception instanceof CommentModerationForbiddenError
    ) {
      return HttpStatus.FORBIDDEN; // 403
    }
    return HttpStatus.BAD_REQUEST;
  }
}
