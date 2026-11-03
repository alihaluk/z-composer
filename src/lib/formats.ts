// Culture-independent format codes (docs/OUTPUT_SPEC.md section 6).

export const INVARIANT_LOCALE = 'en-US';

const NUMBER_CODE = /^([NF])(\d)$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/;

export const NUMBER_FORMATS = ['N0', 'N2', 'F0', 'F2'] as const;
export const DATE_FORMATS = ['d', 'D', 't', 'g', 'dd.MM.yyyy', 'yyyy-MM-dd', 'HH:mm'] as const;

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(value)) return Number(value);
  return null;
}

function toDateParts(value: unknown) {
  if (typeof value !== 'string') return null;
  const m = ISO_DATE.exec(value);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
  return { y, mo, d, h, mi, s, date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) };
}

function customPattern(pattern: string, p: NonNullable<ReturnType<typeof toDateParts>>): string {
  const tokens: Record<string, string> = {
    yyyy: p.y, yy: p.y.slice(2), MM: p.mo, M: String(+p.mo), dd: p.d, d: String(+p.d),
    HH: p.h, H: String(+p.h), mm: p.mi, ss: p.s,
  };
  return pattern.replace(/yyyy|yy|MM|M|dd|d|HH|H|mm|ss/g, t => tokens[t]);
}

/** Formats a value; returns null when the format does not apply to it. */
export function formatValue(value: unknown, format: string, locale: string, invariant = false): string | null {
  const loc = invariant ? INVARIANT_LOCALE : locale;
  const numberCode = NUMBER_CODE.exec(format);
  if (numberCode) {
    let n = toNumber(value);
    if (n === null) return null;
    const digits = +numberCode[2];
    // A value that rounds to zero prints without a minus sign (docs/OUTPUT_SPEC.md 6.1).
    if (Math.abs(n) < 0.5 / 10 ** digits) n = 0;
    return new Intl.NumberFormat(loc, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: numberCode[1] === 'N' }).format(n);
  }

  const parts = toDateParts(value);
  if (!parts) return null;
  const date = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { ...options, timeZone: 'UTC' }).format(parts.date);
  const shortDate = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  switch (format) {
    case 'd': return date(shortDate);
    case 'D': return date({ dateStyle: 'full' });
    case 't': return date({ timeStyle: 'short' });
    case 'g': return `${date(shortDate)} ${date({ timeStyle: 'short' })}`;
    default: return format.length > 1 ? customPattern(format, parts) : null;
  }
}

/** Canonical form of a culture name the browser can format with, or null. */
export function canonicalCulture(value: string): string | null {
  try {
    const [canonical] = Intl.getCanonicalLocales(value.trim());
    return canonical && Intl.NumberFormat.supportedLocalesOf(canonical).length > 0 ? canonical : null;
  } catch {
    return null;
  }
}
