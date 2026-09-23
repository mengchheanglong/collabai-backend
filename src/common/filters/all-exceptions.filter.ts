// src/common/filters/all-exceptions.filter.ts
//
// Global fallback exception filter. Domain errors are handled by each module's own filter;
// this catches everything else — HttpException (incl. class-validator 400s), and unknown
// errors — and normalises them into the API contract's error envelope
//   { success: false, error: { code, message, details? } }.

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';
import {
  buildErrorBody,
  codeForStatus,
  ContractErrorDetail,
} from '../http/error-body';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: ContractErrorDetail[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const body = res as Record<string, unknown>;
        const rawMessage = body.message;
        if (Array.isArray(rawMessage)) {
          // class-validator produces string[]; surface as details + a summary message.
          details = rawMessage.map((m) => ({ message: String(m) }));
          message = 'Validation failed';
        } else {
          message = String(rawMessage ?? exception.message);
        }
      }
    } else if (exception instanceof Error) {
      const err = exception as Error & { code?: string };
      if (err.code === 'P2023') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid UUID format provided';
      } else if (err.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Resource not found';
      } else if (err.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Unique constraint violation';
      } else {
        message = exception.message;
      }
    }

    this.logger.error(
      `[${request.method}] ${request.url} -> ${status} - ${JSON.stringify(message)}`,
    );
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) Sentry.captureException(exception);

    response
      .status(status)
      .json(buildErrorBody(codeForStatus(status), message, details));
  }
}
