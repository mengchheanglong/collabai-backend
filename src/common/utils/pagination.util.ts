// src/common/utils/pagination.util.ts
//
// Safe extraction, type coercion, and boundary clamping for pagination query parameters.
// Guarantees:
//   - page >= 1
//   - 1 <= limit <= 100

export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Extracts, coerces, and bounds page & limit query parameters.
 * Handles array injection (?page[]=1&page[]=2), negative values, zero,
 * NaN, enormous numbers, and non-numeric strings safely.
 */
export function parsePaginationParams(
  page: unknown,
  limit: unknown,
  defaultLimit = 20,
): PaginationParams {
  const rawPage = Array.isArray(page) ? page[0] : page;
  const rawLimit = Array.isArray(limit) ? limit[0] : limit;

  const p = Number(rawPage);
  const l = Number(rawLimit);

  const parsedPage = Number.isFinite(p) && p > 0 ? Math.floor(p) : 1;
  const parsedLimit =
    Number.isFinite(l) && l > 0
      ? Math.min(100, Math.max(1, Math.floor(l)))
      : Math.min(100, Math.max(1, defaultLimit));

  return {
    page: Math.max(1, parsedPage),
    limit: Math.min(100, Math.max(1, parsedLimit)),
  };
}
