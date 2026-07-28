// src/modules/projects/presentation/exception-filters/project-exception.filter.ts
//
// Maps domain ProjectErrors -> HTTP responses (same shape/approach as AuthExceptionFilter).

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
  DuplicateProjectNameError,
  InsufficientProjectPermissionError,
  InvalidProjectRoleError,
  InviteeNotFoundError,
  LastOwnerError,
  MemberAlreadyExistsError,
  MemberNotFoundError,
  NotProjectMemberError,
  ProjectError,
  ProjectNotFoundError,
} from '../../application/errors/project.errors';

@Catch(ProjectError)
export class ProjectExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Projects');

  catch(exception: ProjectError, host: ArgumentsHost): void {
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

  private statusFor(exception: ProjectError): number {
    if (
      exception instanceof ProjectNotFoundError ||
      exception instanceof MemberNotFoundError ||
      exception instanceof InviteeNotFoundError
    ) {
      return HttpStatus.NOT_FOUND; // 404
    }
    if (
      exception instanceof NotProjectMemberError ||
      exception instanceof InsufficientProjectPermissionError
    ) {
      return HttpStatus.FORBIDDEN; // 403
    }
    if (
      exception instanceof DuplicateProjectNameError ||
      exception instanceof MemberAlreadyExistsError ||
      exception instanceof LastOwnerError
    ) {
      return HttpStatus.CONFLICT; // 409
    }
    if (exception instanceof InvalidProjectRoleError) {
      return HttpStatus.BAD_REQUEST; // 400
    }
    return HttpStatus.BAD_REQUEST;
  }
}
