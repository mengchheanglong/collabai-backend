// src/common/utils/cookie.util.ts
//
// Reusable cookie options for auth cookies (access/refresh tokens). Reading of cookies
// is enabled by cookie-parser in main.ts; SETTING cookies with these options happens in
// the auth presentation layer later. Cookies are always httpOnly + sameSite:'strict',
// and `secure` is turned on only in production (derived from NODE_ENV).

import { CookieOptions } from 'express';

export function isProduction(nodeEnv?: string): boolean {
  return nodeEnv === 'production';
}

/**
 * Build hardened cookie options.
 * @param nodeEnv value of NODE_ENV (read from ConfigService by the caller)
 * @param maxAgeMs optional cookie lifetime in milliseconds
 */
export function buildAuthCookieOptions(
  nodeEnv?: string,
  maxAgeMs?: number,
): CookieOptions {
  const isProd = isProduction(nodeEnv);
  // In cross-origin cloud hosting (e.g. Render with frontend & backend on different subdomains),
  // sameSite must be 'none' and secure must be true for credentials (httpOnly cookies) to flow.
  const sameSiteEnv = process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none' | undefined;
  const sameSite: 'strict' | 'lax' | 'none' = sameSiteEnv ?? (isProd ? 'none' : 'lax');
  const secure =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : (isProd || sameSite === 'none');

  const options: CookieOptions = {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
  };
  if (maxAgeMs && maxAgeMs > 0) {
    options.maxAge = maxAgeMs;
  }
  return options;
}
