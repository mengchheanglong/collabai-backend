// src/config/throttler.config.ts
//
// Named @nestjs/throttler configs for the auth endpoints. Registered globally via
// ThrottlerModule.forRoot(authThrottlers) in app.module.ts.

import { ThrottlerOptions } from '@nestjs/throttler';

const MIN = 60 * 1000; // one minute in ms
const isTest = process.env.NODE_ENV === 'test';

// Single source of truth: name + limits per limiter.
export const THROTTLERS = {
  register: {
    name: 'registerRateLimiter',
    ttl: 60 * MIN,
    limit: isTest ? 10000 : 5,
  },
  verifyCode: {
    name: 'verifyCodeRateLimiter',
    ttl: 15 * MIN,
    limit: isTest ? 10000 : 10,
  },
  resend: {
    name: 'resendRateLimiter',
    ttl: 15 * MIN,
    limit: isTest ? 10000 : 3,
  },
  passwordReset: {
    name: 'passwordResetRateLimiter',
    ttl: 60 * MIN,
    limit: isTest ? 10000 : 5,
  },
  login: {
    name: 'loginRateLimiter',
    ttl: 15 * MIN,
    limit: isTest ? 10000 : 10,
  },
  refreshToken: {
    name: 'refreshTokenRateLimiter',
    ttl: 15 * MIN,
    limit: isTest ? 10000 : 30,
  },
  logout: {
    name: 'logoutRateLimiter',
    ttl: 15 * MIN,
    limit: isTest ? 10000 : 20,
  },
  me: { name: 'meRateLimiter', ttl: 15 * MIN, limit: isTest ? 10000 : 120 },
} as const;

export const authThrottlers: ThrottlerOptions[] = Object.values(THROTTLERS).map(
  (t) => ({ name: t.name, ttl: t.ttl, limit: t.limit }),
);
