export type WwdcYear = 2025 | 2026;

export type WwdcConfig = {
  year: WwdcYear;
  weekBeforeStart: string;
  weekBeforeEnd: string;
  startDate: string;
  afterStart: string;
  afterEnd: string;
};

/** WWDC 2025 — datums volgens redactionele periodes. */
export const WWDC_2025: WwdcConfig = {
  year: 2025,
  weekBeforeStart: "2025-06-02",
  weekBeforeEnd: "2025-06-08",
  startDate: "2025-06-09",
  afterStart: "2025-06-10",
  afterEnd: "2025-06-15",
};

/** WWDC 2026 — datums volgens redactionele periodes. */
export const WWDC_2026: WwdcConfig = {
  year: 2026,
  weekBeforeStart: "2026-06-01",
  weekBeforeEnd: "2026-06-07",
  startDate: "2026-06-08",
  afterStart: "2026-06-09",
  afterEnd: "2026-06-14",
};

export const WWDC_BY_YEAR: Record<WwdcYear, WwdcConfig> = {
  2025: WWDC_2025,
  2026: WWDC_2026,
};

export function getWwdcConfig(year: WwdcYear): WwdcConfig {
  return WWDC_BY_YEAR[year];
}

export function parseWwdcYear(raw: string | null): WwdcYear {
  if (raw === "2026") return 2026;
  return 2025;
}

/** Standaard zichtbaar in de tabel; API haalt tot WWDC_TOP_ARTICLES_MAX op. */
export const WWDC_TOP_ARTICLES = 25;
export const WWDC_TOP_ARTICLES_MAX = 50;

export type WwdcPeriodKey = "weekBefore" | "startWwdc" | "afterWwdc";

export function wwdcPeriodDates(
  period: WwdcPeriodKey,
  year: WwdcYear = 2025
): { startDate: string; endDate: string } {
  const config = getWwdcConfig(year);
  switch (period) {
    case "weekBefore":
      return { startDate: config.weekBeforeStart, endDate: config.weekBeforeEnd };
    case "startWwdc":
      return { startDate: config.startDate, endDate: config.startDate };
    case "afterWwdc":
      return { startDate: config.afterStart, endDate: config.afterEnd };
  }
}

export const WWDC_PERIOD_LABELS: Record<WwdcPeriodKey, string> = {
  weekBefore: "Week vóór WWDC",
  startWwdc: "Start WWDC",
  afterWwdc: "Na WWDC",
};
