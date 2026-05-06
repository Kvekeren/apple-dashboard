import { google } from "googleapis";
import { fetchHistorischFunnelMonthly } from "@/lib/ga4-historisch-funnel";
import type { HistorischFunnelMonthRow } from "@/lib/historisch-funnel-shared";
import {
  aggregateAndPivotTopArticles,
  buildTopArticleTechnical,
  filterArticleLikeRows,
  sortAndTakeTop,
  toPivotRows,
  TOP_ARTICLE_EVENTS,
  type TopArticleEvent,
} from "@/lib/historisch-top-articles-aggregate";
import type {
  HistorischTopArticleMonthBundle,
  HistorischTopArticlesReport,
} from "@/lib/historisch-top-articles-shared";

function getHistorischPropertyId(): string | undefined {
  const id = process.env.GA4_PROPERTY_HN?.trim();
  return id ? id.replace(/^properties\//, "") : undefined;
}

function funnelRowToEventTotals(
  row: HistorischFunnelMonthRow | undefined
): Record<TopArticleEvent, number> | null {
  if (!row) return null;
  return {
    paywall_view: row.paywall_view,
    paywall_abonneren: row.paywall_abonneren,
    paywall_inloggen: row.paywall_inloggen,
    nieuwsbrief_inschrijving_artikelen: row.nieuwsbrief_inschrijving_artikelen,
  };
}

async function fetchMonthEventTotals(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  startDate: string,
  endDate: string
): Promise<Record<TopArticleEvent, number>> {
  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: { values: [...TOP_ARTICLE_EVENTS] },
        },
      },
      limit: "10000",
    },
  });
  const out: Record<TopArticleEvent, number> = {
    paywall_view: 0,
    paywall_abonneren: 0,
    paywall_inloggen: 0,
    nieuwsbrief_inschrijving_artikelen: 0,
  };
  for (const row of data.rows ?? []) {
    const ev = row.dimensionValues?.[0]?.value ?? "";
    const n = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    if (TOP_ARTICLE_EVENTS.includes(ev as TopArticleEvent)) {
      out[ev as TopArticleEvent] += n;
    }
  }
  return out;
}

async function fetchArticleDetailRows(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  startDate: string,
  endDate: string
): Promise<
  Array<{ pagePath: string; pageTitle: string; eventName: string; eventCount: number }>
> {
  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }, { name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: { values: [...TOP_ARTICLE_EVENTS] },
        },
      },
      limit: "250000",
    },
  });

  const rows: Array<{
    pagePath: string;
    pageTitle: string;
    eventName: string;
    eventCount: number;
  }> = [];

  for (const row of data.rows ?? []) {
    rows.push({
      pagePath: row.dimensionValues?.[0]?.value ?? "",
      pageTitle: row.dimensionValues?.[1]?.value ?? "",
      eventName: row.dimensionValues?.[2]?.value ?? "",
      eventCount: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    });
  }
  return rows;
}

async function buildOneMonth(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  property: string,
  cfg: {
    label: string;
    startDate: string;
    endDate: string;
    yearMonthDisplay: string;
  },
  stap2Row: HistorischFunnelMonthRow | undefined
): Promise<HistorischTopArticleMonthBundle> {
  try {
    const flat = await fetchArticleDetailRows(
      analyticsdata,
      property,
      cfg.startDate,
      cfg.endDate
    );
    const monthTotalsFromGa = await fetchMonthEventTotals(
      analyticsdata,
      property,
      cfg.startDate,
      cfg.endDate
    );

    const mergedMap = aggregateAndPivotTopArticles(flat);
    const pivoted = filterArticleLikeRows(toPivotRows(mergedMap));

    const topByAbonnement = sortAndTakeTop(pivoted, "paywall_abonneren", 25);
    const topByView = sortAndTakeTop(pivoted, "paywall_view", 25);

    const technical = buildTopArticleTechnical({
      monthLabel: cfg.label,
      startDate: cfg.startDate,
      endDate: cfg.endDate,
      yearMonthStap2: cfg.yearMonthDisplay,
      monthTotalsFromGa,
      stap2MonthTotals: funnelRowToEventTotals(stap2Row),
      filteredAllRows: pivoted,
      topByAbonnement,
      topByView,
    });

    return {
      label: cfg.label,
      startDate: cfg.startDate,
      endDate: cfg.endDate,
      yearMonthDisplay: cfg.yearMonthDisplay,
      topByAbonnement,
      topByView,
      technical,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      label: cfg.label,
      startDate: cfg.startDate,
      endDate: cfg.endDate,
      yearMonthDisplay: cfg.yearMonthDisplay,
      topByAbonnement: [],
      topByView: [],
      technical: {
        monthLabel: cfg.label,
        startDate: cfg.startDate,
        endDate: cfg.endDate,
        yearMonthStap2: cfg.yearMonthDisplay,
        totalPaywallViewInTable: 0,
        totalPaywallAbonnerenInTable: 0,
        monthTotalPaywallViewFromGa: 0,
        monthTotalPaywallAbonnerenFromGa: 0,
        stap2PaywallView: stap2Row?.paywall_view ?? null,
        stap2PaywallAbonneren: stap2Row?.paywall_abonneren ?? null,
        stap2PaywallInloggen: stap2Row?.paywall_inloggen ?? null,
        stap2Nieuwsbrief: stap2Row?.nieuwsbrief_inschrijving_artikelen ?? null,
        pctMonthPaywallViewTop25ByAbonnement: null,
        pctMonthPaywallAbonnerenTop25ByAbonnement: null,
        pctMonthPaywallViewTop25ByView: null,
        pctMonthPaywallAbonnerenTop25ByView: null,
        uniquePagePathsWithPaywallView: 0,
        uniquePagePathsWithPaywallAbonneren: 0,
      },
      error: msg,
    };
  }
}

