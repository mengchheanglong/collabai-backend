// src/modules/auth/application/auth.constants.ts
//
// Token & session lifetimes per AUTH-SPEC.md § "Token & Session Expiration Policy".

export const VERIFICATION_CODE_LENGTH = 6;

/** Email verification code (and its cookie) validity window. Spec: 3 minutes. */
export const VERIFICATION_CODE_TTL_MINUTES = 3;

/** Password reset code (and its verification cookie) validity window. Spec: 3 minutes. */
export const PASSWORD_RESET_CODE_TTL_MINUTES = 3;

/** Post-verification password-reset session cookie. Spec: 10 minutes. Distinct from
 *  the reset *code* TTL above — this is the window in which the user may set a new password. */
export const PASSWORD_RESET_SESSION_TTL_MINUTES = 10;

/** Short-lived access token. Spec: 15 minutes. */
export const ACCESS_TOKEN_TTL = '15m';
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Long-lived refresh token. Spec: 18 days. */
export const REFRESH_TOKEN_TTL_DAYS = 18;
export const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
