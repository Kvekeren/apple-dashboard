import { google } from "googleapis";
import {
  formatYearMonthDisplay,
  getHistorischFunnelRange,
  HISTORISCH_FUNNEL_BRAND,
  type HistorischFunnelMonthRow,
} from "@/lib/historisch-funnel-shared";
import { buildNbArtikelTechnical } from "@/lib/historisch-nieuwsbrief-artikel-csv";
import type {
  HistorischNieuwsbriefArtikelReport,
  NbArtikelTableARow,
  NbArtikelTableBRow,
  NbArtikelTableCRow,
} from "@/lib/historisch-nieuwsbrief-artikel-shared";

const NB_EVENT = "nieuwsbrief_inschrijving_artikelen";

function getHistorischPropertyId(): string | undefined {
  const id = process.env.GA4_PROPERTY_HN?.trim();
  return id ? id.replace(/^properties\//, "") : undefined;
}

function normalizeYmCompact(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length >= 6) return d.slice(0, 6);
  return "";
}

function pairKey(ym: string, second: string): string {
  return JSON.stringify([ym, second]);
}

function parsePairKey(k: string): [string, string] {
  return JSON.parse(k) as [string, string];
}

function ratiosFrom(
  nb: number,
  sessions: number,
  totalUsers: number,
  newUsers: number,
  spv: number,
  includeTotalUser: boolean
): {
  perSession: number | null;
  perTotalUser: number | null;
  perNewUser: number | null;
  per1kPsv: number | null;
} {
  return {
    perSession: sessions > 0 ? nb / sessions : null,
    perTotalUser: includeTotalUser && totalUsers > 0 ? nb / totalUsers : null,
    perNewUser: newUsers > 0 ? nb / newUsers : null,
    per1kPsv: spv > 0 ? (nb / spv) * 1000 : null,
  };
}

async function fetchEventCountByMonth(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "yearMonth" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: { matchType: "EXACT", value: NB_EVENT },
        },
      },
      limit: "250000",
    },
  });
  const m = new Map<string, number>();
  for (const row of data.rows ?? []) {
    const ym = normalizeYmCompact(row.dimensionValues?.[0]?.value ?? "");
    if (!ym) continue;
    const n = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    m.set(ym, (m.get(ym) ?? 0) + n);
  }
  return m;
}

async function fetchTrafficByMonth(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  startDate: string,
  endDate: string
): Promise<Map<string, { sessions: number; totalUsers: number; newUsers: number; screenPageViews: number }>> {
  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "yearMonth" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "screenPageViews" },
      ],
      limit: "250000",
    },
  });
  const m = new Map<string, { sessions: number; totalUsers: number; newUsers: number; screenPageViews: number }>();
  for (const row of data.rows ?? []) {
    const ym = normalizeYmCompact(row.dimensionValues?.[0]?.value ?? "");
    if (!ym) continue;
    m.set(ym, {
      sessions: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      totalUsers: parseInt(row.metricValues?.[1]?.value ?? "0", 10),
      newUsers: parseInt(row.metricValues?.[2]?.value ?? "0", 10),
      screenPageViews: parseInt(row.metricValues?.[3]?.value ?? "0", 10),
    });
  }
  return m;
}

async function fetchEventByMonthDevice(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "yearMonth" }, { name: "deviceCategory" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: { matchType: "EXACT", value: NB_EVENT },
        },
      },
      limit: "250000",
    },
  });
  const m = new Map<string, number>();
  for (const row of data.rows ?? []) {
    const ym = normalizeYmCompact(row.dimensionValues?.[0]?.value ?? "");
    const device = row.dimensionValues?.[1]?.value ?? "(not set)";
    if (!ym) continue;
    const k = pairKey(ym, device);
    const n = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    m.set(k, (m.get(k) ?? 0) + n);
  }
  return m;
}

async function fetchTrafficByMonthDevice(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  startDate: string,
  endDate: string
): Promise<
  Map<string, { sessions: number; totalUsers: number; newUsers: number; screenPageViews: number }>
> {
  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "yearMonth" }, { name: "deviceCategory" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "screenPageViews" },
      ],
      limit: "250000",
    },
  });
  const m = new Map<
    string,
    { sessions: number; totalUsers: number; newUsers: number; screenPageViews: number }
  >();
  for (const row of data.rows ?? []) {
    const ym = normalizeYmCompact(row.dimensionValues?.[0]?.value ?? "");
    const device = row.dimensionValues?.[1]?.value ?? "(not set)";
    if (!ym) continue;
    m.set(pairKey(ym, device), {
      sessions: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      totalUsers: parseInt(row.metricValues?.[1]?.value ?? "0", 10),
      newUsers: parseInt(row.metricValues?.[2]?.value ?? "0", 10),
      screenPageViews: parseInt(row.metricValues?.[3]?.value ?? "0", 10),
    });
  }
  return m;
}

