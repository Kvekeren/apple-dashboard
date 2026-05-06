import { google } from "googleapis";

export const HISTORISCH_BRAND = "Historisch Nieuwsblad";

const TARGET_EVENTS = [
  "paywall_view",
  "paywall_abonneren",
  "paywall_inloggen",
  "nieuwsbrief_inschrijving_artikelen",
] as const;

export type HistorischProbeEvent = (typeof TARGET_EVENTS)[number];

export interface PeriodSpec {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

/** Meest recente volledige maand t.o.v. peildatum (lokale datum). */
export function getHistorischDefaultPeriods(reference: Date = new Date()): PeriodSpec[] {
  const y = reference.getFullYear();
  const m = reference.getMonth(); // 0–11; huidige maand is onvolledig tot einde maand
  const lastFull = new Date(y, m - 1, 1);
  const endY = lastFull.getFullYear();
  const endM = lastFull.getMonth();
  const endDay = new Date(endY, endM + 1, 0).getDate();
  const endIso = `${endY}-${String(endM + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

  return [
    {
      id: "2024-01",
      label: "Januari 2024",
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    },
    {
      id: "2024-06",
      label: "Juni 2024",
      startDate: "2024-06-01",
      endDate: "2024-06-30",
    },
    {
      id: "2025-01_tot_laatste_volle_maand",
      label: `Januari 2025 – ${endIso.slice(0, 7)} (laatste volledige maand)`,
      startDate: "2025-01-01",
      endDate: endIso,
    },
  ];
}

export interface OkSampleTable {
  headers: string[];
  rows: string[][];
}

export interface PeriodAvailability {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  apiReachable: boolean;
  error?: string;
  /** Totaal sessions in het venster (0 = leeg maar wel OK). */
  sessions?: number;
  sample?: OkSampleTable;
}

export interface EventAvailability {
  eventName: HistorischProbeEvent;
  /** Totaal eventCount over brede range. */
  totalEventCount: number;
  hasData: boolean;
  sample?: OkSampleTable;
  error?: string;
}

export interface DimensionProbe {
  displayName: string;
  apiDimension: string;
  /** Event waarmee de probe liep (eerste met data). */
  eventUsed?: string;
  available: boolean;
  error?: string;
  sample?: OkSampleTable;
}

export interface NewUsersProbe {
  displayName: string;
  available: boolean;
  note?: string;
  error?: string;
  sample?: OkSampleTable;
}

export interface HistorischGa4AvailabilityReport {
  generatedAt: string;
  brand: string;
  propertyEnvKey: string;
  propertyIdConfigured: boolean;
  dataSource: string;
  periods: PeriodAvailability[];
  events: EventAvailability[];
  dimensions: DimensionProbe[];
  newUsers: NewUsersProbe;
  /** Ruwe fout als property ontbreekt of client niet te bouwen is. */
  fatalError?: string;
}

function getHistorischPropertyId(): string | undefined {
  const id = process.env.GA4_PROPERTY_HN?.trim();
  return id || undefined;
}

function errMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

function rowsToSample(
  rowHeaders: string[],
  data:
    | {
        rows?: Array<{
          dimensionValues?: Array<{ value?: string | null }>;
          metricValues?: Array<{ value?: string | null }>;
        }>;
      }
    | undefined,
  maxRows = 5,
  metricHeaders: string[] = ["eventCount"]
): OkSampleTable | undefined {
  if (!data?.rows?.length) return undefined;
  const tableHeaders = [...rowHeaders, ...metricHeaders];
  const out: string[][] = [];
  for (let i = 0; i < Math.min(maxRows, data.rows.length); i++) {
    const row = data.rows[i];
    const dims = (row.dimensionValues ?? []).map((d) => d.value ?? "");
    const metrics = (row.metricValues ?? []).map((m) => m.value ?? "");
    out.push([
      ...dims.slice(0, rowHeaders.length),
      ...metrics.slice(0, metricHeaders.length),
    ]);
  }
  return { headers: tableHeaders, rows: out };
}

export async function fetchHistorischGa4Availability(
  accessToken: string,
  referenceDate = new Date()
): Promise<HistorischGa4AvailabilityReport> {
  const propertyRaw = getHistorischPropertyId();
  const periods = getHistorischDefaultPeriods(referenceDate);

  const base: HistorischGa4AvailabilityReport = {
    generatedAt: new Date().toISOString(),
    brand: HISTORISCH_BRAND,
    propertyEnvKey: "GA4_PROPERTY_HN",
    propertyIdConfigured: !!propertyRaw,
    dataSource: "Google Analytics Data API v1beta (`properties.runReport`)",
    periods: [],
    events: [],
    dimensions: [],
    newUsers: { displayName: "Nieuwe gebruikers (metric: newUsers)", available: false },
  };

  if (!propertyRaw) {
    return {
      ...base,
      fatalError: "GA4_PROPERTY_HN ontbreekt in omgeving.",
    };
  }

  const propertyId = propertyRaw.replace(/^properties\//, "");
  const property = `properties/${propertyId}`;

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const periodResults: PeriodAvailability[] = [];
  for (const p of periods) {
    try {
      const { data } = await analyticsdata.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: p.startDate, endDate: p.endDate }],
          metrics: [{ name: "sessions" }],
        },
      });
      let sessions = 0;
      if (data.rows?.[0]?.metricValues?.[0]?.value) {
        sessions = parseInt(data.rows[0].metricValues[0].value, 10);
      }
      let sample: OkSampleTable | undefined;
      try {
        const sampleReport = await analyticsdata.properties.runReport({
          property,
          requestBody: {
            dateRanges: [{ startDate: p.startDate, endDate: p.endDate }],
            metrics: [{ name: "sessions" }],
            dimensions: [{ name: "date" }],
            limit: "5",
          },
        });
        sample = rowsToSample(["date"], sampleReport.data, 5, ["sessions"]);
      } catch {
        sample = undefined;
      }
      periodResults.push({
        id: p.id,
        label: p.label,
        startDate: p.startDate,
        endDate: p.endDate,
        apiReachable: true,
        sessions,
        sample,
      });
    } catch (err) {
      periodResults.push({
        id: p.id,
        label: p.label,
        startDate: p.startDate,
        endDate: p.endDate,
        apiReachable: false,
        error: errMessage(err),
      });
    }
  }

  const wideStart = "2024-01-01";
  const wideEnd = periods[2]?.endDate ?? referenceDate.toISOString().slice(0, 10);

  const eventResults: EventAvailability[] = [];
  for (const eventName of TARGET_EVENTS) {
    try {
      const { data } = await analyticsdata.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: wideStart, endDate: wideEnd }],
          metrics: [{ name: "eventCount" }],
          dimensions: [{ name: "eventName" }],
          dimensionFilter: {
            filter: {
              fieldName: "eventName",
              stringFilter: { value: eventName, matchType: "EXACT" },
            },
          },
          limit: "5",
        },
      });
      let total = 0;
      if (data.rows) {
        for (const row of data.rows) {
          total += parseInt(row.metricValues?.[0]?.value ?? "0", 10);
        }
      }
      eventResults.push({
        eventName,
        totalEventCount: total,
        hasData: total > 0,
        sample: rowsToSample(["eventName"], data),
      });
    } catch (err) {
      eventResults.push({
        eventName,
        totalEventCount: 0,
        hasData: false,
        error: errMessage(err),
      });
    }
  }

  const firstEventWithData =
    eventResults.find((e) => e.hasData && !e.error)?.eventName ?? TARGET_EVENTS[0];

  const dimensionSpecs: Array<{ displayName: string; apiDimension: string }> = [
    { displayName: "Jaar-maand", apiDimension: "yearMonth" },
    { displayName: "Paginapad", apiDimension: "pagePath" },
    { displayName: "Paginatitel", apiDimension: "pageTitle" },
    { displayName: "Bron / medium (sessie)", apiDimension: "sessionSourceMedium" },
    { displayName: "Standaard kanaalgroep", apiDimension: "sessionDefaultChannelGroup" },
    { displayName: "Apparaatcategorie", apiDimension: "deviceCategory" },
  ];

  const dimensionProbes: DimensionProbe[] = [];
  for (const spec of dimensionSpecs) {
    try {
      const { data } = await analyticsdata.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate: wideStart, endDate: wideEnd }],
          metrics: [{ name: "eventCount" }],
          dimensions: [{ name: spec.apiDimension }, { name: "eventName" }],
          dimensionFilter: {
            filter: {
              fieldName: "eventName",
              stringFilter: { value: firstEventWithData, matchType: "EXACT" },
            },
          },
          limit: "5",
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        },
      });
      dimensionProbes.push({
        displayName: spec.displayName,
        apiDimension: spec.apiDimension,
        eventUsed: firstEventWithData,
        available: true,
        sample: rowsToSample([spec.apiDimension, "eventName"], data),
      });
    } catch (err) {
      dimensionProbes.push({
        displayName: spec.displayName,
        apiDimension: spec.apiDimension,
        eventUsed: firstEventWithData,
        available: false,
        error: errMessage(err),
      });
    }
  }

  let newUsersProbe: NewUsersProbe = {
    displayName: "Nieuwe gebruikers (metric: newUsers)",
    available: false,
  };
  try {
    const { data } = await analyticsdata.properties.runReport({
      property,
      requestBody: {
        dateRanges: [{ startDate: wideStart, endDate: wideEnd }],
        metrics: [{ name: "eventCount" }, { name: "newUsers" }],
        dimensions: [{ name: "yearMonth" }, { name: "eventName" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            stringFilter: { value: firstEventWithData, matchType: "EXACT" },
          },
        },
        limit: "5",
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      },
    });
    newUsersProbe = {
      displayName: "Nieuwe gebruikers (metric: newUsers)",
      available: true,
      note: `Gecombineerd met dimensies yearMonth + eventName, gefilterd op ${firstEventWithData}.`,
      sample: rowsToSample(["yearMonth", "eventName"], data, 5, [
        "eventCount",
        "newUsers",
      ]),
    };
  } catch (err) {
    newUsersProbe = {
      displayName: "Nieuwe gebruikers (metric: newUsers)",
      available: false,
      error: errMessage(err),
      note: "Combinatie eventCount + newUsers met eventFilter wordt door de API geweigerd of niet ondersteund.",
    };
  }

  return {
    ...base,
    periods: periodResults,
    events: eventResults,
    dimensions: dimensionProbes,
    newUsers: newUsersProbe,
  };
}
