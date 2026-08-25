export type KeynoteConfig = {
  year: 2025;
  weekBeforeStart: string;
  weekBeforeEnd: string;
  startDate: string;
  afterStart: string;
  afterEnd: string;
};

/**
 * iPhone-event 9 september 2025 (“Awe Dropping”).
 * Periodes volgen hetzelfde patroon als WWDC: week ervoor, keynotedag, week erna.
 */
export const KEYNOTE_2025: KeynoteConfig = {
  year: 2025,
  weekBeforeStart: "2025-09-02",
  weekBeforeEnd: "2025-09-08",
  startDate: "2025-09-09",
  afterStart: "2025-09-10",
  afterEnd: "2025-09-15",
};

export type KeynotePeriodKey = "weekBefore" | "startWwdc" | "afterWwdc";

export function keynotePeriodDates(
  period: KeynotePeriodKey
): { startDate: string; endDate: string } {
  switch (period) {
    case "weekBefore":
      return { startDate: KEYNOTE_2025.weekBeforeStart, endDate: KEYNOTE_2025.weekBeforeEnd };
    case "startWwdc":
      return { startDate: KEYNOTE_2025.startDate, endDate: KEYNOTE_2025.startDate };
    case "afterWwdc":
      return { startDate: KEYNOTE_2025.afterStart, endDate: KEYNOTE_2025.afterEnd };
  }
}

export const KEYNOTE_PERIOD_LABELS: Record<KeynotePeriodKey, string> = {
  weekBefore: "Week vóór keynote",
  startWwdc: "Start keynote",
  afterWwdc: "Na keynote",
};
