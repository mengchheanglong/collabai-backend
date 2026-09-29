// src/common/http/error-body.ts
//
// Shared builder for the API contract's error envelope:
//   { success: false, error: { code, message, details? } }
// Used by the global fallback filter and every module exception filter so all errors —
// domain, validation, and unexpected — share one shape.

export interface ContractErrorDetail {
  field?: string;
  message: string;
}

export interface ContractErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ContractErrorDetail[];
  };
}

export function buildErrorBody(
  code: string,
  message: string,
  details?: ContractErrorDetail[],
): ContractErrorBody {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && details.length ? { details } : {}),
    },
  };
}

/** Map an HTTP status to the contract's generic error code (for non-domain errors). */
export function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}
