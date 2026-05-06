import { google } from "googleapis";
import { fetchHistorischTopArticles } from "@/lib/ga4-historisch-top-articles";
import type { HistorischTopArticlesReport } from "@/lib/historisch-top-articles-shared";
import {
  buildOriginMonthFromGaRows,
  type FlatChannelRow,
  type FlatSourceMediumRow,
} from "@/lib/historisch-top-articles-origin-aggregate";
import type {
  HistorischTopArticlesOriginReport,
  OriginMonthBundle,
  OriginMonthTechnical,
} from "@/lib/historisch-top-articles-origin-shared";

const ORIGIN_EVENTS = ["paywall_view", "paywall_abonneren"] as const;

function getHistorischPropertyId(): string | undefined {
  const id = process.env.GA4_PROPERTY_HN?.trim();
  return id ? id.replace(/^properties\//, "") : undefined;
}

function emptyTechnical(): OriginMonthTechnical {
  return {
    stap5Top25PaywallView: 0,
    stap5Top25PaywallAbonneren: 0,
    analysisAPaywallView: 0,
    analysisAPaywallAbonneren: 0,
    analysisBPaywallView: 0,
    analysisBPaywallAbonneren: 0,
    diffPaywallViewA: 0,
    diffPaywallAbonnerenA: 0,
    topArticlesWithChannelData: 0,
    topArticlesWithoutChannelData: 0,
  };
}

function emptyMonthBundle(
  label: string,
  yearMonth: string,
  start: string,
  end: string,
  err?: string
): OriginMonthBundle {
  return {
    label,
    yearMonth,
    startDate: start,
    endDate: end,
    summary: [],
    analysisA: [],
    analysisB: [],
    technical: emptyTechnical(),
    error: err,
  };
}

function top25PathsAndStap5Totals(
  topByAbonnement: HistorischTopArticlesReport["january2024"]["topByAbonnement"]
): { paths: string[]; stap5Pv: number; stap5Abo: number } {
  const stap5Pv = topByAbonnement.reduce((s, r) => s + r.paywall_view, 0);
  const stap5Abo = topByAbonnement.reduce((s, r) => s + r.paywall_abonneren, 0);
  const paths = [...new Set(topByAbonnement.map((r) => r.pagePath).filter((p) => p && p.trim()))];
  return { paths, stap5Pv, stap5Abo };
}

async function fetchAnalysisChannel(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  startDate: string,
  endDate: string,
  paths: string[]
): Promise<FlatChannelRow[]> {
  if (paths.length === 0) return [];
  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: "pagePath" },
        { name: "pageTitle" },
        { name: "sessionDefaultChannelGroup" },
        { name: "eventName" },
      ],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: "pagePath",
                inListFilter: { values: paths },
              },
            },
            {
              filter: {
                fieldName: "eventName",
                inListFilter: { values: [...ORIGIN_EVENTS] },
              },
            },
          ],
        },
      },
      limit: "250000",
    },
  });

  const out: FlatChannelRow[] = [];
  for (const row of data.rows ?? []) {
    out.push({
      pagePath: row.dimensionValues?.[0]?.value ?? "",
      pageTitle: row.dimensionValues?.[1]?.value ?? "",
      sessionDefaultChannelGroup: row.dimensionValues?.[2]?.value ?? "",
      eventName: row.dimensionValues?.[3]?.value ?? "",
      eventCount: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    });
  }
  return out;
}

async function fetchAnalysisSourceMedium(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  startDate: string,
  endDate: string,
  paths: string[]
): Promise<FlatSourceMediumRow[]> {
  if (paths.length === 0) return [];
  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: "pagePath" },
        { name: "pageTitle" },
        { name: "sessionSourceMedium" },
        { name: "eventName" },
      ],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: "pagePath",
                inListFilter: { values: paths },
              },
            },
            {
              filter: {
                fieldName: "eventName",
                inListFilter: { values: [...ORIGIN_EVENTS] },
              },
            },
          ],
        },
      },
      limit: "250000",
    },
  });

  const out: FlatSourceMediumRow[] = [];
  for (const row of data.rows ?? []) {
    out.push({
      pagePath: row.dimensionValues?.[0]?.value ?? "",
      pageTitle: row.dimensionValues?.[1]?.value ?? "",
      sessionSourceMedium: row.dimensionValues?.[2]?.value ?? "",
      eventName: row.dimensionValues?.[3]?.value ?? "",
      eventCount: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    });
  }
  return out;
}

async function buildOneOriginMonth(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  cfg: { label: string; yearMonth: string; startDate: string; endDate: string },
  topByAbonnement: HistorischTopArticlesReport["january2024"]["topByAbonnement"]
): Promise<OriginMonthBundle> {
  const { paths, stap5Pv, stap5Abo } = top25PathsAndStap5Totals(topByAbonnement);
  try {
    const [flatA, flatB] = await Promise.all([
      fetchAnalysisChannel(analyticsdata, property, cfg.startDate, cfg.endDate, paths),
      fetchAnalysisSourceMedium(analyticsdata, property, cfg.startDate, cfg.endDate, paths),
    ]);
    const { summary, analysisA, analysisB, technical } = buildOriginMonthFromGaRows({
      label: cfg.label,
      yearMonth: cfg.yearMonth,
      startDate: cfg.startDate,
      endDate: cfg.endDate,
      topPaths: paths,
      stap5Top25PaywallView: stap5Pv,
      stap5Top25PaywallAbonneren: stap5Abo,
      flatA,
      flatB,
    });
    return {
      label: cfg.label,
      yearMonth: cfg.yearMonth,
      startDate: cfg.startDate,
      endDate: cfg.endDate,
      summary,
      analysisA,
      analysisB,
      technical,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ...emptyMonthBundle(cfg.label, cfg.yearMonth, cfg.startDate, cfg.endDate, msg),
      technical: {
        ...emptyTechnical(),
        stap5Top25PaywallView: stap5Pv,
        stap5Top25PaywallAbonneren: stap5Abo,
        topArticlesWithoutChannelData: paths.length,
      },
    };
  }
}

export async function fetchHistorischTopArticlesOrigin(
  accessToken: string,
  options?: { stap5?: HistorischTopArticlesReport | null }
): Promise<HistorischTopArticlesOriginReport> {
  const propertyId = getHistorischPropertyId();
  if (!propertyId) {
    return {
      generatedAt: new Date().toISOString(),
      brand: "Historisch Nieuwsblad",
      propertyEnvKey: "GA4_PROPERTY_HN",
      fatalError: "GA4_PROPERTY_HN ontbreekt.",
      january2024: emptyMonthBundle(
        "Januari 2024",
        "2024-01",
        "2024-01-01",
        "2024-01-31",
        "Geen property"
      ),
      june2024: emptyMonthBundle("Juni 2024", "2024-06", "2024-06-01", "2024-06-30", "Geen property"),
    };
  }

  const stap5 =
    options?.stap5 != null
      ? options.stap5
      : await fetchHistorischTopArticles(accessToken);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
  const property = `properties/${propertyId}`;

  const [january2024, june2024] = await Promise.all([
    buildOneOriginMonth(analyticsdata, property, {
      label: "Januari 2024",
      yearMonth: "2024-01",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    }, stap5.january2024.topByAbonnement),
    buildOneOriginMonth(analyticsdata, property, {
      label: "Juni 2024",
      yearMonth: "2024-06",
      startDate: "2024-06-01",
      endDate: "2024-06-30",
    }, stap5.june2024.topByAbonnement),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    brand: stap5.brand,
    propertyEnvKey: "GA4_PROPERTY_HN",
    january2024,
    june2024,
  };
}
