import { google } from "googleapis";
import {
  HISTORISCH_FUNNEL_BRAND,
  HISTORISCH_FUNNEL_EVENTS,
  formatYearMonthDisplay,
  getHistorischFunnelRange,
  type HistorischFunnelEventName,
  type HistorischFunnelMonthRow,
  type HistorischFunnelMonthlyReport,
  type HistorischFunnelTechnicalMeta,
} from "@/lib/historisch-funnel-shared";

export type {
  HistorischFunnelEventName,
  HistorischFunnelMonthRow,
  HistorischFunnelMonthlyReport,
  HistorischFunnelTechnicalMeta,
} from "@/lib/historisch-funnel-shared";

export { HISTORISCH_FUNNEL_EVENTS, formatYearMonthDisplay, getHistorischFunnelRange } from "@/lib/historisch-funnel-shared";

function getHistorischPropertyId(): string | undefined {
  const id = process.env.GA4_PROPERTY_HN?.trim();
  return id ? id.replace(/^properties\//, "") : undefined;
}

function normalizeYmFromGa(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length >= 6) return d.slice(0, 6);
  return "";
}

export async function fetchHistorischFunnelMonthly(
  accessToken: string,
  referenceDate = new Date()
): Promise<HistorischFunnelMonthlyReport> {
  const propertyId = getHistorischPropertyId();
  const range = getHistorischFunnelRange(referenceDate);

  const baseMeta: HistorischFunnelTechnicalMeta = {
    tableMonthCount: 0,
    expectedMonthCount: range.expectedMonths.length,
    startMonth: range.expectedMonths[0] ? formatYearMonthDisplay(range.expectedMonths[0]) : "—",
    endMonth: range.expectedMonths.length
      ? formatYearMonthDisplay(range.expectedMonths[range.expectedMonths.length - 1])
      : "—",
    eventsWithData: {
      paywall_view: false,
      paywall_abonneren: false,
      paywall_inloggen: false,
      nieuwsbrief_inschrijving_artikelen: false,
    },
    allFourEventsHaveData: false,
    sequenceComplete: range.expectedMonths.length === 0,
    missingMonths: [],
  };

  if (!propertyId) {
    return {
      generatedAt: new Date().toISOString(),
      brand: HISTORISCH_FUNNEL_BRAND,
      propertyEnvKey: "GA4_PROPERTY_HN",
      dateRange: { startDate: range.startDate, endDate: range.endDate },
      rows: [],
      technical: baseMeta,
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
      technical: {
        ...baseMeta,
        sequenceComplete: true,
        missingMonths: [],
      },
      error:
        "Geen maanden in bereik (meest recente volledige maand ligt vóór januari 2024).",
    };
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
  const property = `properties/${propertyId}`;

  const { data } = await analyticsdata.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: "yearMonth" }, { name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: {
            values: [...HISTORISCH_FUNNEL_EVENTS],
          },
        },
      },
      limit: "250000",
    },
  });

  const counts = new Map<string, Record<HistorischFunnelEventName, number>>();
  for (const ym of range.expectedMonths) {
    counts.set(ym, {
      paywall_view: 0,
      paywall_abonneren: 0,
      paywall_inloggen: 0,
      nieuwsbrief_inschrijving_artikelen: 0,
    });
  }

  const rawYmSeen = new Set<string>();

  for (const row of data.rows ?? []) {
    const ymRaw = normalizeYmFromGa(row.dimensionValues?.[0]?.value ?? "");
    const ev = row.dimensionValues?.[1]?.value ?? "";
    const n = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    if (!ymRaw || !counts.has(ymRaw)) continue;
    rawYmSeen.add(ymRaw);
    if (!(HISTORISCH_FUNNEL_EVENTS as readonly string[]).includes(ev)) continue;
    const bucket = counts.get(ymRaw)!;
    bucket[ev as HistorischFunnelEventName] += n;
  }

  const rows: HistorischFunnelMonthRow[] = range.expectedMonths.map((ym) => {
    const c = counts.get(ym)!;
    const pv = c.paywall_view;
    const ratio = (num: number) => (pv > 0 ? num / pv : null);
    return {
      yearMonth: formatYearMonthDisplay(ym),
      paywall_view: c.paywall_view,
      paywall_abonneren: c.paywall_abonneren,
      paywall_inloggen: c.paywall_inloggen,
      nieuwsbrief_inschrijving_artikelen: c.nieuwsbrief_inschrijving_artikelen,
      paywall_abonneer_ratio: ratio(c.paywall_abonneren),
      paywall_login_ratio: ratio(c.paywall_inloggen),
      nieuwsbrief_per_paywall_view: ratio(c.nieuwsbrief_inschrijving_artikelen),
    };
  });

  const eventsWithData: Record<HistorischFunnelEventName, boolean> = {
    paywall_view: false,
    paywall_abonneren: false,
    paywall_inloggen: false,
    nieuwsbrief_inschrijving_artikelen: false,
  };

  for (const ev of HISTORISCH_FUNNEL_EVENTS) {
    const sum = rows.reduce((s, r) => s + r[ev], 0);
    eventsWithData[ev] = sum > 0;
  }

  const missingMonths = range.expectedMonths
    .filter((ym) => !rawYmSeen.has(ym))
    .map((ym) => formatYearMonthDisplay(ym));

  const technical: HistorischFunnelTechnicalMeta = {
    tableMonthCount: rows.length,
    expectedMonthCount: range.expectedMonths.length,
    startMonth: formatYearMonthDisplay(range.expectedMonths[0]),
    endMonth: formatYearMonthDisplay(range.expectedMonths[range.expectedMonths.length - 1]),
    eventsWithData,
    allFourEventsHaveData: HISTORISCH_FUNNEL_EVENTS.every((e) => eventsWithData[e]),
    sequenceComplete: rows.length === range.expectedMonths.length,
    missingMonths,
  };

  return {
    generatedAt: new Date().toISOString(),
    brand: HISTORISCH_FUNNEL_BRAND,
    propertyEnvKey: "GA4_PROPERTY_HN",
    dateRange: { startDate: range.startDate, endDate: range.endDate },
    rows,
    technical,
  };
}
