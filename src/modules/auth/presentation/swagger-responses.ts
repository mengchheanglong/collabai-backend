// src/modules/auth/presentation/swagger-responses.ts
//
// Builds an @ApiResponse schema that mirrors AuthExceptionFilter's exact JSON body:
//   { statusCode, code, message, [violations], timestamp, path }
// so the Swagger docs advertise the precise error `code` each route can return.

import { ApiResponseOptions } from '@nestjs/swagger';

export function authErrorResponse(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): ApiResponseOptions {
  return {
    status,
    description: `\`${code}\``,
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: status },
        code: { type: 'string', example: code },
        message: { type: 'string', example: message },
        timestamp: { type: 'string', format: 'date-time' },
        path: { type: 'string', example: '/auth/...' },
      },
      example: {
        statusCode: status,
        code,
        message,
        ...(extra ?? {}),
        timestamp: '2026-01-01T00:00:00.000Z',
        path: '/auth/...',
      },
    },
  };
}
