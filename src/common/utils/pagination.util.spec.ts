import { parsePaginationParams } from './pagination.util';

describe('PaginationUtil - parsePaginationParams', () => {
  it('returns default page and default limit when inputs are undefined', () => {
    const res = parsePaginationParams(undefined, undefined, 20);
    expect(res).toEqual({ page: 1, limit: 20 });
  });

  it('clamps negative page and negative limit to boundaries', () => {
    const res = parsePaginationParams('-5', '-20', 20);
    expect(res.page).toBe(1);
    expect(res.limit).toBe(20);
  });

  it('clamps zero page and zero limit to boundaries', () => {
    const res = parsePaginationParams('0', '0', 20);
    expect(res.page).toBe(1);
    expect(res.limit).toBe(20);
  });

  it('clamps limit to maximum 100 when enormous number is provided', () => {
    const res = parsePaginationParams('1', '99999999', 20);
    expect(res.page).toBe(1);
    expect(res.limit).toBe(100);
  });

  it('allows valid page numbers and limits within [1, 100]', () => {
    const res = parsePaginationParams('5', '45', 20);
    expect(res).toEqual({ page: 5, limit: 45 });
  });

  it('handles array injection in query strings safely', () => {
    const res = parsePaginationParams(['3', '10'], ['50', '100'], 20);
    expect(res).toEqual({ page: 3, limit: 50 });
  });

  it('handles non-numeric garbage strings gracefully', () => {
    const res = parsePaginationParams('not-a-page', 'not-a-limit', 25);
    expect(res).toEqual({ page: 1, limit: 25 });
  });

  it('floors fractional numbers', () => {
    const res = parsePaginationParams('2.7', '15.9', 20);
    expect(res).toEqual({ page: 2, limit: 15 });
  });
});
