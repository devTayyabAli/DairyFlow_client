/**
 * Utility for Pakistani dairy farm Friday-to-Thursday weekly billing cycles.
 * Standard farming convention runs settlements from Friday morning to Thursday evening.
 */

export interface FridayToThursdayWeek {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string; // "09 Oct – 15 Oct 2026 (Fri–Thu)"
}

/**
 * Calculates the Friday-to-Thursday settlement period for a given week offset from a reference date.
 * Uses local calendar date arithmetic (at noon 12:00:00) to ensure complete immunity to DST,
 * midnight boundaries, and UTC offset shifts.
 * 
 * @param referenceDate Optional anchor date. Defaults to current date (or 2026-10-15 if today is demo date).
 * @param weekOffset Number of weeks forward (+) or backward (-) from referenceDate.
 */
export function getFridayToThursdayWeek(
  referenceDate?: Date | string,
  weekOffset: number = 0
): FridayToThursdayWeek {
  let base: Date;
  if (!referenceDate) {
    base = new Date();
  } else if (typeof referenceDate === 'string') {
    const parts = referenceDate.split('-');
    if (parts.length === 3) {
      base = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
        12,
        0,
        0
      );
    } else {
      base = new Date(referenceDate);
    }
  } else {
    base = new Date(referenceDate);
  }

  // Set to noon local time to prevent boundary/DST shifts
  const target = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
  target.setDate(target.getDate() + weekOffset * 7);

  // Day of week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Diff to preceding Friday:
  // Friday (5) -> 0 days back
  // Saturday (6) -> 1 day back
  // Sunday (0) -> 2 days back
  // Monday (1) -> 3 days back
  // Tuesday (2) -> 4 days back
  // Wednesday (3) -> 5 days back
  // Thursday (4) -> 6 days back
  const day = target.getDay();
  const diffToFriday = (day + 2) % 7;

  const friday = new Date(target.getFullYear(), target.getMonth(), target.getDate() - diffToFriday, 12, 0, 0);
  const thursday = new Date(friday.getFullYear(), friday.getMonth(), friday.getDate() + 6, 12, 0, 0);

  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayNum}`;
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatShort = (d: Date) => {
    const dayNum = String(d.getDate()).padStart(2, '0');
    return `${dayNum} ${months[d.getMonth()]}`;
  };

  const fridayStr = formatShort(friday);
  const thursdayStr = formatShort(thursday);
  const year = thursday.getFullYear();

  return {
    startDate: formatYMD(friday),
    endDate: formatYMD(thursday),
    label: `${fridayStr} – ${thursdayStr} ${year} (Fri–Thu)`,
  };
}
