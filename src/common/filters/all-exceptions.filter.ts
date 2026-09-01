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
      } else if (typeof res === 'object' && res !== null) {
        const body = res as Record<string, unknown>;
        const rawMessage = body.message;
        if (Array.isArray(body.details)) {
          details = body.details as ContractErrorDetail[];
          message =
            typeof rawMessage === 'string' ? rawMessage : 'Validation failed';
        } else if (Array.isArray(rawMessage)) {
          // class-validator produces string[]; surface as details + a summary message.
          details = rawMessage.map((m) => ({ message: String(m) }));
          message = 'Validation failed';
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        } else {
          message = exception.message;
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      const err = exception as Error & {
        code?: string;
        status?: number;
        statusCode?: number;
        type?: string;
      };
      if (
        err.status === 413 ||
        err.statusCode === 413 ||
        err.type === 'entity.too.large'
      ) {
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        message = 'Payload Too Large: request entity exceeds 100kb limit';
      } else if (err.status && err.status >= 400 && err.status < 500) {
        status = err.status;
        message = err.message;
      } else if (
        err.statusCode &&
        err.statusCode >= 400 &&
        err.statusCode < 500
      ) {
        status = err.statusCode;
        message = err.message;
      } else if (err.code === 'P2023') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid UUID format provided';
      } else if (err.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Resource not found';
      } else if (err.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Unique constraint violation';
      } else if (err.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Foreign key constraint violation';
      } else {
        message = exception.message;
      }
    }

    const method = request?.method ?? 'UNKNOWN';
    const url = request?.url ?? 'UNKNOWN';
    this.logger.error(
      `[${method}] ${url} -> ${status} - ${JSON.stringify(message)}`,
    );

    response
      .status(status)
      .json(buildErrorBody(codeForStatus(status), message, details));
  }
}
