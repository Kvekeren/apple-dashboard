import { google } from "googleapis";

import type { ResolvedSiteTitle } from "@/lib/site-titles";
import { resolveSiteTitles } from "@/lib/site-titles";

function titlesWithGa4(): ResolvedSiteTitle[] {
  return resolveSiteTitles().filter((t) => Boolean(t.ga4PropertyId));
}

/**
 * KPI voor YTD-dashboard: sessies uit GA4 (Analytics Data API metric `sessions`).
 * Consistent voor maandbereiken; realtime gebruikt elders `activeUsers`.
 */

export interface GA4PageviewsByPage {
  url: string;
  count: number;
  source: string;
}

export async function fetchGA4PageviewsByPage(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GA4PageviewsByPage[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const results: GA4PageviewsByPage[] = [];

  for (const t of titlesWithGa4()) {
    const propertyId = t.ga4PropertyId!;
    try {
      const { data } = await analyticsdata.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: "pageLocation" }],
          metrics: [{ name: "screenPageViews" }],
          dateRanges: [{ startDate, endDate }],
        },
      });

      if (data.rows) {
        for (const row of data.rows) {
          const url = row.dimensionValues?.[0]?.value ?? "";
          const count = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
          if (url && count > 0) {
            results.push({ url, count, source: t.label });
          }
        }
      }
    } catch (err) {
      console.error(`GA4 pageviews failed for ${t.label}:`, err);
    }
  }

  return results;
}

export interface GA4ActiveUsers {
  source: string;
  activeUsers: number;
}

export interface GA4RealtimeTopPage {
  source: string;
  url: string;
  pageTitle: string;
  screenPageViews: number;
}

function todayInAmsterdam(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(
    new Date()
  );
}

function normalizePageTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Realtime API: alleen `unifiedScreenName` (paginatitel). */
function isExcludedRealtimeTitle(pageTitle: string, sourceLabel: string): boolean {
  const title = (pageTitle || "").trim();
  if (!title) return true;

  const lower = title.toLowerCase();
  if (lower === "(other)" || lower === "(not set)") return true;
  if (/^(home|homepage|startpagina)$/.test(lower)) return true;
  if (lower === sourceLabel.toLowerCase()) return true;

  return false;
}

function buildTodayUrlBySourceTitle(
  todayPages: GA4TopPageRow[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of todayPages) {
    const key = `${p.source}\0${normalizePageTitleKey(p.pageTitle)}`;
    if (!map.has(key)) map.set(key, p.url);
  }
  return map;
}

export async function fetchGA4RealtimeTopPages(
  accessToken: string,
  limitPerProperty = 5
): Promise<GA4RealtimeTopPage[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const today = todayInAmsterdam();
  const todayPages = await fetchGA4TopPagesByScreenViews(accessToken, today, today, 200);
  const urlBySourceTitle = buildTodayUrlBySourceTitle(todayPages);

  const results: GA4RealtimeTopPage[] = [];
  const fetchLimit = Math.max(limitPerProperty * 12, 60);

  for (const t of titlesWithGa4()) {
    const propertyId = t.ga4PropertyId!;
    try {
      const { data } = await analyticsdata.properties.runRealtimeReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: "unifiedScreenName" }],
          metrics: [{ name: "screenPageViews" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: String(fetchLimit),
        },
      });

      const perSite: GA4RealtimeTopPage[] = [];
      if (data.rows) {
        for (const row of data.rows) {
          const pageTitle = row.dimensionValues?.[0]?.value ?? "(zonder titel)";
          const views = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
          if (views <= 0 || isExcludedRealtimeTitle(pageTitle, t.label)) continue;

          const url = urlBySourceTitle.get(
            `${t.label}\0${normalizePageTitleKey(pageTitle)}`
          );
          if (!url) continue;

          perSite.push({
            source: t.label,
            url,
            pageTitle,
            screenPageViews: views,
          });
        }
      }
      perSite.sort((a, b) => b.screenPageViews - a.screenPageViews);
      results.push(...perSite.slice(0, limitPerProperty));
    } catch (err) {
      console.error(`GA4 realtime top pages failed for ${t.label}:`, err);
    }
  }

  return results;
}

export async function fetchGA4ActiveUsers(accessToken: string): Promise<GA4ActiveUsers[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const results: GA4ActiveUsers[] = [];

  for (const t of resolveSiteTitles()) {
    const propertyId = t.ga4PropertyId;
    if (!propertyId) {
      results.push({ source: t.label, activeUsers: 0 });
      continue;
    }

    try {
      const { data } = await analyticsdata.properties.runRealtimeReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: "country" }],
          metrics: [{ name: "activeUsers" }],
        },
      });

      let count = 0;
      if (data.rows) {
        for (const row of data.rows) {
          const v = row.metricValues?.[0]?.value;
          if (v != null) count += parseInt(String(v), 10);
        }
      }
      results.push({ source: t.label, activeUsers: count });
    } catch (err) {
      console.error(`GA4 realtime activeUsers failed for ${t.label}:`, err);
      results.push({ source: t.label, activeUsers: 0 });
    }
  }

  return results;
}

