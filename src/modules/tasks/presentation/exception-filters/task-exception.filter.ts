// src/modules/tasks/presentation/exception-filters/task-exception.filter.ts
// Maps domain TaskErrors -> HTTP responses (same shape as the auth/projects filters).

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  AssigneeNotMemberError,
  InvalidTaskFieldError,
  NotProjectMemberError,
  SubtaskNotFoundError,
  TaskError,
  TaskNotFoundError,
  TaskWriteForbiddenError,
} from '../../application/errors/task.errors';

@Catch(TaskError)
export class TaskExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Tasks');

  catch(exception: TaskError, host: ArgumentsHost): void {
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

  private statusFor(exception: TaskError): number {
    if (
      exception instanceof TaskNotFoundError ||
      exception instanceof SubtaskNotFoundError
    ) {
      return HttpStatus.NOT_FOUND; // 404
    }
    if (
      exception instanceof NotProjectMemberError ||
      exception instanceof TaskWriteForbiddenError
    ) {
      return HttpStatus.FORBIDDEN; // 403
    }
    if (
      exception instanceof AssigneeNotMemberError ||
      exception instanceof InvalidTaskFieldError
    ) {
      return HttpStatus.BAD_REQUEST; // 400
    }
    return HttpStatus.BAD_REQUEST;
  }
}