async function fetchEventByMonthChannel(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "yearMonth" }, { name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          stringFilter: { matchType: "EXACT", value: NB_EVENT },
        },
      },
      limit: "250000",
    },
  });
  const m = new Map<string, number>();
  for (const row of data.rows ?? []) {
    const ym = normalizeYmCompact(row.dimensionValues?.[0]?.value ?? "");
    const ch = row.dimensionValues?.[1]?.value ?? "(not set)";
    if (!ym) continue;
    const k = pairKey(ym, ch);
    const n = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    m.set(k, (m.get(k) ?? 0) + n);
  }
  return m;
}

async function fetchTrafficByMonthChannel(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  startDate: string,
  endDate: string
): Promise<
  Map<string, { sessions: number; totalUsers: number; newUsers: number; screenPageViews: number }>
> {
  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "yearMonth" }, { name: "sessionDefaultChannelGroup" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "screenPageViews" },
      ],
      limit: "250000",
    },
  });
  const m = new Map<
    string,
    { sessions: number; totalUsers: number; newUsers: number; screenPageViews: number }
  >();
  for (const row of data.rows ?? []) {
    const ym = normalizeYmCompact(row.dimensionValues?.[0]?.value ?? "");
    const ch = row.dimensionValues?.[1]?.value ?? "(not set)";
    if (!ym) continue;
    m.set(pairKey(ym, ch), {
      sessions: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      totalUsers: parseInt(row.metricValues?.[1]?.value ?? "0", 10),
      newUsers: parseInt(row.metricValues?.[2]?.value ?? "0", 10),
      screenPageViews: parseInt(row.metricValues?.[3]?.value ?? "0", 10),
    });
  }
  return m;
}

function buildTableA(
  expectedYm: string[],
  evMonth: Map<string, number>,
  trMonth: Map<string, { sessions: number; totalUsers: number; newUsers: number; screenPageViews: number }>
): NbArtikelTableARow[] {
  const rows: NbArtikelTableARow[] = [];
  for (const ym of expectedYm) {
    const nb = evMonth.get(ym) ?? 0;
    const tr = trMonth.get(ym) ?? {
      sessions: 0,
      totalUsers: 0,
      newUsers: 0,
      screenPageViews: 0,
    };
    const r = ratiosFrom(nb, tr.sessions, tr.totalUsers, tr.newUsers, tr.screenPageViews, true);
    rows.push({
      yearMonth: formatYearMonthDisplay(ym),
      nieuwsbrief_inschrijving_artikelen: nb,
      sessions: tr.sessions,
      totalUsers: tr.totalUsers,
      newUsers: tr.newUsers,
      screenPageViews: tr.screenPageViews,
      nieuwsbrief_per_session: r.perSession,
      nieuwsbrief_per_totalUser: r.perTotalUser,
      nieuwsbrief_per_newUser: r.perNewUser,
      nieuwsbrief_per_1000_pageviews: r.per1kPsv,
    });
  }
  rows.sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : a.yearMonth > b.yearMonth ? 1 : 0));
  return rows;
}

function mergeDeviceChannelRows(
  expectedYm: string[],
  ev: Map<string, number>,
  tr: Map<string, { sessions: number; totalUsers: number; newUsers: number; screenPageViews: number }>,
  mode: "device" | "channel"
): (NbArtikelTableBRow | NbArtikelTableCRow)[] {
  const keys = new Set<string>([...ev.keys(), ...tr.keys()]);
  const rows: NbArtikelTableBRow[] = [];
  const rowsC: NbArtikelTableCRow[] = [];

  for (const k of keys) {
    const [ym, dimVal] = parsePairKey(k);
    if (!expectedYm.includes(ym)) continue;
    const nb = ev.get(k) ?? 0;
    const t = tr.get(k) ?? { sessions: 0, totalUsers: 0, newUsers: 0, screenPageViews: 0 };
    const r = ratiosFrom(nb, t.sessions, t.totalUsers, t.newUsers, t.screenPageViews, false);
    const ymDisp = formatYearMonthDisplay(ym);
    if (mode === "device") {
      rows.push({
        yearMonth: ymDisp,
        deviceCategory: dimVal,
        nieuwsbrief_inschrijving_artikelen: nb,
        sessions: t.sessions,
        totalUsers: t.totalUsers,
        newUsers: t.newUsers,
        screenPageViews: t.screenPageViews,
        nieuwsbrief_per_session: r.perSession,
        nieuwsbrief_per_newUser: r.perNewUser,
        nieuwsbrief_per_1000_pageviews: r.per1kPsv,
      });
    } else {
      rowsC.push({
        yearMonth: ymDisp,
        sessionDefaultChannelGroup: dimVal,
        nieuwsbrief_inschrijving_artikelen: nb,
        sessions: t.sessions,
        totalUsers: t.totalUsers,
        newUsers: t.newUsers,
        screenPageViews: t.screenPageViews,
        nieuwsbrief_per_session: r.perSession,
        nieuwsbrief_per_newUser: r.perNewUser,
        nieuwsbrief_per_1000_pageviews: r.per1kPsv,
      });
    }
  }

  const sortFn = (
    a: { yearMonth: string; nieuwsbrief_inschrijving_artikelen: number },
    b: { yearMonth: string; nieuwsbrief_inschrijving_artikelen: number }
  ) => {
    if (a.yearMonth !== b.yearMonth) return a.yearMonth < b.yearMonth ? -1 : 1;
    return b.nieuwsbrief_inschrijving_artikelen - a.nieuwsbrief_inschrijving_artikelen;
  };

  if (mode === "device") {
    rows.sort(sortFn);
    return rows;
  }
  rowsC.sort(sortFn);
  return rowsC;
}