export interface GA4TopPageRow {
  source: string;
  pageTitle: string;
  /** Volledige URL (GA4 pageLocation) */
  url: string;
  /** GA4 metric screenPageViews in het gekozen tijdsvenster */
  screenPageViews: number;
}

/** Sluit homepage, overzichtspaden en CMS-lijsten uit voor “artikelen”. */
function isLikelyArticlePath(pathRaw: string, pageTitle: string): boolean {
  const title = (pageTitle || "").trim();
  if (!title || title === "(not set)") return false;

  let pathname = pathRaw.trim();
  if (!pathname || pathname === "/") return false;
  try {
    if (pathname.includes("://")) pathname = new URL(pathname).pathname;
  } catch {
    /* pagePath is meestal al een pad */
  }

  const lower = pathname.toLowerCase();
  const exclude =
    /^\/(wp-admin|wp-login|tag|tags|author|authors|categorie|category|categories|zoek|search|feed|page)(\/|$)/i;
  if (exclude.test(lower)) return false;

  return true;
}

export async function fetchGA4TopPagesByScreenViews(
  accessToken: string,
  startDate: string,
  endDate: string,
  limitPerProperty = 120
): Promise<GA4TopPageRow[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const out: GA4TopPageRow[] = [];

  for (const t of titlesWithGa4()) {
    const propertyId = t.ga4PropertyId!;
    try {
      const { data } = await analyticsdata.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: "pageLocation" }, { name: "pageTitle" }],
          metrics: [{ name: "screenPageViews" }],
          dateRanges: [{ startDate, endDate }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: String(limitPerProperty),
        },
      });

      if (data.rows) {
        for (const row of data.rows) {
          const pageLocation = row.dimensionValues?.[0]?.value ?? "";
          const pageTitle = row.dimensionValues?.[1]?.value ?? "";
          const views = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
          let pagePath = pageLocation;
          try {
            if (pageLocation.includes("://")) pagePath = new URL(pageLocation).pathname;
          } catch {
            pagePath = pageLocation;
          }
          if (views > 0 && isLikelyArticlePath(pagePath, pageTitle)) {
            out.push({
              source: t.label,
              pageTitle: pageTitle.trim(),
              url: pageLocation.trim(),
              screenPageViews: views,
            });
          }
        }
      }
    } catch (err) {
      console.error(`GA4 top pages failed for ${t.label}:`, err);
    }
  }

  return out;
}

export interface GA4WeeklySessionsRow {
  source: string;
  /** ISO-jaar + ISO-week (bv. `202603` = week 3 van 2026), zie GA-dimensie `isoYearIsoWeek` */
  isoYearIsoWeek: string;
  sessions: number;
}

/** `sessions` per ISO-week per merk voor één datumbereik (inclusief start/eind). */
export async function fetchGA4WeeklySessionsForRange(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<GA4WeeklySessionsRow[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const rowsOut: GA4WeeklySessionsRow[] = [];

  for (const t of titlesWithGa4()) {
    const propertyId = t.ga4PropertyId!;
    try {
      const { data } = await analyticsdata.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: "isoYearIsoWeek" }],
          metrics: [{ name: "sessions" }],
          dateRanges: [{ startDate, endDate }],
          orderBys: [{ dimension: { dimensionName: "isoYearIsoWeek" } }],
        },
      });

      if (data.rows) {
        for (const row of data.rows) {
          const isoW = row.dimensionValues?.[0]?.value ?? "";
          const sessions = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
          if (isoW) {
            rowsOut.push({ source: t.label, isoYearIsoWeek: isoW, sessions });
          }
        }
      }
    } catch (err) {
      console.error(`GA4 weekly sessions failed for ${t.label}:`, err);
    }
  }

  return rowsOut;
}

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface GA4WeeklySessionsYoYPayload {
  current: GA4WeeklySessionsRow[];
  previous: GA4WeeklySessionsRow[];
}

/** Huidig kalenderjaar YTD + hetzelfde kalendersegment één jaar eerder (1 jan t/m dezelfde maand/dag). */
export async function fetchGA4WeeklySessionsYearToDateWithYoY(
  accessToken: string,
  referenceDate = new Date()
): Promise<GA4WeeklySessionsYoYPayload> {
  const year = referenceDate.getFullYear();
  const startCurrent = `${year}-01-01`;
  const endCurrent = isoDateLocal(referenceDate);

  const refPrev = new Date(referenceDate);
  refPrev.setFullYear(refPrev.getFullYear() - 1);
  const startPrevious = `${year - 1}-01-01`;
  const endPrevious = isoDateLocal(refPrev);

  const [current, previous] = await Promise.all([
    fetchGA4WeeklySessionsForRange(accessToken, startCurrent, endCurrent),
    fetchGA4WeeklySessionsForRange(accessToken, startPrevious, endPrevious),
  ]);

  return { current, previous };
}
