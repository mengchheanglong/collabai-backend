// src/common/interceptors/logging.interceptor.ts
//
// Generic request/response timing logger. Logs method, url, status and duration for
// every handled request. No coupling to any module.

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, url } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        console.log(JSON.stringify({
          event: 'http.request.completed', method, path: originalUrl ?? url,
          status: response.statusCode, durationMs: Date.now() - start,
          userId: request.user?.id ?? null,
        }));
      }),
      catchError((error: unknown) => {
        const status = error instanceof HttpException ? error.getStatus() : 500;
        console.error(JSON.stringify({
          event: 'http.request.failed', method, path: originalUrl ?? url,
          status, durationMs: Date.now() - start, userId: request.user?.id ?? null,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
        return throwError(() => error);
      }),
    );
  }
}
