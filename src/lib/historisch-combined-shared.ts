import { formatYearMonthDisplay, getHistorischFunnelRange } from "@/lib/historisch-funnel-shared";
import type { HistorischFunnelMonthRow, HistorischFunnelMonthlyReport } from "@/lib/historisch-funnel-shared";
import type { HistorischTrafficMonthRow, HistorischTrafficMonthlyReport } from "@/lib/historisch-traffic-shared";

function div(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

function indexValue(cur: number, base: number): number | null {
  return base > 0 ? (cur / base) * 100 : null;
}

export interface HistorischCombinedMonthRow {
  yearMonth: string;
  sessions: number;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  screenPageViews: number;
  new_user_share: number | null;
  views_per_session: number | null;
  views_per_user: number | null;
  paywall_view: number;
  paywall_abonneren: number;
  paywall_inloggen: number;
  nieuwsbrief_inschrijving_artikelen: number;
  paywall_abonneer_ratio: number | null;
  paywall_login_ratio: number | null;
  nieuwsbrief_per_paywall_view: number | null;
  paywall_views_per_session: number | null;
  paywall_views_per_user: number | null;
  paywall_views_per_new_user: number | null;
  paywall_abonneren_per_session: number | null;
  paywall_abonneren_per_new_user: number | null;
  nieuwsbrief_per_session: number | null;
  nieuwsbrief_per_new_user: number | null;
  index_sessions: number | null;
  index_totalUsers: number | null;
  index_newUsers: number | null;
  index_screenPageViews: number | null;
  index_paywall_view: number | null;
  index_paywall_abonneren: number | null;
  index_nieuwsbrief_inschrijving_artikelen: number | null;
}

const DERIVED_RATIO_KEYS: (keyof HistorischCombinedMonthRow)[] = [
  "new_user_share",
  "views_per_session",
  "views_per_user",
  "paywall_abonneer_ratio",
  "paywall_login_ratio",
  "nieuwsbrief_per_paywall_view",
  "paywall_views_per_session",
  "paywall_views_per_user",
  "paywall_views_per_new_user",
  "paywall_abonneren_per_session",
  "paywall_abonneren_per_new_user",
  "nieuwsbrief_per_session",
  "nieuwsbrief_per_new_user",
];

const INDEX_RATIO_KEYS: (keyof HistorischCombinedMonthRow)[] = [
  "index_sessions",
  "index_totalUsers",
  "index_newUsers",
  "index_screenPageViews",
  "index_paywall_view",
  "index_paywall_abonneren",
  "index_nieuwsbrief_inschrijving_artikelen",
];

const RATIO_KEYS: (keyof HistorischCombinedMonthRow)[] = [
  ...DERIVED_RATIO_KEYS,
  ...INDEX_RATIO_KEYS,
];

export interface HistorischCombinedTechnicalMeta {
  tableMonthCount: number;
  expectedMonthCount: number;
  startMonth: string;
  endMonth: string;
  /** Zelfde yearMonth-reeks in stap 2 en stap 3 (volgorde + lengte). */
  funnelAndTrafficYearMonthsMatch: boolean;
  /** Ontbreekt in stap 2 of stap 3 t.o.v. het canonical bereik. */
  missingMonthsVsExpected: string[];
  /** In stap 2 aanwezig maar niet in stap 3. */
  monthsInStap2NotStap3: string[];
  /** In stap 3 aanwezig maar niet in stap 2. */
  monthsInStap3NotStap2: string[];
  /** Traffic niet nul (sessions/totalUsers/screenPageViews), funnel-events allemaal 0. */
  monthsWithTrafficNoFunnel: string[];
  /** Minstens één funnel-event &gt; 0, alle kerntraffic-tellers 0. */
  monthsWithFunnelNoTraffic: string[];
  ratioNullCellCount: number;
  derivedRatioNullCellCount: number;
  indexNullCellCount: number;
  ratioTotalCells: number;
  /** Alle afgeleide ratio’s (excl. indexen) zonder null. */
  allDerivedRatiosComputed: boolean;
  /** Alle indexkolommen zonder null (basis jan 2024 moet &gt; 0 per metric). */
  allIndexValuesComputed: boolean;
  funnelRowCount: number;
  trafficRowCount: number;
  funnelHadError: boolean;
  trafficHadError: boolean;
}

export interface HistorischCombinedMonthlyReport {
  generatedAt: string;
  brand: string;
  dateRange: { startDate: string; endDate: string };
  rows: HistorischCombinedMonthRow[];
  technical: HistorischCombinedTechnicalMeta;
  /** Basismaand voor indices (`2024-01` of eerste rij). */
  indexBaseYearMonth: string;
  message?: string;
}

function emptyTrafficSlice(): Pick<
  HistorischCombinedMonthRow,
  | "sessions"
  | "totalUsers"
  | "activeUsers"
  | "newUsers"
  | "screenPageViews"
  | "new_user_share"
  | "views_per_session"
  | "views_per_user"
> {
  return {
    sessions: 0,
    totalUsers: 0,
    activeUsers: 0,
    newUsers: 0,
    screenPageViews: 0,
    new_user_share: null,
    views_per_session: null,
    views_per_user: null,
  };
}

function emptyFunnelSlice(): Pick<
  HistorischCombinedMonthRow,
  | "paywall_view"
  | "paywall_abonneren"
  | "paywall_inloggen"
  | "nieuwsbrief_inschrijving_artikelen"
  | "paywall_abonneer_ratio"
  | "paywall_login_ratio"
  | "nieuwsbrief_per_paywall_view"
> {
  return {
    paywall_view: 0,
    paywall_abonneren: 0,
    paywall_inloggen: 0,
    nieuwsbrief_inschrijving_artikelen: 0,
    paywall_abonneer_ratio: null,
    paywall_login_ratio: null,
    nieuwsbrief_per_paywall_view: null,
  };
}

export function buildHistorischCombinedMonthly(
  funnel: HistorischFunnelMonthlyReport | null,
  traffic: HistorischTrafficMonthlyReport | null,
  reference = new Date()
): HistorischCombinedMonthlyReport {
  const range = getHistorischFunnelRange(reference);
  const expectedYm = range.expectedMonths.map((m) => formatYearMonthDisplay(m));

  const funnelByYm = new Map<string, HistorischFunnelMonthRow>();
  for (const r of funnel?.rows ?? []) {
    funnelByYm.set(r.yearMonth, r);
  }
  const trafficByYm = new Map<string, HistorischTrafficMonthRow>();
  for (const r of traffic?.rows ?? []) {
    trafficByYm.set(r.yearMonth, r);
  }

  const funnelKeys = [...funnelByYm.keys()].sort();
  const trafficKeys = [...trafficByYm.keys()].sort();
  const funnelAndTrafficYearMonthsMatch =
    funnelKeys.length === trafficKeys.length && funnelKeys.every((k, i) => k === trafficKeys[i]);

  const baseYearMonth = expectedYm[0] ?? "2024-01";

  const rows: HistorischCombinedMonthRow[] = expectedYm.map((ym) => {
    const f = funnelByYm.get(ym);
    const t = trafficByYm.get(ym);

    const ts = t
      ? {
          sessions: t.sessions,
          totalUsers: t.totalUsers,
          activeUsers: t.activeUsers,
          newUsers: t.newUsers,
          screenPageViews: t.screenPageViews,
          new_user_share:
            t.totalUsers > 0 ? t.newUsers / t.totalUsers : null,
          views_per_session: div(t.screenPageViews, t.sessions),
          views_per_user: div(t.screenPageViews, t.totalUsers),
        }
      : emptyTrafficSlice();

    const fs = f
      ? {
          paywall_view: f.paywall_view,
          paywall_abonneren: f.paywall_abonneren,
          paywall_inloggen: f.paywall_inloggen,
          nieuwsbrief_inschrijving_artikelen: f.nieuwsbrief_inschrijving_artikelen,
          paywall_abonneer_ratio: f.paywall_abonneer_ratio,
          paywall_login_ratio: f.paywall_login_ratio,
          nieuwsbrief_per_paywall_view: f.nieuwsbrief_per_paywall_view,
        }
      : emptyFunnelSlice();

    const pv = fs.paywall_view;
    const pabo = fs.paywall_abonneren;
    const nb = fs.nieuwsbrief_inschrijving_artikelen;

    return {
      yearMonth: ym,
      ...ts,
      ...fs,
      paywall_views_per_session: div(pv, ts.sessions),
      paywall_views_per_user: div(pv, ts.totalUsers),
      paywall_views_per_new_user: div(pv, ts.newUsers),
      paywall_abonneren_per_session: div(pabo, ts.sessions),
      paywall_abonneren_per_new_user: div(pabo, ts.newUsers),
      nieuwsbrief_per_session: div(nb, ts.sessions),
      nieuwsbrief_per_new_user: div(nb, ts.newUsers),
      index_sessions: null,
      index_totalUsers: null,
      index_newUsers: null,
      index_screenPageViews: null,
      index_paywall_view: null,
      index_paywall_abonneren: null,
      index_nieuwsbrief_inschrijving_artikelen: null,
    };
  });

  const baseRow = rows.find((r) => r.yearMonth === baseYearMonth) ?? rows[0];
  if (baseRow) {
    for (const r of rows) {
      r.index_sessions = indexValue(r.sessions, baseRow.sessions);
      r.index_totalUsers = indexValue(r.totalUsers, baseRow.totalUsers);
      r.index_newUsers = indexValue(r.newUsers, baseRow.newUsers);
      r.index_screenPageViews = indexValue(r.screenPageViews, baseRow.screenPageViews);
      r.index_paywall_view = indexValue(r.paywall_view, baseRow.paywall_view);
      r.index_paywall_abonneren = indexValue(
        r.paywall_abonneren,
        baseRow.paywall_abonneren
      );
      r.index_nieuwsbrief_inschrijving_artikelen = indexValue(
        r.nieuwsbrief_inschrijving_artikelen,
        baseRow.nieuwsbrief_inschrijving_artikelen
      );
    }
  }

  let ratioNullCellCount = 0;
  let derivedRatioNullCellCount = 0;
  let indexNullCellCount = 0;
  const ratioTotalCells = rows.length * RATIO_KEYS.length;
  for (const row of rows) {
    for (const k of DERIVED_RATIO_KEYS) {
      if (row[k] == null) {
        ratioNullCellCount++;
        derivedRatioNullCellCount++;
      }
    }
    for (const k of INDEX_RATIO_KEYS) {
      if (row[k] == null) {
        ratioNullCellCount++;
        indexNullCellCount++;
      }
    }
  }

  const monthsWithTrafficNoFunnel: string[] = [];
  const monthsWithFunnelNoTraffic: string[] = [];

  for (const r of rows) {
    const trafficSignal =
      r.sessions > 0 || r.totalUsers > 0 || r.screenPageViews > 0;
    const funnelSignal =
      r.paywall_view > 0 ||
      r.paywall_abonneren > 0 ||
      r.paywall_inloggen > 0 ||
      r.nieuwsbrief_inschrijving_artikelen > 0;
    const funnelAllZero =
      r.paywall_view === 0 &&
      r.paywall_abonneren === 0 &&
      r.paywall_inloggen === 0 &&
      r.nieuwsbrief_inschrijving_artikelen === 0;
    const trafficAllZero =
      r.sessions === 0 && r.totalUsers === 0 && r.screenPageViews === 0;

    if (trafficSignal && funnelAllZero) monthsWithTrafficNoFunnel.push(r.yearMonth);
    if (funnelSignal && trafficAllZero) monthsWithFunnelNoTraffic.push(r.yearMonth);
  }

  const sk2 = new Set(funnel?.rows.map((r) => r.yearMonth) ?? []);
  const sk3 = new Set(traffic?.rows.map((r) => r.yearMonth) ?? []);
  const missingInStap2 = expectedYm.filter((ym) => !sk2.has(ym));
  const missingInStap3 = expectedYm.filter((ym) => !sk3.has(ym));
  const missingMonthsVsExpected = [
    ...new Set([...missingInStap2, ...missingInStap3]),
  ].sort();

  const monthsInStap2NotStap3 = expectedYm.filter((ym) => sk2.has(ym) && !sk3.has(ym));
  const monthsInStap3NotStap2 = expectedYm.filter((ym) => sk3.has(ym) && !sk2.has(ym));

  const startDate =
    funnel?.dateRange.startDate ?? traffic?.dateRange.startDate ?? range.startDate;
  const endDate = funnel?.dateRange.endDate ?? traffic?.dateRange.endDate ?? range.endDate;

  let message: string | undefined;
  if (!funnel?.rows.length) {
    message = funnel?.error ?? "Stap 2 levert geen rijen — verkeersvelden zijn 0.";
  } else if (!traffic?.rows.length) {
    message = traffic?.error ?? "Stap 3 levert geen rijen — funnelvelden zijn 0.";
  }

  return {
    generatedAt: new Date().toISOString(),
    brand: funnel?.brand ?? traffic?.brand ?? "Historisch Nieuwsblad",
    dateRange: { startDate, endDate },
    rows,
    indexBaseYearMonth: baseRow?.yearMonth ?? baseYearMonth,
    technical: {
      tableMonthCount: rows.length,
      expectedMonthCount: expectedYm.length,
      startMonth: expectedYm[0] ?? "—",
      endMonth: expectedYm[expectedYm.length - 1] ?? "—",
      funnelAndTrafficYearMonthsMatch,
      missingMonthsVsExpected,
      monthsInStap2NotStap3,
      monthsInStap3NotStap2,
      monthsWithTrafficNoFunnel,
      monthsWithFunnelNoTraffic,
      ratioNullCellCount,
      derivedRatioNullCellCount,
      indexNullCellCount,
      ratioTotalCells,
      allDerivedRatiosComputed: derivedRatioNullCellCount === 0,
      allIndexValuesComputed: indexNullCellCount === 0,
      funnelRowCount: funnel?.rows.length ?? 0,
      trafficRowCount: traffic?.rows.length ?? 0,
      funnelHadError: !!funnel?.error,
      trafficHadError: !!traffic?.error,
    },
    message,
  };
}
