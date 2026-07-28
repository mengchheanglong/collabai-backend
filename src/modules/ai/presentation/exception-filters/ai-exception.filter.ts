// src/modules/ai/presentation/exception-filters/ai-exception.filter.ts
// Maps domain AiErrors -> HTTP responses (same shape as the other module filters).

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
  AiError,
  AiUnavailableError,
  NotProjectMemberError,
  TaskNotFoundError,
} from '../../application/errors/ai.errors';

@Catch(AiError)
export class AiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('AI');

  catch(exception: AiError, host: ArgumentsHost): void {
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

  private statusFor(exception: AiError): number {
    if (exception instanceof TaskNotFoundError) return HttpStatus.NOT_FOUND;
    if (exception instanceof NotProjectMemberError) return HttpStatus.FORBIDDEN;
    if (exception instanceof AiUnavailableError) {
      return HttpStatus.SERVICE_UNAVAILABLE; // 503
    }
    return HttpStatus.BAD_REQUEST;
  }
}
