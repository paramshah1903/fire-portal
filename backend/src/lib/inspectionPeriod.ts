/**
 * Given an equipment's inspection frequency, return the period bucket
 * a `reference` date falls into.
 *
 * Phase 5 supports monthly (frequencyDays = 30 by default) buckets:
 *   - periodKey  = "YYYY-MM"
 *   - periodStart = 00:00 on the 1st of that month (UTC)
 *   - periodEnd   = 23:59:59.999 on the last day of that month (UTC)
 *
 * Non-30-day frequencies also collapse to monthly for now; the
 * frequency is preserved in dueDate math. If we ever need weekly /
 * quarterly buckets, this is the single place to change.
 */
export interface Period {
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
}

export function currentPeriod(
  reference: Date = new Date(),
  _frequencyDays = 30,
): Period {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth(); // 0-indexed

  const periodStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  const periodKey = `${year.toString().padStart(4, '0')}-${(month + 1)
    .toString()
    .padStart(2, '0')}`;

  return { periodKey, periodStart, periodEnd };
}

/**
 * Given a period and a frequency in days, return the due date — the
 * latest date the inspection can be completed without being overdue.
 * For monthly cadences we use the last day of the period.
 */
export function computeDueDate(period: Period, frequencyDays: number): Date {
  if (frequencyDays <= 30) return period.periodEnd;
  // For longer cadences, add frequencyDays to periodStart, capped by the
  // end of the following period so the number is sensible.
  const capped = Math.min(
    frequencyDays,
    Math.ceil(
      (period.periodEnd.getTime() - period.periodStart.getTime()) / 86_400_000,
    ) + frequencyDays,
  );
  return new Date(period.periodStart.getTime() + capped * 86_400_000);
}

/**
 * Parse a "YYYY-MM" string into a period. Throws if the format is bad.
 */
export function periodFromKey(key: string): Period {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Invalid periodKey "${key}", expected YYYY-MM.`);
  const year = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10) - 1;
  if (month < 0 || month > 11) {
    throw new Error(`Invalid month in periodKey "${key}".`);
  }
  const reference = new Date(Date.UTC(year, month, 1));
  return currentPeriod(reference);
}

export interface DateRange {
  fromDate: Date;
  toDate: Date;
  /** Every monthly period key touched by [fromDate, toDate]. */
  periodKeys: string[];
}

/**
 * Resolve a caller-supplied filter to a concrete date range.
 *
 *   - If explicit fromDate/toDate are supplied, use them.
 *   - Else if a legacy `periodKey` is supplied, expand it to that month.
 *   - Otherwise default to the current calendar month.
 *
 * The returned `periodKeys` list is convenient for backends that
 * still key data by month (Inspection.periodKey).
 */
export function resolveDateRange(input: {
  fromDate?: string | Date;
  toDate?: string | Date;
  periodKey?: string;
}): DateRange {
  if (!input.fromDate && !input.toDate && input.periodKey) {
    const p = periodFromKey(input.periodKey);
    return {
      fromDate: p.periodStart,
      toDate: p.periodEnd,
      periodKeys: [p.periodKey],
    };
  }

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const monthEnd = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ),
  );

  const fromDate = input.fromDate
    ? new Date(input.fromDate)
    : monthStart;
  const toDate = input.toDate
    ? new Date(
        typeof input.toDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.toDate)
          ? input.toDate + 'T23:59:59.999Z'
          : input.toDate,
      )
    : monthEnd;

  if (Number.isNaN(fromDate.getTime())) {
    throw new Error(`Invalid fromDate "${input.fromDate}".`);
  }
  if (Number.isNaN(toDate.getTime())) {
    throw new Error(`Invalid toDate "${input.toDate}".`);
  }
  if (fromDate.getTime() > toDate.getTime()) {
    throw new Error('fromDate is after toDate.');
  }

  // Enumerate every monthly period the range overlaps.
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1),
  );
  const cutoff = new Date(
    Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), 1),
  );
  while (cursor.getTime() <= cutoff.getTime()) {
    keys.push(
      `${cursor.getUTCFullYear().toString().padStart(4, '0')}-${(cursor.getUTCMonth() + 1)
        .toString()
        .padStart(2, '0')}`,
    );
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return { fromDate, toDate, periodKeys: keys };
}
