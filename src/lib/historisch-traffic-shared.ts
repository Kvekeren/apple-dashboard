/** Zelfde venster als funnel: 2024-01 t/m laatste volledige kalendermaand. */
export { getHistorischFunnelRange as getHistorischTrafficMonthRange } from "@/lib/historisch-funnel-shared";
export { formatYearMonthDisplay } from "@/lib/historisch-funnel-shared";

export interface HistorischTrafficMonthRow {
  yearMonth: string;
  sessions: number;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  screenPageViews: number;
  /** Alleen gevuld als de Data API een aparte `views`-metric accepteert; anders `null`. */
  views: number | null;
  new_user_share: number | null;
  views_per_session: number | null;
  views_per_user: number | null;
}

export interface HistorischTrafficTechnicalMeta {
  tableMonthCount: number;
  expectedMonthCount: number;
  startMonth: string;
  endMonth: string;
  sequenceComplete: boolean;
  /** Maanden zonder enige ruwe GA4-rij (in tabel als 0). */
  missingRawYearMonths: string[];
  metricsUsed: string[];
  viewsMetricAvailable: boolean;
  activeUsersRequested: boolean;
  coreMetricsWithData: {
    sessions: boolean;
    totalUsers: boolean;
    newUsers: boolean;
    screenPageViews: boolean;
  };
  /** Ten minste één maand met newUsers &gt; 0. */
  newUsersAnyPositive: boolean;
  /** Geen enkele maand met newUsers &gt; 0. */
  newUsersAllZero: boolean;
  /** Er is een maand waarin newUsers &gt; totalUsers (onverwacht). */
  newUsersExceedsTotalUsersAnyMonth: boolean;
}

export interface HistorischTrafficMonthlyReport {
  generatedAt: string;
  brand: string;
  propertyEnvKey: string;
  dateRange: { startDate: string; endDate: string };
  rows: HistorischTrafficMonthRow[];
  technical: HistorischTrafficTechnicalMeta;
  /** API-/configfouten (geen GA4-payload). */
  error?: string;
  apiNote?: string;
}
