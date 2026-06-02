import type { ConversionEventGroupId } from "@/config/conversion-events";

export interface ConversionMetricValue {
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
  /** Ratio-waarde (bijv. % of per 1000 PV), indien van toepassing */
  ratio?: number | null;
  ratioPrevious?: number | null;
  ratioLabel?: string;
  /** Dagelijkse waarden voor mini-trend (huidige periode) */
  sparkline?: number[];
}

export type ConversionDisplayFormat = "count" | "percent" | "duration" | "decimal";

export interface ConversionMetricCard {
  id: string;
  label: string;
  metric: ConversionMetricValue;
  format: "number" | "percent" | "currency" | "ratio" | "duration" | "decimal";
  unavailable?: boolean;
  unavailableReason?: string;
}

export interface ConversionEventRow {
  eventName: string;
  eventLabel: string;
  eventGroup: ConversionEventGroupId | "other";
  /** `metric` = GA4-sessiemetric, geen event-detail */
  rowKind?: "event" | "metric";
  displayFormat?: ConversionDisplayFormat;
  clickable?: boolean;
  eventCount: number;
  totalUsers: number;
  eventsPerUser: number | null;
  conversionRate: number | null;
  revenue: number;
  previous: {
    eventCount: number;
    totalUsers: number;
    revenue: number;
  };
  change: number;
  changePercent: number | null;
  /** Dagelijkse eventCount voor trend-kolom */
  dailyTrend: number[];
}

export interface ConversionFunnelStep {
  eventName: string;
  label: string;
  count: number;
  rateFromPrevious: number | null;
  rateFromFirst: number | null;
}

export interface ConversionFunnelResult {
  id: string;
  label: string;
  steps: ConversionFunnelStep[];
}

export interface TopConversionPageRow {
  url: string;
  pageTitle: string;
  pageviews: number;
  conversions: number;
  conversionRate: number | null;
  affiliateClicks: number;
  revenue: number;
  topEvent: string;
  topEventLabel: string;
  previousConversions: number;
  changePercent: number | null;
}

export interface ConversionTrendPoint {
  date: string;
  eventCount: number;
  pageviews: number;
  ratioPer1000Pv: number | null;
}

export interface ConversionEngagementMetricDetail {
  metricId: string;
  label: string;
  format: ConversionDisplayFormat;
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
  compareMode: ConversionCompareMode;
  periods: {
    current: { startDate: string; endDate: string };
    previous: { startDate: string; endDate: string };
  };
  trend: { date: string; value: number }[];
}

export interface ConversionEventDetail {
  eventName: string;
  eventLabel: string;
  eventGroup: ConversionEventGroupId | "other";
  eventCount: number;
  totalUsers: number;
  eventsPerUser: number | null;
  conversionRate: number | null;
  revenue: number;
  trend: ConversionTrendPoint[];
  topPages: { url: string; pageTitle: string; eventCount: number }[];
  topSources: { source: string; eventCount: number }[];
  devices: { device: string; eventCount: number; share: number }[];
}

export interface ConversionSummaryPayload {
  meta: {
    brandId: string;
    brandLabel: string;
    hasGa4Property: boolean;
    compareMode: "previous" | "yoy";
    groupFilter: string;
    periods: {
      current: { startDate: string; endDate: string };
      previous: { startDate: string; endDate: string };
    };
  };
  baseMetrics: {
    pageviews: ConversionMetricValue;
    sessions: ConversionMetricValue;
  };
  kpis: ConversionMetricCard[];
  events: ConversionEventRow[];
  funnels: ConversionFunnelResult[];
  topPages: TopConversionPageRow[];
}

export type ConversionPeriodPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "28d"
  | "ytd"
  | "custom";

export type ConversionCompareMode = "previous" | "yoy";

export interface ConversionTrendPayload {
  meta: {
    brandId: string;
    brandLabel: string;
    eventName: string;
    eventLabel: string;
    granularity: "day" | "week" | "month";
    startDate: string;
    endDate: string;
  };
  points: ConversionTrendPoint[];
}
