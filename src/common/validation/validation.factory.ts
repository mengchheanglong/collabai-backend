// src/common/validation/validation.factory.ts
//
// Formats NestJS ValidationPipe ValidationError trees into the API contract's
// structured error details: { field: string, message: string }[]

import { BadRequestException, ValidationError } from '@nestjs/common';
import { ContractErrorDetail } from '../http/error-body';

/**
 * Recursively flattens ValidationError trees into a flat array of ContractErrorDetail.
 * Supports nested DTOs (e.g. `user.profile.name`) and array elements (e.g. `items[0].id`).
 */
export function formatValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ContractErrorDetail[] {
  if (!Array.isArray(errors) || errors.length === 0) {
    return [];
  }

  const details: ContractErrorDetail[] = [];

  for (const error of errors) {
    if (!error) continue;

    let currentPath: string;
    if (!parentPath) {
      currentPath = error.property ?? '';
    } else if (/^\d+$/.test(error.property)) {
      currentPath = `${parentPath}[${error.property}]`;
    } else {
      currentPath = `${parentPath}.${error.property}`;
    }

    if (error.constraints && typeof error.constraints === 'object') {
      for (const message of Object.values(error.constraints)) {
        if (typeof message === 'string') {
          details.push({
            field: currentPath,
            message,
          });
        }
      }
    }

    if (Array.isArray(error.children) && error.children.length > 0) {
      details.push(...formatValidationErrors(error.children, currentPath));
    }
  }

  return details;
}

/**
 * Custom ExceptionFactory for ValidationPipe.
 * Produces a BadRequestException with code: VALIDATION_ERROR and structured field details.
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const details = formatValidationErrors(errors ?? []);
  const count = details.length;
  const message = `Validation failed on ${count} ${count === 1 ? 'field' : 'fields'}`;

  return new BadRequestException({
    code: 'VALIDATION_ERROR',
    message,
    details,
  });
}