export async function fetchHistorischNieuwsbriefArtikelReport(
  accessToken: string,
  options?: {
    stap2Rows?: HistorischFunnelMonthRow[];
    referenceDate?: Date;
  }
): Promise<HistorischNieuwsbriefArtikelReport> {
  const propertyId = getHistorischPropertyId();
  const range = getHistorischFunnelRange(options?.referenceDate ?? new Date());
  const stap2ByMonth = new Map<string, number>();
  for (const r of options?.stap2Rows ?? []) {
    stap2ByMonth.set(r.yearMonth, r.nieuwsbrief_inschrijving_artikelen);
  }

  if (!propertyId) {
    return {
      generatedAt: new Date().toISOString(),
      brand: HISTORISCH_FUNNEL_BRAND,
      propertyEnvKey: "GA4_PROPERTY_HN",
      dateRange: { startDate: range.startDate, endDate: range.endDate },
      tableA: [],
      tableB: [],
      tableC: [],
      technical: buildNbArtikelTechnical([], stap2ByMonth),
      fatalError: "GA4_PROPERTY_HN ontbreekt.",
    };
  }

  if (range.expectedMonths.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      brand: HISTORISCH_FUNNEL_BRAND,
      propertyEnvKey: "GA4_PROPERTY_HN",
      dateRange: { startDate: range.startDate, endDate: range.endDate },
      tableA: [],
      tableB: [],
      tableC: [],
      technical: buildNbArtikelTechnical([], stap2ByMonth),
      error: "Geen maanden in bereik.",
    };
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
  const property = `properties/${propertyId}`;

  const { startDate, endDate, expectedMonths } = range;

  try {
    const [
      evMonth,
      trMonth,
      evDev,
      trDev,
      evCh,
      trCh,
    ] = await Promise.all([
      fetchEventCountByMonth(analyticsdata, property, startDate, endDate),
      fetchTrafficByMonth(analyticsdata, property, startDate, endDate),
      fetchEventByMonthDevice(analyticsdata, property, startDate, endDate),
      fetchTrafficByMonthDevice(analyticsdata, property, startDate, endDate),
      fetchEventByMonthChannel(analyticsdata, property, startDate, endDate),
      fetchTrafficByMonthChannel(analyticsdata, property, startDate, endDate),
    ]);

    const tableA = buildTableA(expectedMonths, evMonth, trMonth);
    const tableB = mergeDeviceChannelRows(expectedMonths, evDev, trDev, "device") as NbArtikelTableBRow[];
    const tableC = mergeDeviceChannelRows(expectedMonths, evCh, trCh, "channel") as NbArtikelTableCRow[];

    const technical = buildNbArtikelTechnical(tableA, stap2ByMonth);

    return {
      generatedAt: new Date().toISOString(),
      brand: HISTORISCH_FUNNEL_BRAND,
      propertyEnvKey: "GA4_PROPERTY_HN",
      dateRange: { startDate, endDate },
      tableA,
      tableB,
      tableC,
      technical,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      generatedAt: new Date().toISOString(),
      brand: HISTORISCH_FUNNEL_BRAND,
      propertyEnvKey: "GA4_PROPERTY_HN",
      dateRange: { startDate, endDate },
      tableA: [],
      tableB: [],
      tableC: [],
      technical: buildNbArtikelTechnical([], stap2ByMonth),
      error: msg,
    };
  }
}
