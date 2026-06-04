/** WWDC 2025 — datums volgens redactionele periodes. */
export const WWDC_2025 = {
  year: 2025,
  weekBeforeStart: "2025-06-02",
  weekBeforeEnd: "2025-06-08",
  startDate: "2025-06-09",
  afterStart: "2025-06-10",
  afterEnd: "2025-06-15",
} as const;

/** Standaard zichtbaar in de tabel; API haalt tot WWDC_TOP_ARTICLES_MAX op. */
export const WWDC_TOP_ARTICLES = 25;
export const WWDC_TOP_ARTICLES_MAX = 50;

export type WwdcPeriodKey = "weekBefore" | "startWwdc" | "afterWwdc";

export function wwdcPeriodDates(period: WwdcPeriodKey): { startDate: string; endDate: string } {
  switch (period) {
    case "weekBefore":
      return { startDate: WWDC_2025.weekBeforeStart, endDate: WWDC_2025.weekBeforeEnd };
    case "startWwdc":
      return { startDate: WWDC_2025.startDate, endDate: WWDC_2025.startDate };
    case "afterWwdc":
      return { startDate: WWDC_2025.afterStart, endDate: WWDC_2025.afterEnd };
  }
}

export const WWDC_PERIOD_LABELS: Record<WwdcPeriodKey, string> = {
  weekBefore: "Week vóór WWDC",
  startWwdc: "Start WWDC",
  afterWwdc: "Na WWDC",
};
