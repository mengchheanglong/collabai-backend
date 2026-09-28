// src/modules/documents/presentation/exception-filters/document-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import {
  DocumentForbiddenError,
  DocumentNotFoundError,
} from '../../application/errors/document.errors';

@Catch(DocumentNotFoundError, DocumentForbiddenError)
export class DocumentExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = 500;
    let code = 'INTERNAL_ERROR';

    if (exception instanceof DocumentNotFoundError) {
      status = 404;
      code = 'NOT_FOUND';
    } else if (exception instanceof DocumentForbiddenError) {
      status = 403;
      code = 'FORBIDDEN';
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
