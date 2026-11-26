import { google } from "googleapis";

import {
  eventNamesForBrand,
  getBrandConversionConfig,
  type ConversionEventGroupId,
} from "@/config/conversion-events";
import type { SiteTitleId } from "@/lib/site-titles";
import { getTitleById } from "@/lib/site-titles";

export interface GA4EventRow {
  eventName: string;
  eventCount: number;
  totalUsers: number;
  revenue: number;
}

export interface GA4EventDailyRow extends GA4EventRow {
  date: string;
}

export interface GA4PageEventRow {
  pageLocation: string;
  pageTitle: string;
  eventName: string;
  eventCount: number;
  revenue: number;
}

export interface GA4DimensionBreakdownRow {
  dimension: string;
  eventCount: number;
}

function getPropertyId(brandId: SiteTitleId): string | undefined {
  return getTitleById(brandId)?.ga4PropertyId;
}

function createClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.analyticsdata({ version: "v1beta", auth });
}

function parseEventRow(row: {
  dimensionValues?: { value?: string | null }[] | null;
  metricValues?: { value?: string | null }[] | null;
}): GA4EventRow | null {
  const eventName = row.dimensionValues?.[0]?.value ?? "";
  if (!eventName) return null;
  return {
    eventName,
    eventCount: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    totalUsers: parseInt(row.metricValues?.[1]?.value ?? "0", 10),
    revenue: parseFloat(row.metricValues?.[2]?.value ?? "0"),
  };
}

function eventNameFilter(values: string[]) {
  if (values.length === 0) return undefined;
  if (values.length === 1) {
    return {
      filter: {
        fieldName: "eventName",
        stringFilter: { matchType: "EXACT" as const, value: values[0]! },
      },
    };
  }
  return {
    filter: {
      fieldName: "eventName",
      inListFilter: { values },
    },
  };
}

export interface GA4BaseMetrics {
  pageviews: number;
  sessions: number;
  averageSessionDuration: number;
  engagementRate: number;
  averageEngagementTime: number;
  screenPageViewsPerSession: number;
  engagedSessions: number;
}

export interface GA4BaseMetricsDailyRow extends GA4BaseMetrics {
  date: string;
}

export const EMPTY_GA4_BASE_METRICS: GA4BaseMetrics = {
  pageviews: 0,
  sessions: 0,
  averageSessionDuration: 0,
  engagementRate: 0,
  averageEngagementTime: 0,
  screenPageViewsPerSession: 0,
  engagedSessions: 0,
};

/** GA4-schema: `averageEngagementTime` bestaat alleen als expressie, niet als losse metric. */
const GA4_BASE_METRIC_DEFS: { name: string; expression?: string }[] = [
  { name: "screenPageViews" },
  { name: "sessions" },
  { name: "averageSessionDuration" },
  { name: "engagementRate" },
  { name: "averageEngagementTime", expression: "userEngagementDuration/sessions" },
  { name: "screenPageViewsPerSession" },
  { name: "engagedSessions" },
];

function ga4BaseMetricRequestBody() {
  return GA4_BASE_METRIC_DEFS.map((m) =>
    m.expression ? { name: m.name, expression: m.expression } : { name: m.name }
  );
}

function parseGa4BaseMetricsRow(
  metricValues?: { value?: string | null }[] | null
): GA4BaseMetrics {
  const num = (i: number) => parseFloat(metricValues?.[i]?.value ?? "0");
  const engagementRateRaw = num(3);
  const raw: GA4BaseMetrics = {
    pageviews: Math.round(num(0)),
    sessions: Math.round(num(1)),
    averageSessionDuration: num(2),
    engagementRate: engagementRateRaw <= 1 ? engagementRateRaw * 100 : engagementRateRaw,
    averageEngagementTime: num(4),
    screenPageViewsPerSession: num(5),
    engagedSessions: Math.round(num(6)),
  };
  return normalizeGa4BaseMetrics(raw);
}

/** Vul afgeleide waarden in als GA4 0 teruggeeft maar PV/sessies wel heeft. */
function normalizeGa4BaseMetrics(metrics: GA4BaseMetrics): GA4BaseMetrics {
  const out = { ...metrics };
  if (out.sessions > 0) {
    if (out.screenPageViewsPerSession <= 0) {
      out.screenPageViewsPerSession = out.pageviews / out.sessions;
    }
    if (out.engagementRate <= 0 && out.engagedSessions > 0) {
      out.engagementRate = (out.engagedSessions / out.sessions) * 100;
    }
  }
  return out;
}

