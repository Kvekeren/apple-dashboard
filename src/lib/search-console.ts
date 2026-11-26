import { google } from "googleapis";

import { dateToIsoYearIsoWeek } from "@/lib/iso-week-range";
import type { SiteTitleLabel } from "@/lib/site-titles";
import { resolveSiteTitles } from "@/lib/site-titles";

/** @deprecated gebruik resolveSiteTitles() — alleen nog voor legacy debug-antwoorden */
export const SITE_URLS: Record<string, string> = Object.fromEntries(
  resolveSiteTitles().map((t) => [t.label, t.gscSiteUrl ?? ""])
);

/**
 * Als GSC_SINGLE_PROPERTY_URL is gezet: alleen die property opvragen.
 */
export function listGscSiteUrls(): string[] {
  const single = process.env.GSC_SINGLE_PROPERTY_URL?.trim();
  if (single) return [single];
  return resolveSiteTitles()
    .map((t) => t.gscSiteUrl)
    .filter((u): u is string => Boolean(u?.trim()));
}

/** Totaal clicks + impressions voor één GSC-property (aggregatie zonder dimensions). */
export async function fetchGscTotalsForSite(
  accessToken: string,
  siteUrl: string,
  type: "web" | "discover",
  startDate: string,
  endDate: string
): Promise<{ clicks: number; impressions: number; error?: string }> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth });

  try {
    const { data } = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        type,
      },
    });
    let sumClicks = 0;
    let sumImp = 0;
    if (data.rows?.length) {
      for (const row of data.rows) {
        sumClicks += row.clicks ?? 0;
        sumImp += row.impressions ?? 0;
      }
    }
    return { clicks: sumClicks, impressions: sumImp };
  } catch (err) {
    console.error(`GSC totals failed for ${siteUrl} (${type}):`, err);
    return { clicks: 0, impressions: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

export type GscTitleSummaries = Record<
  string,
  { web: { clicks: number; impressions: number }; discover: { clicks: number; impressions: number } }
>;

export async function fetchGscSummariesByTitle(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<{
  byTitle: GscTitleSummaries;
  errors: { title: SiteTitleLabel; channel: "web" | "discover"; message: string }[];
}> {
  const byTitle: GscTitleSummaries = {};
  const errors: { title: SiteTitleLabel; channel: "web" | "discover"; message: string }[] = [];

  await Promise.all(
    resolveSiteTitles().map(async (t) => {
    const siteUrl = t.gscSiteUrl;
    if (!siteUrl?.trim()) return;

    const web = await fetchGscTotalsForSite(accessToken, siteUrl, "web", startDate, endDate);
    const disc = await fetchGscTotalsForSite(accessToken, siteUrl, "discover", startDate, endDate);

    byTitle[t.label] = {
      web: { clicks: web.clicks, impressions: web.impressions },
      discover: { clicks: disc.clicks, impressions: disc.impressions },
    };

    if (web.error) errors.push({ title: t.label, channel: "web", message: web.error });
    if (disc.error) errors.push({ title: t.label, channel: "discover", message: disc.error });
  })
  );

  return { byTitle, errors };
}

export interface DiscoverRow {
  url: string;
  clicks: number;
  impressions: number;
}

export interface SearchRow {
  url: string;
  clicks: number;
  impressions: number;
}

export async function fetchSearchData(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<SearchRow[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const searchconsole = google.searchconsole({ version: "v1", auth });
  const allRows: SearchRow[] = [];

  await Promise.all(
    listGscSiteUrls().map(async (siteUrl) => {
    try {
      const { data } = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["page"],
          type: "web",
          aggregationType: "byPage",
          rowLimit: 25000,
        },
      });

      if (data.rows) {
        for (const row of data.rows) {
          const url = row.keys?.[0];
          if (url) {
            allRows.push({
              url,
              clicks: row.clicks ?? 0,
              impressions: row.impressions ?? 0,
            });
          }
        }
      }
    } catch (err) {
      console.error(`GSC search fetch failed for ${siteUrl}:`, err);
    }
  })
  );

  return allRows;
}

export async function fetchDiscoverData(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<DiscoverRow[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const searchconsole = google.searchconsole({ version: "v1", auth });
  const allRows: DiscoverRow[] = [];

  await Promise.all(
    listGscSiteUrls().map(async (siteUrl) => {
    try {
      const { data } = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["page"],
          type: "discover",
          aggregationType: "byPage",
          rowLimit: 25000,
        },
      });

      if (data.rows) {
        for (const row of data.rows) {
          const url = row.keys?.[0];
          if (url) {
            allRows.push({
              url,
              clicks: row.clicks ?? 0,
              impressions: row.impressions ?? 0,
            });
          }
        }
      }
    } catch (err) {
      console.error(`GSC fetch failed for ${siteUrl}:`, err);
    }
  })
  );

  return allRows;
}

/** By-page data per property, voor debug/verificatie. */
export async function fetchDiscoverDataByProperty(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<{ siteUrl: string; rows: DiscoverRow[] }[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const results: { siteUrl: string; rows: DiscoverRow[] }[] = [];

  await Promise.all(
    listGscSiteUrls().map(async (siteUrl) => {
    try {
      const { data } = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["page"],
          type: "discover",
          aggregationType: "byPage",
          rowLimit: 25000,
        },
      });
      const rows: DiscoverRow[] = [];
      if (data.rows) {
        for (const row of data.rows) {
          const url = row.keys?.[0];
          if (url) {
            rows.push({
              url,
              clicks: row.clicks ?? 0,
              impressions: row.impressions ?? 0,
            });
          }
        }
      }
      results.push({ siteUrl, rows });
    } catch (err) {
      console.error(`GSC discover by-property failed for ${siteUrl}:`, err);
      results.push({ siteUrl, rows: [] });
    }
  })
  );
  return results;
}

