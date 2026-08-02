// Small date/format helpers. Kept UI-agnostic and dependency-free.

const DAY = 24 * 60 * 60 * 1000;

/** Whole days from now until an ISO date (negative if past). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(iso + "T00:00:00");
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / DAY);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** e.g. "Tue 8 Sep" */
export function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** e.g. "TUE 8 SEP" */
export function formatKicker(iso: string): string {
  return formatShortDate(iso).toUpperCase();
}

/** e.g. "21:14" from an ISO timestamp */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
