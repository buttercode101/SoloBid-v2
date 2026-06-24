export type PublicHoliday = {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties?: string[] | null;
  launchYear?: number | null;
  types?: string[];
};

const holidayCache = new Map<string, PublicHoliday[]>();

export async function getPublicHolidays(year = new Date().getFullYear(), countryCode = 'ZA'): Promise<PublicHoliday[]> {
  const cacheKey = `${countryCode}:${year}`;
  const cached = holidayCache.get(cacheKey);
  if (cached) return cached;

  const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
  if (!response.ok) {
    throw new Error(`Could not load public holidays for ${countryCode} ${year}.`);
  }

  const holidays = (await response.json()) as PublicHoliday[];
  holidayCache.set(cacheKey, holidays);
  return holidays;
}

export async function isPublicHoliday(date: Date, countryCode = 'ZA'): Promise<boolean> {
  const isoDate = date.toISOString().slice(0, 10);
  const holidays = await getPublicHolidays(date.getFullYear(), countryCode);
  return holidays.some((holiday) => holiday.date === isoDate);
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export async function getNextBusinessDay(date: Date, countryCode = 'ZA'): Promise<Date> {
  const next = new Date(date);
  while (isWeekend(next) || await isPublicHoliday(next, countryCode)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export async function addBusinessDays(startDate: Date, businessDays: number, countryCode = 'ZA'): Promise<Date> {
  const result = new Date(startDate);
  let remaining = Math.max(0, businessDays);

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result) && !(await isPublicHoliday(result, countryCode))) {
      remaining -= 1;
    }
  }

  return result;
}
