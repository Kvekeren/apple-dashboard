import { google } from "googleapis";
import {
  formatYearMonthDisplay,
  getHistorischTrafficMonthRange,
  type HistorischTrafficMonthRow,
  type HistorischTrafficMonthlyReport,
  type HistorischTrafficTechnicalMeta,
} from "@/lib/historisch-traffic-shared";
import { HISTORISCH_FUNNEL_BRAND } from "@/lib/historisch-funnel-shared";

export type {
  HistorischTrafficMonthRow,
  HistorischTrafficMonthlyReport,
  HistorischTrafficTechnicalMeta,
} from "@/lib/historisch-traffic-shared";

function getHistorischPropertyId(): string | undefined {
  const id = process.env.GA4_PROPERTY_HN?.trim();
  return id ? id.replace(/^properties\//, "") : undefined;
}

function normalizeYmFromGa(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length >= 6) return d.slice(0, 6);
  return "";
}

function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

async function runReportMetrics(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  startDate: string,
  endDate: string,
  metricNames: string[]
) {
  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "yearMonth" }],
      metrics: metricNames.map((name) => ({ name })),
      limit: "250000",
    },
  });
  return { data, metricNames };
}

export async function fetchHistorischTrafficMonthly(
  accessToken: string,
  referenceDate = new Date()
): Promise<HistorischTrafficMonthlyReport> {
  const propertyId = getHistorischPropertyId();
  const range = getHistorischTrafficMonthRange(referenceDate);

  const emptyTechnical = (over: Partial<HistorischTrafficTechnicalMeta> = {}): HistorischTrafficTechnicalMeta => ({
    tableMonthCount: 0,
    expectedMonthCount: range.expectedMonths.length,
    startMonth: range.expectedMonths[0] ? formatYearMonthDisplay(range.expectedMonths[0]) : "—",
    endMonth: range.expectedMonths.length
      ? formatYearMonthDisplay(range.expectedMonths[range.expectedMonths.length - 1])
      : "—",
    sequenceComplete: range.expectedMonths.length === 0,
    missingRawYearMonths: [],
    metricsUsed: [],
    viewsMetricAvailable: false,
    activeUsersRequested: true,
    coreMetricsWithData: {
      sessions: false,
      totalUsers: false,
      newUsers: false,
      screenPageViews: false,
    },
    newUsersAnyPositive: false,
    newUsersAllZero: true,
    newUsersExceedsTotalUsersAnyMonth: false,
    ...over,
  });

  if (!propertyId) {
    return {
      generatedAt: new Date().toISOString(),
      brand: HISTORISCH_FUNNEL_BRAND,
      propertyEnvKey: "GA4_PROPERTY_HN",
      dateRange: { startDate: range.startDate, endDate: range.endDate },
      rows: [],
      technical: emptyTechnical(),
      error: "GA4_PROPERTY_HN ontbreekt.",
    };
  }

  if (range.expectedMonths.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      brand: HISTORISCH_FUNNEL_BRAND,
      propertyEnvKey: "GA4_PROPERTY_HN",
      dateRange: { startDate: range.startDate, endDate: range.endDate },
      rows: [],
      technical: emptyTechnical({ sequenceComplete: true }),
      error: "Geen maanden in bereik (eind vóór 2024-01).",
    };
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
  const property = `properties/${propertyId}`;

  const tryWithViews = [
    "sessions",
    "totalUsers",
    "activeUsers",
    "newUsers",
    "screenPageViews",
    "views",
  ];
  const tryNoViews = ["sessions", "totalUsers", "activeUsers", "newUsers", "screenPageViews"];
  const tryNoActive = ["sessions", "totalUsers", "newUsers", "screenPageViews"];

  let data: Awaited<ReturnType<typeof runReportMetrics>>["data"];
  let metricNames: string[];

  try {
    const r = await runReportMetrics(analyticsdata, property, range.startDate, range.endDate, tryWithViews);
    data = r.data;
    metricNames = r.metricNames;
  } catch {
    try {
      const r = await runReportMetrics(analyticsdata, property, range.startDate, range.endDate, tryNoViews);
      data = r.data;
      metricNames = r.metricNames;
    } catch {
      try {
        const r = await runReportMetrics(
          analyticsdata,
          property,
          range.startDate,
          range.endDate,
          tryNoActive
        );
        data = r.data;
        metricNames = r.metricNames;
      } catch (e3) {
        return {
          generatedAt: new Date().toISOString(),
          brand: HISTORISCH_FUNNEL_BRAND,
          propertyEnvKey: "GA4_PROPERTY_HN",
          dateRange: { startDate: range.startDate, endDate: range.endDate },
          rows: [],
          technical: emptyTechnical({ metricsUsed: tryNoViews }),
          error: `Verkeersrapport mislukt: ${errMsg(e3)}`,
        };
      }
    }
  }

  const apiNotes: string[] = [];
  if (!metricNames.includes("views")) {
    apiNotes.push(
      "Geen aparte Data API metric `views`; `screenPageViews` is het standaard ‘Views’-veld in GA4."
    );
  }
  if (!metricNames.includes("activeUsers")) {
    apiNotes.push(
      "`activeUsers` kon niet worden opgehaald met `yearMonth` in dit property (fallback zonder deze metric)."
    );
  }

  const idx = (name: string) => metricNames.indexOf(name);
  const iSessions = idx("sessions");
  const iTotalUsers = idx("totalUsers");
  const iActive = idx("activeUsers");
  const iNew = idx("newUsers");
  const iSpv = idx("screenPageViews");
  const iViews = idx("views");

  type Agg = {
    sessions: number;
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    screenPageViews: number;
    views: number | null;
  };

  const byYm = new Map<string, Agg>();
  for (const ym of range.expectedMonths) {
    byYm.set(ym, {
      sessions: 0,
      totalUsers: 0,
      activeUsers: 0,
      newUsers: 0,
      screenPageViews: 0,
      views: iViews >= 0 ? 0 : null,
    });
  }

  const parseM = (row: { metricValues?: Array<{ value?: string | null }> }, i: number) => {
    if (i < 0) return 0;
    return parseInt(row.metricValues?.[i]?.value ?? "0", 10);
  };

  const rawYm = new Set<string>();

  for (const row of data.rows ?? []) {
    const ym = normalizeYmFromGa(row.dimensionValues?.[0]?.value ?? "");
    if (!ym || !byYm.has(ym)) continue;
    rawYm.add(ym);
    const cur = byYm.get(ym)!;
    cur.sessions = parseM(row, iSessions);
    cur.totalUsers = parseM(row, iTotalUsers);
    cur.activeUsers = parseM(row, iActive);
    cur.newUsers = parseM(row, iNew);
    cur.screenPageViews = parseM(row, iSpv);
    if (iViews >= 0) {
      cur.views = parseM(row, iViews);
    }
  }

  const rows: HistorischTrafficMonthRow[] = range.expectedMonths.map((ym) => {
    const a = byYm.get(ym)!;
    const tu = a.totalUsers;
    const s = a.sessions;
    const spv = a.screenPageViews;
    return {
      yearMonth: formatYearMonthDisplay(ym),
      sessions: a.sessions,
      totalUsers: a.totalUsers,
      activeUsers: a.activeUsers,
      newUsers: a.newUsers,
      screenPageViews: a.screenPageViews,
      views: a.views,
      new_user_share: tu > 0 ? a.newUsers / tu : null,
      views_per_session: s > 0 ? spv / s : null,
      views_per_user: tu > 0 ? spv / tu : null,
    };
  });

  const sum = (pick: (r: HistorischTrafficMonthRow) => number) =>
    rows.reduce((acc, r) => acc + pick(r), 0);

  const technical: HistorischTrafficTechnicalMeta = {
    tableMonthCount: rows.length,
    expectedMonthCount: range.expectedMonths.length,
    startMonth: formatYearMonthDisplay(range.expectedMonths[0]),
    endMonth: formatYearMonthDisplay(range.expectedMonths[range.expectedMonths.length - 1]),
    sequenceComplete: rows.length === range.expectedMonths.length,
    missingRawYearMonths: range.expectedMonths
      .filter((ym) => !rawYm.has(ym))
      .map((ym) => formatYearMonthDisplay(ym)),
    metricsUsed: metricNames,
    viewsMetricAvailable: iViews >= 0,
    activeUsersRequested: iActive >= 0,
    coreMetricsWithData: {
      sessions: sum((r) => r.sessions) > 0,
      totalUsers: sum((r) => r.totalUsers) > 0,
      newUsers: sum((r) => r.newUsers) > 0,
      screenPageViews: sum((r) => r.screenPageViews) > 0,
    },
    newUsersAnyPositive: rows.some((r) => r.newUsers > 0),
    newUsersAllZero: !rows.some((r) => r.newUsers > 0),
    newUsersExceedsTotalUsersAnyMonth: rows.some((r) => r.newUsers > r.totalUsers),
  };

  return {
    generatedAt: new Date().toISOString(),
    brand: HISTORISCH_FUNNEL_BRAND,
    propertyEnvKey: "GA4_PROPERTY_HN",
    dateRange: { startDate: range.startDate, endDate: range.endDate },
    rows,
    technical,
    apiNote: apiNotes.join(" "),
  };
}
