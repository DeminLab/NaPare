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
