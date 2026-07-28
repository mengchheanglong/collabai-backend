// src/modules/boards/presentation/exception-filters/board-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import {
  BoardForbiddenError,
  BoardNotFoundError,
  DuplicateBoardNameError,
} from '../../application/errors/board.errors';

@Catch(
  BoardNotFoundError,
  BoardForbiddenError,
  DuplicateBoardNameError,
)
export class BoardExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = 500;
    let code = 'INTERNAL_ERROR';

    if (exception instanceof BoardNotFoundError) {
      status = 404;
      code = 'NOT_FOUND';
    } else if (exception instanceof BoardForbiddenError) {
      status = 403;
      code = 'FORBIDDEN';
    } else if (exception instanceof DuplicateBoardNameError) {
      status = 409;
      code = 'CONFLICT';
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message: exception.message,
      },
    });
  }
}
