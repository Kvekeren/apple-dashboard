export const HISTORISCH_FUNNEL_BRAND = "Historisch Nieuwsblad";

export const HISTORISCH_FUNNEL_EVENTS = [
  "paywall_view",
  "paywall_abonneren",
  "paywall_inloggen",
  "nieuwsbrief_inschrijving_artikelen",
] as const;

export type HistorischFunnelEventName = (typeof HISTORISCH_FUNNEL_EVENTS)[number];

/** GA4 `yearMonth`: meestal `YYYYMM` (bijv. `202401`). */
export function formatYearMonthDisplay(ymCompact: string): string {
  const s = ymCompact.replace(/\D/g, "");
  if (s.length >= 6) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}`;
  }
  return ymCompact;
}

export function enumerateYearMonthsInclusive(startYmCompact: string, endYmCompact: string): string[] {
  const norm = (x: string) => x.replace(/\D/g, "");
  const a = norm(startYmCompact);
  const b = norm(endYmCompact);
  if (a.length < 6 || b.length < 6) return [];

  let y = parseInt(a.slice(0, 4), 10);
  let m = parseInt(a.slice(4, 6), 10);
  const endY = parseInt(b.slice(0, 4), 10);
  const endM = parseInt(b.slice(4, 6), 10);

  if (y * 100 + m > endY * 100 + endM) return [];

  const out: string[] = [];
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function getHistorischFunnelRange(reference: Date = new Date()): {
  startDate: string;
  endDate: string;
  startYmCompact: string;
  endYmCompact: string;
  expectedMonths: string[];
} {
  const startYmCompact = "202401";
  const startDate = "2024-01-01";

  const lastFull = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const endY = lastFull.getFullYear();
  const endM = lastFull.getMonth() + 1;
  const endYmCompact = `${endY}${String(endM).padStart(2, "0")}`;
  const endDay = new Date(endY, endM, 0).getDate();
  const endDate = `${endY}-${String(endM).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

  const expectedMonths = enumerateYearMonthsInclusive(startYmCompact, endYmCompact);

  return { startDate, endDate, startYmCompact, endYmCompact, expectedMonths };
}

export interface HistorischFunnelMonthRow {
  yearMonth: string;
  paywall_view: number;
  paywall_abonneren: number;
  paywall_inloggen: number;
  nieuwsbrief_inschrijving_artikelen: number;
  paywall_abonneer_ratio: number | null;
  paywall_login_ratio: number | null;
  nieuwsbrief_per_paywall_view: number | null;
}

export interface HistorischFunnelTechnicalMeta {
  tableMonthCount: number;
  expectedMonthCount: number;
  startMonth: string;
  endMonth: string;
  eventsWithData: Record<HistorischFunnelEventName, boolean>;
  allFourEventsHaveData: boolean;
  sequenceComplete: boolean;
  missingMonths: string[];
}

export interface HistorischFunnelMonthlyReport {
  generatedAt: string;
  brand: string;
  propertyEnvKey: string;
  dateRange: { startDate: string; endDate: string };
  rows: HistorischFunnelMonthRow[];
  technical: HistorischFunnelTechnicalMeta;
  error?: string;
}
