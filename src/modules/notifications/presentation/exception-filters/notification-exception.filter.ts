// src/modules/notifications/presentation/exception-filters/notification-exception.filter.ts
// Maps domain NotificationErrors -> HTTP responses (same shape as the other filters).

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { buildErrorBody } from '../../../../common/http/error-body';
import {
  NotificationError,
  NotificationForbiddenError,
  NotificationNotFoundError,
} from '../../application/errors/notification.errors';

@Catch(NotificationError)
export class NotificationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Notifications');

  catch(exception: NotificationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = this.statusFor(exception);

    this.logger.warn(
      `${exception.code} (${status}) [${request.method} ${request.originalUrl}]`,
    );

    response
      .status(status)
      .json(buildErrorBody(exception.code, exception.message));
  }

  private statusFor(exception: NotificationError): number {
    if (exception instanceof NotificationNotFoundError) {
      return HttpStatus.NOT_FOUND; // 404
    }
    if (exception instanceof NotificationForbiddenError) {
      return HttpStatus.FORBIDDEN; // 403
    }
    return HttpStatus.BAD_REQUEST;
  }
}