export async function fetchGA4BaseMetrics(
  accessToken: string,
  brandId: SiteTitleId,
  startDate: string,
  endDate: string
): Promise<GA4BaseMetrics> {
  const propertyId = getPropertyId(brandId);
  if (!propertyId) return { ...EMPTY_GA4_BASE_METRICS };

  const analyticsdata = createClient(accessToken);
  try {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        metrics: ga4BaseMetricRequestBody(),
        dateRanges: [{ startDate, endDate }],
      },
    });
    return parseGa4BaseMetricsRow(data.rows?.[0]?.metricValues);
  } catch (err) {
    console.error(`GA4 base metrics failed for ${brandId}:`, err);
    return { ...EMPTY_GA4_BASE_METRICS };
  }
}

export async function fetchGA4BaseMetricsDaily(
  accessToken: string,
  brandId: SiteTitleId,
  startDate: string,
  endDate: string
): Promise<GA4BaseMetricsDailyRow[]> {
  const propertyId = getPropertyId(brandId);
  if (!propertyId) return [];

  const analyticsdata = createClient(accessToken);
  try {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: "date" }],
        metrics: ga4BaseMetricRequestBody(),
        dateRanges: [{ startDate, endDate }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      },
    });
    return (data.rows ?? [])
      .map((row) => {
        const date = row.dimensionValues?.[0]?.value ?? "";
        if (!date) return null;
        return { date, ...parseGa4BaseMetricsRow(row.metricValues) };
      })
      .filter((r): r is GA4BaseMetricsDailyRow => r != null);
  } catch (err) {
    console.error(`GA4 base metrics daily failed for ${brandId}:`, err);
    return [];
  }
}

export async function fetchGA4EventsByName(
  accessToken: string,
  brandId: SiteTitleId,
  startDate: string,
  endDate: string,
  eventNames?: string[]
): Promise<GA4EventRow[]> {
  const propertyId = getPropertyId(brandId);
  if (!propertyId) return [];

  const names = eventNames ?? eventNamesForBrand(brandId);
  const analyticsdata = createClient(accessToken);

  try {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: "eventName" }],
        metrics: [
          { name: "eventCount" },
          { name: "totalUsers" },
          { name: "totalRevenue" },
        ],
        dateRanges: [{ startDate, endDate }],
        dimensionFilter: eventNameFilter(names),
        limit: "500",
      },
    });

    const rows: GA4EventRow[] = [];
    for (const row of data.rows ?? []) {
      const parsed = parseEventRow(row);
      if (parsed) rows.push(parsed);
    }
    return rows;
  } catch (err) {
    console.error(`GA4 events by name failed for ${brandId}:`, err);
    return [];
  }
}

export async function fetchGA4EventsDaily(
  accessToken: string,
  brandId: SiteTitleId,
  startDate: string,
  endDate: string,
  eventNames: string[]
): Promise<GA4EventDailyRow[]> {
  const propertyId = getPropertyId(brandId);
  if (!propertyId || eventNames.length === 0) return [];

  const analyticsdata = createClient(accessToken);
  try {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: "date" }, { name: "eventName" }],
        metrics: [
          { name: "eventCount" },
          { name: "totalUsers" },
          { name: "totalRevenue" },
        ],
        dateRanges: [{ startDate, endDate }],
        dimensionFilter: eventNameFilter(eventNames),
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: "10000",
      },
    });

    const rows: GA4EventDailyRow[] = [];
    for (const row of data.rows ?? []) {
      const dateRaw = row.dimensionValues?.[0]?.value ?? "";
      const date =
        dateRaw.length === 8
          ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
          : dateRaw;
      const parsed = parseEventRow({
        dimensionValues: [{ value: row.dimensionValues?.[1]?.value ?? "" }],
        metricValues: row.metricValues,
      });
      if (parsed && date) rows.push({ ...parsed, date });
    }
    return rows;
  } catch (err) {
    console.error(`GA4 daily events failed for ${brandId}:`, err);
    return [];
  }
}

