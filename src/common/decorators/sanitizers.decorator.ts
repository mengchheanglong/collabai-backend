// src/common/decorators/sanitizers.decorator.ts
//
// Custom validation and transformation decorators for input sanitization,
// whitespace trimming, HTML XSS protection, and safe date boundaries.

import { Transform } from 'class-transformer';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Strips dangerous HTML tags, script vectors, and malicious schemes (XSS prevention)
 * while preserving safe markdown and plain text characters.
 */
export function sanitizeHtmlContent(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  // Strip null bytes and control characters that can evade regex checks
  let sanitized = value.replace(/\0/g, '');

  let prev: string;
  let passes = 0;
  const maxPasses = 10;

  // Multi-pass sanitization loop to neutralize nested/recursive tag injection (e.g. <scr<script>ipt>)
  do {
    prev = sanitized;
    sanitized = sanitized
      // Strip script tags and content (multiline, case-insensitive, unclosed tags up to EOF)
      .replace(/<\s*script\b[\s\S]*?(?:<\/\s*script[^>]*>|$)/gi, '')
      // Strip style tags and content
      .replace(/<\s*style\b[\s\S]*?(?:<\/\s*style[^>]*>|$)/gi, '')
      // Strip iframe tags and content
      .replace(/<\s*iframe\b[\s\S]*?(?:<\/\s*iframe[^>]*>|$)/gi, '')
      // Strip object/embed/applet/template/noscript/noembed/noframes/frameset tags
      .replace(
        /<\s*(?:object|embed|applet|template|noscript|noembed|noframes|frameset)\b[\s\S]*?(?:<\/\s*(?:object|embed|applet|template|noscript|noembed|noframes|frameset)[^>]*>|$)/gi,
        '',
      )
      // Strip frame, base, link, meta tags
      .replace(/<\s*(?:frame|base|link|meta)\b[^>]*\/?>/gi, '')
      // Strip form tags and content
      .replace(/<\s*form\b[\s\S]*?(?:<\/\s*form[^>]*>|$)/gi, '')
      // Strip leftover closing tags
      .replace(
        /<\/\s*(?:script|style|iframe|object|embed|applet|template|noscript|noembed|noframes|frameset|frame|base|link|meta|form)\b[^>]*>/gi,
        '',
      )
      // Strip inline javascript: and vbscript: pseudo-protocols (with whitespace evasion support)
      .replace(/(?:java\s*script|vb\s*script)\s*:[^"'\s>]*/gi, '')
      // Strip dangerous data: URI schemes (html, javascript, svg+xml, etc.)
      .replace(
        /data\s*:\s*(?:text\s*\/\s*(?:html|javascript|ecmascript|xml)|application\s*\/\s*(?:javascript|ecmascript|x-javascript|xml|xhtml\+xml)|image\s*\/\s*svg\+xml)[^"'\s>]*/gi,
        '',
      )
      // Strip inline event handlers like onerror=, onclick=, onload=, onfocus=, onbegin= etc.
      .replace(
        /\bon[a-zA-Z0-9_-]+\s*=\s*(?:'[^']*'|"[^"]*"|`[^`]*`|[^\s>]+)/gi,
        '',
      );
    passes++;
  } while (sanitized !== prev && passes < maxPasses);

  return sanitized;
}

/**
 * Decorator to automatically strip dangerous HTML/script injection from strings.
 */
export function SanitizeHtml(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }): unknown =>
    sanitizeHtmlContent(value),
  );
}

/**
 * Neutralizes prompt injection delimiters, control characters, null bytes,
 * and special chat tokens (e.g. <|im_start|>, [INST], <<SYS>>) while preserving legitimate prompt content.
 */
export function sanitizePromptText(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  // Strip null bytes and control characters (except newline \n, tab \t, carriage return \r)
  /* eslint-disable-next-line no-control-regex */
  let sanitized = value.replace(/[\0\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Strip special tokens and chat delimiter injection patterns
  sanitized = sanitized
    .replace(/<\|im_start\|>/gi, '')
    .replace(/<\|im_end\|>/gi, '')
    .replace(/<\|system\|>/gi, '')
    .replace(/<\|user\|>/gi, '')
    .replace(/<\|assistant\|>/gi, '')
    .replace(/\[INST\]/gi, '')
    .replace(/\[\/INST\]/gi, '')
    .replace(/<<SYS>>/gi, '')
    .replace(/<<\/SYS>>/gi, '');

  return trimUnicode(sanitized);
}

/**
 * Decorator to neutralize prompt injection vectors and special token delimiters in AI inputs.
 */
export function SanitizePrompt(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }): unknown =>
    sanitizePromptText(value),
  );
}

