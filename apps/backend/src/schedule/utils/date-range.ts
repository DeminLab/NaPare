export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function getDayRange(date: string): DateRange {
  const startDate = new Date(date);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 1);
  return { startDate, endDate };
}

/** Date-only end bounds include the full UTC day; explicit timestamps stay exact. */
export function getInclusiveDateBounds(startDate: string, endDate: string): [Date, Date] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) end.setUTCHours(23, 59, 59, 999);
  return [start, end];
}
