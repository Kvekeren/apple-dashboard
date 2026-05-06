import { google } from "googleapis";

export const SITE_URLS: Record<string, string> = {
  "iCreate": "https://www.icreatemagazine.nl/",
  "Gardeners' World": "https://www.gardenersworldmagazine.nl/",
  "Historisch Nieuwsblad": "https://www.historischnieuwsblad.nl/",
  "Auto Review": "https://www.autoreview.nl/",
};

/**
 * Als GSC_SINGLE_PROPERTY_URL is gezet: alleen die property opvragen.
 * Handig als je in GSC één property of property set bekijkt en de totalen wilt matchen.
 * Voorbeeld: GSC_SINGLE_PROPERTY_URL=https://www.gardenersworldmagazine.nl/
 */
function getActiveSiteUrls(): string[] {
  const single = process.env.GSC_SINGLE_PROPERTY_URL?.trim();
  if (single) return [single];
  return Object.values(SITE_URLS);
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

  for (const siteUrl of getActiveSiteUrls()) {
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
  }

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

  for (const siteUrl of getActiveSiteUrls()) {
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
  }

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

  for (const siteUrl of getActiveSiteUrls()) {
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
  }
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

  for (const siteUrl of getActiveSiteUrls()) {
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
  }
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

  for (const siteUrl of getActiveSiteUrls()) {
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
  }
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

  for (const siteUrl of getActiveSiteUrls()) {
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
  }
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