export async function fetchHistorischTopArticles(accessToken: string): Promise<HistorischTopArticlesReport> {
  const propertyId = getHistorischPropertyId();
  const emptyTech = (cfg: {
    label: string;
    start: string;
    end: string;
    ym: string;
  }): HistorischTopArticleMonthBundle["technical"] => ({
    monthLabel: cfg.label,
    startDate: cfg.start,
    endDate: cfg.end,
    yearMonthStap2: cfg.ym,
    totalPaywallViewInTable: 0,
    totalPaywallAbonnerenInTable: 0,
    monthTotalPaywallViewFromGa: 0,
    monthTotalPaywallAbonnerenFromGa: 0,
    stap2PaywallView: null,
    stap2PaywallAbonneren: null,
    stap2PaywallInloggen: null,
    stap2Nieuwsbrief: null,
    pctMonthPaywallViewTop25ByAbonnement: null,
    pctMonthPaywallAbonnerenTop25ByAbonnement: null,
    pctMonthPaywallViewTop25ByView: null,
    pctMonthPaywallAbonnerenTop25ByView: null,
    uniquePagePathsWithPaywallView: 0,
    uniquePagePathsWithPaywallAbonneren: 0,
  });

  if (!propertyId) {
    return {
      generatedAt: new Date().toISOString(),
      brand: "Historisch Nieuwsblad",
      propertyEnvKey: "GA4_PROPERTY_HN",
      fatalError: "GA4_PROPERTY_HN ontbreekt.",
      january2024: {
        label: "Januari 2024",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        yearMonthDisplay: "2024-01",
        topByAbonnement: [],
        topByView: [],
        technical: emptyTech({
          label: "Januari 2024",
          start: "2024-01-01",
          end: "2024-01-31",
          ym: "2024-01",
        }),
        error: "Geen property",
      },
      june2024: {
        label: "Juni 2024",
        startDate: "2024-06-01",
        endDate: "2024-06-30",
        yearMonthDisplay: "2024-06",
        topByAbonnement: [],
        topByView: [],
        technical: emptyTech({
          label: "Juni 2024",
          start: "2024-06-01",
          end: "2024-06-30",
          ym: "2024-06",
        }),
        error: "Geen property",
      },
    };
  }

  const funnel = await fetchHistorischFunnelMonthly(accessToken);
  const janStap2 = funnel.rows.find((r) => r.yearMonth === "2024-01");
  const junStap2 = funnel.rows.find((r) => r.yearMonth === "2024-06");

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
  const property = `properties/${propertyId}`;

  const [january2024, june2024] = await Promise.all([
    buildOneMonth(analyticsdata, property, {
      label: "Januari 2024",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
      yearMonthDisplay: "2024-01",
    }, janStap2),
    buildOneMonth(analyticsdata, property, {
      label: "Juni 2024",
      startDate: "2024-06-01",
      endDate: "2024-06-30",
      yearMonthDisplay: "2024-06",
    }, junStap2),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    brand: funnel.brand,
    propertyEnvKey: "GA4_PROPERTY_HN",
    january2024,
    june2024,
  };
}