export async function fetchGA4PageviewsDaily(
  accessToken: string,
  brandId: SiteTitleId,
  startDate: string,
  endDate: string
): Promise<{ date: string; pageviews: number }[]> {
  const propertyId = getPropertyId(brandId);
  if (!propertyId) return [];

  const analyticsdata = createClient(accessToken);
  try {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: "date" }],
        metrics: [{ name: "screenPageViews" }],
        dateRanges: [{ startDate, endDate }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      },
    });

    return (data.rows ?? []).map((row) => {
      const dateRaw = row.dimensionValues?.[0]?.value ?? "";
      const date =
        dateRaw.length === 8
          ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
          : dateRaw;
      return {
        date,
        pageviews: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      };
    });
  } catch (err) {
    console.error(`GA4 daily pageviews failed for ${brandId}:`, err);
    return [];
  }
}

export async function fetchGA4EventsByPage(
  accessToken: string,
  brandId: SiteTitleId,
  startDate: string,
  endDate: string,
  eventNames: string[],
  limit = 200
): Promise<GA4PageEventRow[]> {
  const propertyId = getPropertyId(brandId);
  if (!propertyId || eventNames.length === 0) return [];

  const analyticsdata = createClient(accessToken);
  try {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: "pageLocation" }, { name: "pageTitle" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "totalRevenue" }],
        dateRanges: [{ startDate, endDate }],
        dimensionFilter: eventNameFilter(eventNames),
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: String(limit),
      },
    });

    return (data.rows ?? []).map((row) => ({
      pageLocation: row.dimensionValues?.[0]?.value ?? "",
      pageTitle: row.dimensionValues?.[1]?.value ?? "",
      eventName: row.dimensionValues?.[2]?.value ?? "",
      eventCount: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      revenue: parseFloat(row.metricValues?.[1]?.value ?? "0"),
    }));
  } catch (err) {
    console.error(`GA4 events by page failed for ${brandId}:`, err);
    return [];
  }
}

export async function fetchGA4PageviewsByPage(
  accessToken: string,
  brandId: SiteTitleId,
  startDate: string,
  endDate: string,
  limit = 200
): Promise<{ pageLocation: string; pageTitle: string; pageviews: number }[]> {
  const propertyId = getPropertyId(brandId);
  if (!propertyId) return [];

  const analyticsdata = createClient(accessToken);
  try {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: "pageLocation" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }],
        dateRanges: [{ startDate, endDate }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: String(limit),
      },
    });

    return (data.rows ?? []).map((row) => ({
      pageLocation: row.dimensionValues?.[0]?.value ?? "",
      pageTitle: row.dimensionValues?.[1]?.value ?? "",
      pageviews: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    }));
  } catch (err) {
    console.error(`GA4 pageviews by page failed for ${brandId}:`, err);
    return [];
  }
}

type TrendGranularity = "day" | "week" | "month";

function trendDimension(granularity: TrendGranularity): string {
  if (granularity === "week") return "isoYearIsoWeek";
  if (granularity === "month") return "yearMonth";
  return "date";
}

export async function fetchGA4EventTrend(
  accessToken: string,
  brandId: SiteTitleId,
  startDate: string,
  endDate: string,
  eventNames: string[],
  granularity: TrendGranularity
): Promise<{ key: string; eventCount: number; pageviews: number }[]> {
  const propertyId = getPropertyId(brandId);
  if (!propertyId || eventNames.length === 0) return [];

  const dim = trendDimension(granularity);
  const analyticsdata = createClient(accessToken);

  const [eventData, pvData] = await Promise.all([
    analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: dim }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dateRanges: [{ startDate, endDate }],
        dimensionFilter: eventNameFilter(eventNames),
        orderBys: [{ dimension: { dimensionName: dim } }],
        limit: "10000",
      },
    }),
    analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: dim }],
        metrics: [{ name: "screenPageViews" }],
        dateRanges: [{ startDate, endDate }],
        orderBys: [{ dimension: { dimensionName: dim } }],
        limit: "10000",
      },
    }),
  ]);

  const pvByKey = new Map<string, number>();
  for (const row of pvData.data.rows ?? []) {
    const key = row.dimensionValues?.[0]?.value ?? "";
    pvByKey.set(key, parseInt(row.metricValues?.[0]?.value ?? "0", 10));
  }

  const eventByKey = new Map<string, number>();
  for (const row of eventData.data.rows ?? []) {
    const key = row.dimensionValues?.[0]?.value ?? "";
    const count = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    eventByKey.set(key, (eventByKey.get(key) ?? 0) + count);
  }

  const keys = [...new Set([...pvByKey.keys(), ...eventByKey.keys()])].sort();
  return keys.map((key) => ({
    key,
    eventCount: eventByKey.get(key) ?? 0,
    pageviews: pvByKey.get(key) ?? 0,
  }));
}

