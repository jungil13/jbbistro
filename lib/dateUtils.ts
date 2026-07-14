import { format, parse } from "date-fns";

/**
 * Format a date string (YYYY-MM-DD) to "MMMM d, yyyy"
 * e.g. "2027-07-14" → "July 14, 2027"
 */
export function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), "MMMM d, yyyy");
  } catch {
    return dateStr;
  }
}

/**
 * Format a time string (HH:mm or HH:mm:ss) to "h:mm a"
 * e.g. "17:51:00" → "5:51 PM"
 */
export function formatTime(timeStr: string): string {
  if (!timeStr) return "—";
  try {
    // Parse time-only string using a dummy date
    const parsed = parse(timeStr.slice(0, 5), "HH:mm", new Date());
    return format(parsed, "h:mm a");
  } catch {
    return timeStr;
  }
}

/**
 * Format a full datetime string to "MMMM d, yyyy h:mm a"
 * e.g. "2027-07-14T10:56:00Z" → "July 14, 2027 10:56 AM"
 */
export function formatDateTime(dateTimeStr: string): string {
  try {
    return format(new Date(dateTimeStr), "MMMM d, yyyy h:mm a");
  } catch {
    return dateTimeStr;
  }
}