/**
 * Regex matching standard whitespace, unicode whitespace, and zero-width/invisible characters:
 * - ASCII whitespace (\s: space, \t, \n, \r, \v, \f)
 * - Zero-width spaces: \u200B (ZWSP), \u200C (ZWNJ), \u200D (ZWJ), \uFEFF (BOM), \u2060 (WJ), \u180E (MVS)
 * - Unicode spaces: \u00A0 (NBSP), \u1680 (Ogham), \u2000-\u200A (En/Em spaces), \u2028/\u2029 (Separators), \u202F (Narrow NBSP), \u205F (Math space), \u3000 (Ideographic space)
 */
export const UNICODE_WHITESPACE_REGEX =
  /^[\s\u200B-\u200D\uFEFF\u2060\u180E\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+|[\s\u200B-\u200D\uFEFF\u2060\u180E\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+$/gu;

/**
 * Safely trims ASCII and Unicode whitespace as well as zero-width invisible characters.
 */
export function trimUnicode(value: string): string {
  return value.replace(UNICODE_WHITESPACE_REGEX, '');
}

/**
 * Decorator to trim ASCII, Unicode, and zero-width whitespace from strings.
 */
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? trimUnicode(value) : value,
  );
}

@ValidatorConstraint({ name: 'isTrimmedNotEmpty', async: false })
export class IsTrimmedNotEmptyConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args?: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;
    const trimmed = trimUnicode(value);
    // Use Unicode code points ([...trimmed].length) to count emoji surrogate pairs accurately without slicing
    const charCount = [...trimmed].length;
    if (charCount === 0) return false;

    const [options] = (args?.constraints ?? []) as [
      { minLength?: number; maxLength?: number } | undefined,
    ];

    if (options?.minLength !== undefined && charCount < options.minLength) {
      return false;
    }
    if (options?.maxLength !== undefined && charCount > options.maxLength) {
      return false;
    }

    return true;
  }

  defaultMessage(args?: ValidationArguments): string {
    const property = args?.property ?? 'Field';
    const [options] = (args?.constraints ?? []) as [
      { minLength?: number; maxLength?: number } | undefined,
    ];
    if (options?.minLength) {
      return `${property} must be at least ${options.minLength} characters (excluding whitespace)`;
    }
    return `${property} should not be empty or contain only whitespace`;
  }
}

/**
 * Validates that a string is not empty after trimming ASCII, Unicode, and zero-width whitespace,
 * with optional minLength and maxLength bounds evaluated over Unicode code points.
 */
export function IsTrimmedNotEmpty(
  options?: { minLength?: number; maxLength?: number },
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [options],
      validator: IsTrimmedNotEmptyConstraint,
    });
  };
}

const ISO_DATE_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-])(\d{2})(?::?(\d{2}))?)?)?$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

/**
 * Validates whether a value is a valid Date object or ISO date string
 * within the safe calendar epoch bounds (1970 - 2100), with strict calendar leap-year verification.
 */
export function isValidSafeDate(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string' && !(value instanceof Date)) return false;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return false;
    const year = value.getUTCFullYear();
    return year >= 1970 && year <= 2100;
  }

  const match = ISO_DATE_REGEX.exec(value);
  if (!match) return false;

  const [
    ,
    yearStr,
    monthStr,
    dayStr,
    hourStr,
    minStr,
    secStr,
    ,
    tzSign,
    tzHoursStr,
    tzMinsStr,
  ] = match;

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (year < 1970 || year > 2100) return false;
  if (month < 1 || month > 12) return false;

  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) return false;

  if (hourStr !== undefined) {
    const hour = parseInt(hourStr, 10);
    const min = parseInt(minStr, 10);
    const sec = parseInt(secStr, 10);

    if (hour < 0 || hour > 23) return false;
    if (min < 0 || min > 59) return false;
    if (sec < 0 || sec > 59) return false;
  }

  if (tzSign !== undefined && tzHoursStr !== undefined) {
    const tzHours = parseInt(tzHoursStr, 10);
    const tzMins = tzMinsStr ? parseInt(tzMinsStr, 10) : 0;

    if (tzMins < 0 || tzMins > 59) return false;
    if (tzSign === '+') {
      if (tzHours > 14 || (tzHours === 14 && tzMins > 0)) return false;
    } else if (tzSign === '-') {
      if (tzHours > 12 || (tzHours === 12 && tzMins > 0)) return false;
    }
  }

  const parsedDate = new Date(value);
  if (isNaN(parsedDate.getTime())) return false;

  const utcYear = parsedDate.getUTCFullYear();
  if (utcYear < 1969 || utcYear > 2101) return false;

  return true;
}

@ValidatorConstraint({ name: 'isSafeDate', async: false })
export class IsSafeDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return isValidSafeDate(value);
  }

  defaultMessage(args?: ValidationArguments): string {
    return `${args?.property ?? 'Date'} must be a valid date between years 1970 and 2100`;
  }
}

/**
 * Validates that an ISO date string or Date object represents a valid date
 * within safe calendar epoch bounds (1970 - 2100).
 */
export function IsSafeDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsSafeDateConstraint,
    });
  };
}
