// src/common/interceptors/response-envelope.interceptor.ts
//
// Wraps every successful handler return value in the API contract's success envelope:
//   plain value           -> { success: true, data: value }
//   { items, meta }        -> { success: true, data: items, meta }   (list convention)
// It also renames the entity key `id` -> `_id` recursively (the contract uses `_id`),
// leaving foreign-key fields like `userId`/`projectId`/`assigneeId` untouched.
//
// Controllers therefore return domain-shaped data; this interceptor makes it contract-shaped
// in one place, so per-endpoint mappers don't each have to.

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface ListShape {
  items: unknown[];
  meta: unknown;
}

function isListShape(value: unknown): value is ListShape {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as ListShape).items) &&
    (value as ListShape).meta !== undefined
  );
}

/** Recursively rename object keys named `id` to `_id`. Arrays/Dates handled; scalars pass. */
function renameIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(renameIds);
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key === 'id' ? '_id' : key] = renameIds(val);
    }
    return out;
  }
  return value;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (isListShape(value)) {
          return {
            success: true,
            data: renameIds(value.items),
            meta: value.meta,
          };
        }
        return { success: true, data: renameIds(value) };
      }),
    );
  }
}