export async function fetchGA4EventBreakdown(
  accessToken: string,
  brandId: SiteTitleId,
  startDate: string,
  endDate: string,
  eventName: string,
  dimension: "sessionSourceMedium" | "deviceCategory"
): Promise<GA4DimensionBreakdownRow[]> {
  const propertyId = getPropertyId(brandId);
  if (!propertyId) return [];

  const analyticsdata = createClient(accessToken);
  try {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: dimension }],
        metrics: [{ name: "eventCount" }],
        dateRanges: [{ startDate, endDate }],
        dimensionFilter: eventNameFilter([eventName]),
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: "20",
      },
    });

    return (data.rows ?? []).map((row) => ({
      dimension: row.dimensionValues?.[0]?.value ?? "(not set)",
      eventCount: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    }));
  } catch (err) {
    console.error(`GA4 event breakdown (${dimension}) failed for ${brandId}:`, err);
    return [];
  }
}

export function formatTrendKey(key: string, granularity: TrendGranularity): string {
  if (granularity === "day" && key.length === 8) {
    return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
  }
  if (granularity === "month" && key.length === 6) {
    return `${key.slice(0, 4)}-${key.slice(4, 6)}`;
  }
  return key;
}

export function sumEventCounts(
  rows: GA4EventRow[],
  names: string[]
): number {
  const set = new Set(names);
  return rows.filter((r) => set.has(r.eventName)).reduce((s, r) => s + r.eventCount, 0);
}

export function getEventCount(rows: GA4EventRow[], name: string): number {
  return rows.find((r) => r.eventName === name)?.eventCount ?? 0;
}

export function getEventRevenue(rows: GA4EventRow[], name: string): number {
  return rows.find((r) => r.eventName === name)?.revenue ?? 0;
}

export const AFFILIATE_EVENT_NAMES: Record<SiteTitleId, string[]> = {
  icreate: [
    "clickout_affiliate",
    "clickout_affiliate_tekstlink",
    "clickout_prijsvergelijker",
    "clickout_mshop",
    "click_productblok",
    "click_producttegel",
  ],
  iphoned: ["wct_click", "uitklikken"],
  iculture: ["wct_click", "uitklikken"],
  androidplanet: ["wct_click", "uitklikken"],
  androidworld: ["wct_click", "uitklikken"],
};

/** BigSpark-titels sturen scroll_25/50/75/90; scroll_75 = "pagina grotendeels gelezen". */
export const SCROLL_EVENT_NAMES: Record<SiteTitleId, string[]> = {
  icreate: ["25% scroll", "50% scroll", "75% scroll", "90% scroll", "read_article_end"],
  iphoned: ["scroll_75"],
  iculture: ["scroll_75"],
  androidplanet: ["scroll_75"],
  androidworld: ["scroll_75"],
};

export const INTERNAL_CLICK_NAMES: Record<SiteTitleId, string[]> = {
  icreate: [],
  iphoned: ["doorklikken", "click", "filters"],
  iculture: ["doorklikken", "click"],
  androidplanet: ["doorklikken", "click", "filters"],
  androidworld: ["doorklikken", "click", "filters"],
};

export const OUTBOUND_CLICK_NAMES: Record<SiteTitleId, string[]> = {
  icreate: [],
  iphoned: ["uitklikken"],
  iculture: ["uitklikken"],
  androidplanet: ["uitklikken"],
  androidworld: ["uitklikken"],
};

export const LEAD_EVENT_NAMES: Record<SiteTitleId, string[]> = {
  icreate: [
    "nieuwsbrief_inschrijving",
    "nieuwsbrief_gb-blok",
    "nieuwsbrief_download",
    "optinmonster_conversion",
  ],
  iphoned: [],
  iculture: ["form_submit"],
  androidplanet: [],
  androidworld: [],
};

export const PAYWALL_CLICK_NAMES: Record<SiteTitleId, string[]> = {
  icreate: [
    "paywall_click_inloggen",
    "paywall_click_abonneren",
    "click_abonneren",
  ],
  iphoned: [],
  iculture: [],
  androidplanet: [],
  androidworld: [],
};

export function conversionEventGroupForName(
  brandId: SiteTitleId,
  eventName: string
): ConversionEventGroupId | "other" {
  const cfg = getBrandConversionConfig(brandId);
  return cfg.events.find((e) => e.name === eventName)?.group ?? "other";
}
