import { addDays } from "date-fns";

import { getSameIsoWeekLastYear, type IsoWeekRange } from "@/lib/iso-week-range";

/**
 * "Vorig jaar"-tab (voorheen Keynote): wat deed het goed in dezelfde ISO-week vorig jaar?
 * Drie tabs relatief aan vandaag: vorige week, deze week en volgende week, telkens het
 * zelfde weeknummer één ISO-jaar eerder (ma–zo).
 */
export type KeynotePeriodKey = "prevWeek" | "thisWeek" | "nextWeek";

export const KEYNOTE_PERIODS: KeynotePeriodKey[] = ["prevWeek", "thisWeek", "nextWeek"];

const OFFSET_DAYS: Record<KeynotePeriodKey, number> = {
  prevWeek: -7,
  thisWeek: 0,
  nextWeek: 7,
};

export const KEYNOTE_PERIOD_LABELS: Record<KeynotePeriodKey, string> = {
  prevWeek: "Week geleden",
  thisWeek: "Huidige week",
  nextWeek: "Volgende week",
};

/** ISO-week vorig jaar die hoort bij de tab, gerekend vanaf `today`. */
export function keynotePeriodRange(
  period: KeynotePeriodKey,
  today = new Date()
): IsoWeekRange {
  return getSameIsoWeekLastYear(addDays(today, OFFSET_DAYS[period]));
}

export function keynotePeriodDates(
  period: KeynotePeriodKey,
  today = new Date()
): { startDate: string; endDate: string } {
  const { startDate, endDate } = keynotePeriodRange(period, today);
  return { startDate, endDate };
}

export function isKeynotePeriod(raw: string | null): raw is KeynotePeriodKey {
  return raw === "prevWeek" || raw === "thisWeek" || raw === "nextWeek";
}