/** By-page Search data per property, voor debug. */
export async function fetchSearchDataByProperty(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<{ siteUrl: string; rows: SearchRow[] }[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const results: { siteUrl: string; rows: SearchRow[] }[] = [];

  await Promise.all(
    listGscSiteUrls().map(async (siteUrl) => {
    try {
      const { data } = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["page"],
          type: "web",
          aggregationType: "byPage",
          rowLimit: 25000,
        },
      });
      const rows: SearchRow[] = [];
      if (data.rows) {
        for (const row of data.rows) {
          const url = row.keys?.[0];
          if (url) {
            rows.push({
              url,
              clicks: row.clicks ?? 0,
              impressions: row.impressions ?? 0,
            });
          }
        }
      }
      results.push({ siteUrl, rows });
    } catch (err) {
      console.error(`GSC search by-property failed for ${siteUrl}:`, err);
      results.push({ siteUrl, rows: [] });
    }
  })
  );
  return results;
}

/** Haalt de totale clicks direct op per property (geen page-breakdown). Voor verificatie. */
export async function fetchSearchTotals(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<{ siteUrl: string; clicks: number }[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const results: { siteUrl: string; clicks: number }[] = [];

  await Promise.all(
    listGscSiteUrls().map(async (siteUrl) => {
    try {
      const { data } = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["date"],
          type: "web",
          rowLimit: 31,
        },
      });
      const total = data.rows?.reduce((sum, r) => sum + (r.clicks ?? 0), 0) ?? 0;
      results.push({ siteUrl, clicks: total });
    } catch (err) {
      console.error(`GSC search totals failed for ${siteUrl}:`, err);
    }
  })
  );
  return results;
}

/** Haalt de totale Discover-clicks direct op per property. Voor verificatie. */
export async function fetchDiscoverTotals(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<{ siteUrl: string; clicks: number }[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const results: { siteUrl: string; clicks: number }[] = [];

  await Promise.all(
    listGscSiteUrls().map(async (siteUrl) => {
    try {
      const { data } = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["date"],
          type: "discover",
          rowLimit: 31,
        },
      });
      const total = data.rows?.reduce((sum, r) => sum + (r.clicks ?? 0), 0) ?? 0;
      results.push({ siteUrl, clicks: total });
    } catch (err) {
      console.error(`GSC discover totals failed for ${siteUrl}:`, err);
    }
  })
  );
  return results;
}

export function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function getDateRangeOffset(
  days: number,
  offsetDays: number
): { startDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - offsetDays);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

/** Huidige kalendermaand t/m vandaag (inclusief). */
export function getCurrentCalendarMonthRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface GscWeeklyClicksRow {
  source: SiteTitleLabel;
  isoYearIsoWeek: string;
  clicks: number;
}

/** GSC clicks per ISO-week per merk (dagelijkse `date`-dimensie geaggregeerd). */
export async function fetchGscWeeklyClicksForRange(
  accessToken: string,
  type: "web" | "discover",
  startDate: string,
  endDate: string
): Promise<GscWeeklyClicksRow[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const rowsOut: GscWeeklyClicksRow[] = [];

  await Promise.all(
    resolveSiteTitles().map(async (t) => {
    const siteUrl = t.gscSiteUrl;
    if (!siteUrl?.trim()) return;

    const weekClicks = new Map<string, number>();
    try {
      const { data } = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["date"],
          type,
          rowLimit: 400,
        },
      });

      if (data.rows) {
        for (const row of data.rows) {
          const dateStr = row.keys?.[0];
          if (!dateStr) continue;
          const isoKey = dateToIsoYearIsoWeek(dateStr);
          if (!isoKey) continue;
          weekClicks.set(isoKey, (weekClicks.get(isoKey) ?? 0) + (row.clicks ?? 0));
        }
      }
    } catch (err) {
      console.error(`GSC weekly ${type} failed for ${t.label}:`, err);
    }

    for (const [isoYearIsoWeek, clicks] of weekClicks) {
      rowsOut.push({ source: t.label, isoYearIsoWeek, clicks });
    }
  })
  );

  return rowsOut;
}

export interface GscWeeklyClicksYoYPayload {
  current: GscWeeklyClicksRow[];
  previous: GscWeeklyClicksRow[];
}

/** Huidig kalenderjaar YTD + hetzelfde kalendersegment één jaar eerder. */
export async function fetchGscWeeklyClicksYearToDateWithYoY(
  accessToken: string,
  type: "web" | "discover",
  referenceDate = new Date()
): Promise<GscWeeklyClicksYoYPayload> {
  const year = referenceDate.getFullYear();
  const startCurrent = `${year}-01-01`;
  const endCurrent = isoDateLocal(referenceDate);

  const refPrev = new Date(referenceDate);
  refPrev.setFullYear(refPrev.getFullYear() - 1);
  const startPrevious = `${year - 1}-01-01`;
  const endPrevious = isoDateLocal(refPrev);

  const [current, previous] = await Promise.all([
    fetchGscWeeklyClicksForRange(accessToken, type, startCurrent, endCurrent),
    fetchGscWeeklyClicksForRange(accessToken, type, startPrevious, endPrevious),
  ]);

  return { current, previous };
}
