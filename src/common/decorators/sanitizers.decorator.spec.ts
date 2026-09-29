// src/common/decorators/sanitizers.decorator.spec.ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  IsSafeDate,
  IsTrimmedNotEmpty,
  SanitizeHtml,
  sanitizeHtmlContent,
  Trim,
  trimUnicode,
  isValidSafeDate,
  NormalizeEmail,
  normalizeEmail,
} from './sanitizers.decorator';

class TestDto {
  @Trim()
  @IsTrimmedNotEmpty({ minLength: 2, maxLength: 10 })
  name: string;

  @SanitizeHtml()
  description?: string;

  @IsSafeDate()
  dueDate?: string;
}

class NonStringTestDto {
  @Trim()
  numValue?: any;

  @SanitizeHtml()
  boolValue?: any;
}

describe('Sanitizers & Validation Decorators', () => {
  describe('sanitizeHtmlContent (Advanced XSS Protection)', () => {
    it('should strip simple script tags and inline javascript links', () => {
      const malicious =
        'Hello <script>alert("xss")</script><a href="javascript:steal()">Click</a>';
      const clean = sanitizeHtmlContent(malicious);
      expect(clean).toBe('Hello <a href="">Click</a>');
    });

    it('should strip multiline script tags and whitespace in tag names', () => {
      const payloads = [
        '<script\n>alert(1)</script\n>',
        '<script\r\n>alert(1)</script\r\n>',
        '<script\t>alert(1)</script\t>',
        ' <script   > alert("multiline\nnewline") </script  > ',
      ];
      for (const payload of payloads) {
        expect(sanitizeHtmlContent(payload)).not.toContain('<script');
        expect(sanitizeHtmlContent(payload)).not.toContain('alert');
      }
    });

    it('should strip mixed-case script, iframe, and style tags', () => {
      const malicious =
        '<ScRiPt>alert(1)</sCrIpT><IFRAME SRC="evil.html"></iFrAmE><sTyLe>body{color:red}</sTyLe>';
      const clean = sanitizeHtmlContent(malicious);
      expect(clean).toBe('');
    });

    it('should neutralize nested and recursive tag injection payloads', () => {
      const malicious = '<scr<script>ipt>alert(1)</script>';
      const clean = sanitizeHtmlContent(malicious);
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('</script>');

      const recursive =
        '<s<script>cript>alert(1)</script><s<script>cript>alert(2)</s</script>cript>';
      const cleanRecursive = sanitizeHtmlContent(recursive);
      expect(cleanRecursive).not.toContain('<script');
    });

    it('should strip unclosed script, iframe, and style tags up to EOF', () => {
      const unclosedScript = '<script src="https://evil.com/xss.js">';
      expect(sanitizeHtmlContent(unclosedScript)).toBe('');

      const unclosedIframe = '<iframe src="https://evil.com"';
      expect(sanitizeHtmlContent(unclosedIframe)).not.toContain('<iframe');
    });

    it('should strip dangerous HTML5 / SVG / Body event vectors', () => {
      const vectors = [
        '<svg onload=alert(1)>',
        '<svg/onload=alert(1)>',
        '<body onload=alert(1)>',
        '<input onfocus=alert(1) autofocus>',
        '<img src="x" onerror="alert(1)" />',
        "<img src='x' onerror='alert(1)' />",
        '<img src=x onerror=`alert(1)` />',
        '<img src=x onerror = "alert(1)" />',
        '<svg><animate onbegin=alert(1)>',
        '<details open ontoggle=alert(1)>',
      ];

      for (const vector of vectors) {
        const clean = sanitizeHtmlContent(vector);
        expect(clean).not.toMatch(/on\w+\s*=/i);
      }
    });

    it('should strip dangerous data: URI schemes in href and src', () => {
      const dataHtml =
        '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click</a>';
      expect(sanitizeHtmlContent(dataHtml)).toBe('<a href="">Click</a>');

      const dataSvg =
        '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+">';
      expect(sanitizeHtmlContent(dataSvg)).toBe('<img src="">');

      const dataJs =
        '<a href="data:application/javascript;base64,YWxlcnQoMSk=">Run</a>';
      expect(sanitizeHtmlContent(dataJs)).toBe(
        '<a href="">Click</a>'.replace('Click', 'Run'),
      );
    });

    it('should preserve safe raster image data URIs (PNG, JPEG, GIF, WEBP)', () => {
      const safePng =
        '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />';
      expect(sanitizeHtmlContent(safePng)).toBe(safePng);
    });

    it('should neutralize null bytes and unicode null evasion in tags and pseudo-protocols', () => {
      const nullScript = '<script\0>alert(1)</script>';
      expect(sanitizeHtmlContent(nullScript)).toBe('');

      const nullProto = '<a href="jav\0ascript:alert(1)">Click</a>';
      expect(sanitizeHtmlContent(nullProto)).toBe('<a href="">Click</a>');
    });

    it('should strip object, embed, applet, template, noscript, frame, meta, and link tags', () => {
      const dangerousTags =
        '<object data="evil.swf"></object><embed src="evil.swf" /><template><script>x</script></template><meta http-equiv="refresh" content="0;url=evil.com">';
      const clean = sanitizeHtmlContent(dangerousTags);
      expect(clean).toBe('');
    });

    it('should preserve safe text and markdown syntax', () => {
      const safe =
        '# Title\n**Bold** and *italic* with `code` block.\n[Link](https://example.com)';
      const clean = sanitizeHtmlContent(safe);
      expect(clean).toBe(safe);
    });

    it('should gracefully return non-string inputs without throwing', () => {
      expect(sanitizeHtmlContent(null)).toBeNull();
      expect(sanitizeHtmlContent(undefined)).toBeUndefined();
      expect(sanitizeHtmlContent(12345)).toBe(12345);
      expect(sanitizeHtmlContent(true)).toBe(true);
      expect(sanitizeHtmlContent({ key: 'value' })).toEqual({ key: 'value' });
      expect(sanitizeHtmlContent([1, 2, 3])).toEqual([1, 2, 3]);
    });
  });

  describe('Unicode & Whitespace Trimming (trimUnicode & @Trim)', () => {
    it('should trim standard ASCII whitespace', () => {
      expect(trimUnicode('   hello world   ')).toBe('hello world');
      expect(trimUnicode('\t\r\n test \t\r\n')).toBe('test');
    });

    it('should trim zero-width spaces (\u200B, \u200C, \u200D, \uFEFF, \u2060, \u180E)', () => {
      const zws = '\u200B\u200C\u200D\uFEFF\u2060\u180E';
      expect(trimUnicode(zws)).toBe('');
      expect(trimUnicode(`${zws}Hello${zws}`)).toBe('Hello');
    });

    it('should trim Unicode spaces (NBSP \u00A0, ideographic \u3000, en/em spaces)', () => {
      const unicodeSpaces =
        '\u00A0\u3000\u2000\u2001\u2002\u2003\u2028\u2029\u202F\u205F';
      expect(trimUnicode(unicodeSpaces)).toBe('');
      expect(
        trimUnicode(`${unicodeSpaces}Project CollabAI${unicodeSpaces}`),
      ).toBe('Project CollabAI');
    });

    it('should handle non-string inputs in @Trim() gracefully', () => {
      const dto = plainToInstance(NonStringTestDto, {
        numValue: 42,
        boolValue: true,
      });
      expect(dto.numValue).toBe(42);
      expect(dto.boolValue).toBe(true);
    });
  });

  describe('IsTrimmedNotEmpty Constraint with Unicode & Emojis', () => {
    it('should reject pure zero-width spaces and whitespace-only strings', async () => {
      const invalidValues = [
        '',
        '     ',
        '\t\n\r',
        '\u200B\u200C\u200D\uFEFF',
        '\u00A0\u3000',
        ' \u200B \u3000 \t ',
      ];

      for (const val of invalidValues) {
        const dto = plainToInstance(TestDto, { name: val });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('name');
      }
    });

    it('should accurately count Unicode code points for Emoji surrogate pairs (📋, 🚀)', async () => {
      // 1 emoji = 1 code point, but 2 UTF-16 code units. With minLength: 2, 1 emoji should fail.
      const dtoSingleEmoji = plainToInstance(TestDto, { name: '📋' });
      const errorsSingle = await validate(dtoSingleEmoji);
      expect(errorsSingle.length).toBeGreaterThan(0);

      // 2 emojis = 2 code points. With minLength: 2, 2 emojis should pass!
      const dtoTwoEmojis = plainToInstance(TestDto, { name: '📋🚀' });
      const errorsTwo = await validate(dtoTwoEmojis);
      expect(errorsTwo.length).toBe(0);

      // 10 emojis = 10 code points. With maxLength: 10, should pass!
      const dtoMaxEmojis = plainToInstance(TestDto, { name: '🚀'.repeat(10) });
      const errorsMax = await validate(dtoMaxEmojis);
      expect(errorsMax.length).toBe(0);

      // 11 emojis = 11 code points. With maxLength: 10, should fail!
      const dtoExceedEmojis = plainToInstance(TestDto, {
        name: '🚀'.repeat(11),
      });
      const errorsExceed = await validate(dtoExceedEmojis);
      expect(errorsExceed.length).toBeGreaterThan(0);
    });

    it('should reject non-string inputs cleanly', async () => {
      const dto = plainToInstance(TestDto, {
        name: 12345 as unknown as string,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('IsSafeDate & Calendar Epoch Boundaries', () => {
    it('should validate valid ISO dates and Date instances within 1970-2100', () => {
      expect(isValidSafeDate('2026-09-01T12:00:00Z')).toBe(true);
      expect(isValidSafeDate('2026-09-01T12:00:00.123Z')).toBe(true);
      expect(isValidSafeDate('2026-09-01')).toBe(true);
      expect(isValidSafeDate(new Date('2026-09-01T12:00:00Z'))).toBe(true);
    });

    it('should validate boundary epoch dates (1970-01-01 and 2100-12-31)', () => {
      expect(isValidSafeDate('1970-01-01T00:00:00.000Z')).toBe(true);
      expect(isValidSafeDate('2100-12-31T23:59:59.999Z')).toBe(true);
    });

    it('should reject out-of-epoch years (< 1970 or > 2100)', () => {
      expect(isValidSafeDate('1969-12-31T23:59:59.999Z')).toBe(false);
      expect(isValidSafeDate('2101-01-01T00:00:00.000Z')).toBe(false);
      expect(isValidSafeDate('9999-12-31T23:59:59Z')).toBe(false);
    });

    it('should validate leap years correctly (Feb 29 on leap vs non-leap years)', () => {
      // 2024 is a leap year -> Feb 29 is valid
      expect(isValidSafeDate('2024-02-29T00:00:00.000Z')).toBe(true);
      expect(isValidSafeDate('2024-02-29')).toBe(true);
      // 2000 is a leap year (divisible by 400) -> valid
      expect(isValidSafeDate('2000-02-29T12:00:00Z')).toBe(true);

      // 2023 and 2026 are not leap years -> Feb 29 is invalid
      expect(isValidSafeDate('2023-02-29T00:00:00.000Z')).toBe(false);
      expect(isValidSafeDate('2026-02-29T00:00:00.000Z')).toBe(false);
      expect(isValidSafeDate('2026-02-29')).toBe(false);
    });

    it('should reject invalid calendar days for specific months', () => {
      // Feb 30/31 invalid
      expect(isValidSafeDate('2026-02-30')).toBe(false);
      expect(isValidSafeDate('2026-02-31')).toBe(false);
      // April, June, Sept, Nov have 30 days; day 31 is invalid
      expect(isValidSafeDate('2026-04-31')).toBe(false);
      expect(isValidSafeDate('2026-06-31')).toBe(false);
      expect(isValidSafeDate('2026-09-31')).toBe(false);
      expect(isValidSafeDate('2026-11-31')).toBe(false);
      // Month 13 or Month 00
      expect(isValidSafeDate('2026-13-01')).toBe(false);
      expect(isValidSafeDate('2026-00-01')).toBe(false);
      // Day 00 or Day 32
      expect(isValidSafeDate('2026-01-00')).toBe(false);
      expect(isValidSafeDate('2026-01-32')).toBe(false);
    });

    it('should validate and enforce valid timezone offsets (+14:00 to -12:00)', () => {
      expect(isValidSafeDate('2026-09-01T12:00:00+14:00')).toBe(true);
      expect(isValidSafeDate('2026-09-01T12:00:00-12:00')).toBe(true);
      expect(isValidSafeDate('2026-09-01T12:00:00+05:30')).toBe(true);

      // Exceeding valid timezone offsets
      expect(isValidSafeDate('2026-09-01T12:00:00+15:00')).toBe(false);
      expect(isValidSafeDate('2026-09-01T12:00:00-13:00')).toBe(false);
    });

    it('should accept null or undefined for optional fields, reject non-dates', () => {
      expect(isValidSafeDate(null)).toBe(true);
      expect(isValidSafeDate(undefined)).toBe(true);
      expect(isValidSafeDate(12345)).toBe(false);
      expect(isValidSafeDate(true)).toBe(false);
      expect(isValidSafeDate('not-a-date')).toBe(false);
      expect(isValidSafeDate(new Date('invalid'))).toBe(false);
    });

    it('should accept lowercase ISO date letters and microsecond precision', () => {
      expect(isValidSafeDate('2026-09-15t14:00:00z')).toBe(true);
      expect(isValidSafeDate('2026-09-15T14:00:00.123456Z')).toBe(true);
      expect(isValidSafeDate('2026-09-15t14:00:00.123456789z')).toBe(true);
    });
  });

  describe('NormalizeEmail & normalizeEmail', () => {
    it('normalizes mixed-case and whitespace-padded emails', () => {
      expect(normalizeEmail('  User+Tag@GMAIL.COM  ')).toBe(
        'user+tag@gmail.com',
      );
      expect(normalizeEmail('\u200Buser@domain.com\uFEFF')).toBe(
        'user@domain.com',
      );
      expect(normalizeEmail(12345 as any)).toBe(12345);
    });

    it('transforms email field via @NormalizeEmail decorator', async () => {
      class EmailDto {
        @NormalizeEmail()
        email: string;
      }
      const instance = plainToInstance(EmailDto, {
        email: '  Alice.Admin@Example.ORG  ',
      });
      expect(instance.email).toBe('alice.admin@example.org');
    });
  });

  describe('sanitizeHtmlContent forward-slash XSS vectors', () => {
    it('neutralizes forward-slash event handlers like <svg/onload=...>', () => {
      const payload = '<svg/onload=alert(1)>';
      const clean = sanitizeHtmlContent(payload);
      expect(clean).not.toContain('onload=');
      expect(clean).not.toContain('alert(1)');
    });
  });
});
