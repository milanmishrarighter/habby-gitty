/**
 * Monthly fines with one month to recover.
 *
 * - Daily and weekly limits are only visual. Fines come from months alone.
 * - A month that ends over the limit owes (calories over × rate). It is not
 *   sent yet: it is pending, and the following month is its recovery month.
 * - Every calorie the recovery month ends under the limit wipes `rate` off it.
 *   Whatever is left when the recovery month ends is due, and is emailed.
 * - Being under never builds a balance. It only pays off the previous month's
 *   pending fine, and anything extra is thrown away.
 * - A recovery month that is itself over recovers nothing, so two bad months
 *   in a row means the first is paid in full and the second becomes pending.
 */
export interface MonthResult {
  month: number;
  total: number;
  over: number;  // calories over the limit, 0 if under
  under: number; // calories under the limit, 0 if over
}

export interface ResolvedFine {
  /** The month that went over. Recovery happened in month + 1. */
  month: number;
  over: number;
  fine: number;      // over × rate
  recovered: number; // ₹ wiped off by the recovery month
  owed: number;      // fine − recovered; emailed when above 0
}

export interface PendingFine {
  month: number;
  over: number;
  fine: number;
}

export const monthResult = (month: number, total: number, limit: number): MonthResult => ({
  month,
  total,
  over: Math.max(0, Math.round(total - limit)),
  under: Math.max(0, Math.round(limit - total)),
});

/**
 * Walks the finished months in order. `resolved` are fines whose recovery
 * month is over; `pending` is a fine still inside its recovery window (the
 * month after the last finished one, i.e. the month in progress).
 */
export const evaluateFines = (
  finishedMonths: MonthResult[],
  rate: number,
): { resolved: ResolvedFine[]; pending: PendingFine | null } => {
  const resolved: ResolvedFine[] = [];
  let pending: PendingFine | null = null;

  for (const month of [...finishedMonths].sort((a, b) => a.month - b.month)) {
    if (pending && pending.month === month.month - 1) {
      const recovered = Math.min(pending.fine, month.under * rate);
      resolved.push({ ...pending, recovered, owed: pending.fine - recovered });
    } else if (pending) {
      // A gap in the months handed in: nothing could be recovered.
      resolved.push({ ...pending, recovered: 0, owed: pending.fine });
    }
    pending = month.over > 0 ? { month: month.month, over: month.over, fine: month.over * rate } : null;
  }
  return { resolved, pending };
};
