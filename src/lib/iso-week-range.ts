import {
  endOfISOWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
  setISOWeek,
  setISOWeekYear,
  startOfISOWeek,
} from "date-fns";

export type IsoWeekRange = {
  isoWeek: number;
  isoWeekYear: number;
  startDate: string;
  endDate: string;
};

/** GA4 `isoYearIsoWeek`-dimensie: ISO-jaar + weeknummer (bv. `202515`). */
export function parseIsoYearIsoWeek(
  value: string
): { isoYear: number; isoWeek: number } | null {
  const m = value.match(/^(\d{4})(\d{1,2})$/);
  if (!m) return null;
  const isoYear = parseInt(m[1], 10);
  const isoWeek = parseInt(m[2], 10);
  if (!Number.isFinite(isoYear) || !Number.isFinite(isoWeek) || isoWeek < 1 || isoWeek > 53) {
    return null;
  }
  return { isoYear, isoWeek };
}

export function toIsoYearIsoWeek(isoYear: number, isoWeek: number): string {
  return `${isoYear}${String(isoWeek).padStart(2, "0")}`;
}

export function normalizeIsoYearIsoWeek(value: string): string | null {
  const parsed = parseIsoYearIsoWeek(value);
  if (!parsed) return null;
  return toIsoYearIsoWeek(parsed.isoYear, parsed.isoWeek);
}

/** GSC `date`-dimensie (yyyy-MM-dd) → zelfde sleutel als GA4 `isoYearIsoWeek`. */
export function dateToIsoYearIsoWeek(dateStr: string): string | null {
  try {
    const d = parseISO(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return toIsoYearIsoWeek(getISOWeekYear(d), getISOWeek(d));
  } catch {
    return null;
  }
}

/** Huidige ISO-week (maandag–zondag), bv. week 21 = 18–24 mei. */
export function getCurrentIsoWeekRange(referenceDate = new Date()): IsoWeekRange {
  const isoWeek = getISOWeek(referenceDate);
  const isoWeekYear = getISOWeekYear(referenceDate);
  const start = startOfISOWeek(referenceDate);
  const end = endOfISOWeek(referenceDate);
  return {
    isoWeek,
    isoWeekYear,
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
}

/** Zelfde ISO-weeknummer in het vorige ISO-jaar (voor YoY Discover). */
export function getSameIsoWeekLastYear(referenceDate = new Date()): IsoWeekRange {
  const isoWeek = getISOWeek(referenceDate);
  const isoWeekYear = getISOWeekYear(referenceDate) - 1;
  const anchor = setISOWeek(setISOWeekYear(new Date(), isoWeekYear), isoWeek);
  const start = startOfISOWeek(anchor);
  const end = endOfISOWeek(anchor);
  return {
    isoWeek,
    isoWeekYear,
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
}
