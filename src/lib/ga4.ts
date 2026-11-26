import { google } from "googleapis";
import { after } from "next/server";

import { agendaPagePathVariants, agendaPathKey, agendaUrlKey } from "@/lib/agenda-url";
import { normArticleUrl, slugFromUrl } from "@/lib/monitoring/shared";
import type { ResolvedSiteTitle } from "@/lib/site-titles";
import { resolveSiteTitles, titleFromPageUrl } from "@/lib/site-titles";
import { buildNewsletterDimensionFilter } from "@/lib/wwdc-traffic";
import { kvGet, kvSet } from "@/lib/shared-cache";

function titlesWithGa4(): ResolvedSiteTitle[] {
  return resolveSiteTitles().filter((t) => Boolean(t.ga4PropertyId));
}

/**
 * KPI voor YTD-dashboard: sessies uit GA4 (Analytics Data API metric `sessions`).
 * Consistent voor maandbereiken; realtime gebruikt elders `activeUsers`.
 */

/** Totaal screenPageViews per merk (geen URL-breakdown — geschikt voor YoY-KPI's). */
export async function fetchGA4ScreenPageViewsBySource(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<{ source: string; count: number }[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const results: { source: string; count: number }[] = [];

  await Promise.all(
    titlesWithGa4().map(async (t) => {
    const propertyId = t.ga4PropertyId!;
    try {
      const { data } = await analyticsdata.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          metrics: [{ name: "screenPageViews" }],
          dateRanges: [{ startDate, endDate }],
        },
      });

      let count = 0;
      const row = data.rows?.[0];
      if (row) {
        count = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
      }
      results.push({ source: t.label, count });
    } catch (err) {
      console.error(`GA4 screenPageViews total failed for ${t.label}:`, err);
      results.push({ source: t.label, count: 0 });
    }
  })
  );

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

/** Realtime-titels hebben soms een merk-suffix (" - iCreate") dat in historische data ontbreekt. */
function stripBrandSuffix(title: string, sourceLabel: string): string {
  const escaped = sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return title
    .trim()
    .replace(new RegExp(`\\s[-–|]\\s${escaped}\\s*$`, "i"), "")
    .trim();
}

function titleLookupKeys(title: string, sourceLabel: string): string[] {
  const trimmed = title.trim();
  const stripped = stripBrandSuffix(trimmed, sourceLabel);
  const keys = [normalizePageTitleKey(trimmed)];
  if (stripped !== trimmed) keys.push(normalizePageTitleKey(stripped));
  return keys;
}

/** Zoek de beste titel-match in de lookup-map (fallback na exacte match). */
function bestPartialTitleMatch(
  urlBySourceTitle: Map<string, string>,
  source: string,
  pageTitle: string,
  sourceLabel: string
): { url: string; histTitle: string; matchType: string; score: number } | null {
  const normalized = normalizePageTitleKey(stripBrandSuffix(pageTitle, sourceLabel));
  const prefix = `${source}\0`;
  let best: { url: string; histTitle: string; matchType: string; score: number } | null =
    null;

  for (const [mapKey, url] of urlBySourceTitle) {
    if (!mapKey.startsWith(prefix)) continue;
    const histTitle = mapKey.slice(prefix.length);
    if (!histTitle || histTitle.length < 12 || normalized.length < 12) continue;
    if (/pagina \d+ van/i.test(histTitle)) continue;

    let matchType: string | null = null;
    let score = 0;
    if (histTitle === normalized) {
      matchType = "exact";
      score = normalized.length;
    } else if (normalized.startsWith(histTitle) || histTitle.startsWith(normalized)) {
      matchType = "prefix";
      score = Math.min(normalized.length, histTitle.length);
    }
    if (!matchType || score < PARTIAL_TITLE_MATCH_MIN) continue;

    if (!best || score > best.score) {
      best = { url, histTitle, matchType, score };
    }
  }
  return best;
}

function resolveUrlForRealtimeTitle(
  urlBySourceTitle: Map<string, string>,
  source: string,
  pageTitle: string,
  sourceLabel: string
): { url: string; matchType: string } | undefined {
  for (const key of titleLookupKeys(pageTitle, sourceLabel)) {
    const url = urlBySourceTitle.get(`${source}\0${key}`);
    if (url) return { url, matchType: "exact" };
  }
  const partial = bestPartialTitleMatch(urlBySourceTitle, source, pageTitle, sourceLabel);
  if (partial) return { url: partial.url, matchType: `partial-${partial.matchType}` };
  return undefined;
}

/** Realtime API: alleen `unifiedScreenName` (paginatitel). */
function isExcludedRealtimeTitle(pageTitle: string): boolean {
  const title = (pageTitle || "").trim();
  if (!title) return true;

  const lower = title.toLowerCase();
  return lower === "(other)" || lower === "(not set)";
}

function isHomepageRealtimeTitle(pageTitle: string, sourceLabel: string): boolean {
  const lower = pageTitle.trim().toLowerCase();
  const brand = sourceLabel.toLowerCase();
  if (/^(home|homepage|startpagina)$/.test(lower)) return true;
  if (lower === brand) return true;
  if (lower.startsWith(`${brand} -`) || lower.startsWith(`${brand} –`)) return true;
  if (lower.startsWith(`${brand}:`)) return true;
  return false;
}

function homepageUrlForSite(t: ResolvedSiteTitle): string {
  const raw = t.gscSiteUrl?.trim() || `https://www.${t.primaryDomain}/`;
  try {
    const href = new URL(raw.startsWith("http") ? raw : `https://${raw}`).href;
    return href.endsWith("/") ? href : `${href}/`;
  } catch {
    return `https://www.${t.primaryDomain}/`;
  }
}

function buildUrlBySourceTitle(pages: GA4TopPageRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of pages) {
    for (const key of titleLookupKeys(p.pageTitle, p.source)) {
      const mapKey = `${p.source}\0${key}`;
      if (!map.has(mapKey)) map.set(mapKey, p.url);
    }
  }
  return map;
}

function recentDaysInAmsterdam(days: number): { startDate: string; endDate: string } {
  const endDate = todayInAmsterdam();
  const end = new Date(`${endDate}T12:00:00`);
  end.setDate(end.getDate() - (days - 1));
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const d = String(end.getDate()).padStart(2, "0");
  return { startDate: `${y}-${m}-${d}`, endDate };
}

/** Meer pagina's dan top-artikelen: realtime-lookup moet ook middel-populaire URL's bevatten. */
const REALTIME_URL_LOOKUP_LIMIT = 500;
const PARTIAL_TITLE_MATCH_MIN = 40;
const REALTIME_TITLE_SEARCH_MAX = 6;
const REALTIME_TITLE_SEARCH_MIN_VIEWS = 3;

function siteOriginUrl(t: ResolvedSiteTitle): string {
  const raw = t.gscSiteUrl?.trim() || `https://www.${t.primaryDomain}/`;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.origin;
  } catch {
    return `https://www.${t.primaryDomain}`;
  }
}

function absolutePageLocation(pageLocation: string, site: ResolvedSiteTitle): string {
  const raw = pageLocation.trim();
  if (!raw || raw === "(not set)") return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  const origin = siteOriginUrl(site);
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

function buildUrlFromPagePath(origin: string, pagePath: string): string | undefined {
  // Querystring/hash weg: anders worden tracking-parameters losse "pagina's" (en extreem lang).
  const path = pagePath.trim().split(/[?#]/)[0] ?? "";
  if (!path || path === "(not set)") return undefined;
  if (path === "/") return `${origin}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normArticleUrl(`${origin}${normalized}`);
}

function titleSearchPhrase(pageTitle: string, sourceLabel: string): string {
  const stripped = stripBrandSuffix(pageTitle, sourceLabel);
  const beforeColon = stripped.split(":")[0]?.trim() ?? stripped;
  const phrase = beforeColon.length >= 12 ? beforeColon : stripped;
  return phrase.slice(0, 40);
}

function dedupeRealtimeTopPages(pages: GA4RealtimeTopPage[]): GA4RealtimeTopPage[] {
  const byUrl = new Map<string, GA4RealtimeTopPage>();
  for (const p of pages) {
    const key = normArticleUrl((p.url.split("?")[0] ?? p.url).trim());
    const prev = byUrl.get(key);
    if (!prev || p.screenPageViews > prev.screenPageViews) byUrl.set(key, p);
  }
  return [...byUrl.values()];
}

function mergeTopPagesByUrl(pages: GA4TopPageRow[]): GA4TopPageRow[] {
  const byUrl = new Map<string, GA4TopPageRow>();
  for (const p of pages) {
    const key = normArticleUrl((p.url.split("?")[0] ?? p.url).trim());
    const prev = byUrl.get(key);
    if (!prev || p.screenPageViews > prev.screenPageViews) byUrl.set(key, p);
  }
  return [...byUrl.values()];
}

const REALTIME_LOOKUP_KEY = "realtime-url-lookup-v1";
const REALTIME_LOOKUP_FRESH_MS = 20 * 60 * 1000;
const REALTIME_LOOKUP_STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Titel→URL-opzoektabel voor realtime (GA4-rapporten met paginatitel zijn traag).
 * Gedeeld gecachet: 20 min vers; daarna oude tabel gebruiken en op de achtergrond verversen.
 */
async function fetchRealtimeUrlLookupPages(
  accessToken: string
): Promise<{ pages: GA4TopPageRow[] }> {
  const entry = await kvGet<{ pages: GA4TopPageRow[] }>(REALTIME_LOOKUP_KEY);
  const age = entry ? Date.now() - entry.timestamp : Infinity;
  if (entry && age <= REALTIME_LOOKUP_FRESH_MS) return entry.data;
  const refresh = async () => {
    const fresh = await fetchRealtimeUrlLookupPagesUncached(accessToken);
    await kvSet(REALTIME_LOOKUP_KEY, fresh);
    return fresh;
  };
  if (entry && age <= REALTIME_LOOKUP_STALE_MS) {
    after(() => refresh().then(() => undefined, (err) => console.error("realtime-lookup verversen", err)));
    return entry.data;
  }
  return refresh();
}

async function fetchRealtimeUrlLookupPagesUncached(
  accessToken: string
): Promise<{ pages: GA4TopPageRow[] }> {
  const weekRange = recentDaysInAmsterdam(7);
  const today = todayInAmsterdam();
  const [weekPages, todayPages] = await Promise.all([
    fetchGA4TopPagesByScreenViews(
      accessToken,
      weekRange.startDate,
      weekRange.endDate,
      REALTIME_URL_LOOKUP_LIMIT
    ),
    fetchGA4TopPagesByScreenViews(accessToken, today, today, REALTIME_URL_LOOKUP_LIMIT),
  ]);
  return {
    pages: mergeTopPagesByUrl([...todayPages, ...weekPages]),
  };
}

export async function fetchGA4RealtimeTopPages(
  accessToken: string,
  limitPerProperty = 5
): Promise<GA4RealtimeTopPage[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const recentPages = (await fetchRealtimeUrlLookupPages(accessToken)).pages;
  const urlBySourceTitle = buildUrlBySourceTitle(recentPages);

  const results: GA4RealtimeTopPage[] = [];
  const fetchLimit = Math.max(limitPerProperty * 12, 60);

  await Promise.all(
    titlesWithGa4().map(async (t) => {
    const propertyId = t.ga4PropertyId!;
    const siteOrigin = siteOriginUrl(t);
    let titleSearchCount = 0;
    try {
      const { rows: realtimeRows, hasPagePath } = await fetchRealtimeRowsForSite(
        analyticsdata,
        propertyId,
        fetchLimit
      );

      const perSite: GA4RealtimeTopPage[] = [];

      for (const row of realtimeRows) {
        const { pageTitle, pagePath, views } = row;
        if (views <= 0 || isExcludedRealtimeTitle(pageTitle)) continue;

        let url: string | undefined;

        if (hasPagePath && pagePath) {
          url = buildUrlFromPagePath(siteOrigin, pagePath);
        }

        if (!url) {
          const resolved = resolveUrlForRealtimeTitle(
            urlBySourceTitle,
            t.label,
            pageTitle,
            t.label
          );
          if (resolved) url = resolved.url;
        }

        if (!url && isHomepageRealtimeTitle(pageTitle, t.label)) {
          url = homepageUrlForSite(t);
        }

        if (
          !url &&
          views >= REALTIME_TITLE_SEARCH_MIN_VIEWS &&
          titleSearchCount < REALTIME_TITLE_SEARCH_MAX
        ) {
          titleSearchCount++;
          url = await searchGa4UrlByPageTitle(
            accessToken,
            propertyId,
            pageTitle,
            t.label
          );
        }

        if (!url) continue;

        perSite.push({
          source: t.label,
          url,
          pageTitle,
          screenPageViews: views,
        });
      }

      const deduped = dedupeRealtimeTopPages(perSite);
      deduped.sort((a, b) => b.screenPageViews - a.screenPageViews);
      results.push(...deduped.slice(0, limitPerProperty));
    } catch (err) {
      console.error(`GA4 realtime top pages failed for ${t.label}:`, err);
    }
  })
  );

  return results;
}

export async function fetchGA4ActiveUsers(accessToken: string): Promise<GA4ActiveUsers[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const results: GA4ActiveUsers[] = [];

  await Promise.all(
    resolveSiteTitles().map(async (t) => {
    const propertyId = t.ga4PropertyId;
    if (!propertyId) {
      results.push({ source: t.label, activeUsers: 0 });
      return;
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
  })
  );

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

/** Sectie-indexen (geen artikel) bij ontbrekende GA4-paginatitel. */
const ARTICLE_INDEX_SLUGS = new Set([
  "nieuws",
  "news",
  "apps",
  "gids",
  "reviews",
  "contact",
  "forum",
  "tips",
  "deals",
  "podcast",
  "special",
  "specials",
  "video",
  "videos",
  "archief",
  "privacy",
  "cookie",
  "cookies",
  "login",
  "register",
  "over-ons",
  "overig",
  "shop",
  "winkel",
]);

function pathnameFromPageLocation(pageLocation: string): string {
  const raw = pageLocation.trim();
  if (!raw) return "";
  try {
    if (raw.includes("://")) return new URL(raw).pathname || "/";
    if (raw.includes("/")) {
      const slash = raw.indexOf("/");
      const path = raw.slice(slash);
      return path.startsWith("/") ? path : `/${path}`;
    }
  } catch {
    /* */
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/** Sluit homepage, overzichtspaden en CMS-lijsten uit voor “artikelen”. */
function isLikelyArticlePath(pageLocation: string, pageTitle: string): boolean {
  const pathname = pathnameFromPageLocation(pageLocation);
  if (!pathname || pathname === "/") return false;

  const lower = pathname.toLowerCase();
  const exclude =
    /^\/(wp-admin|wp-login|tag|tags|author|authors|categorie|category|categories|zoek|search|feed|page)(\/|$)/i;
  if (exclude.test(lower)) return false;

  const title = (pageTitle || "").trim();
  if (title && title !== "(not set)") return true;

  // Veel properties (o.a. iPhoned/iCulture) leveren geen pageTitle; filter dan op pad.
  const segments = lower.split("/").filter(Boolean);
  if (segments.length >= 2) return true;
  if (segments.length === 1) return !ARTICLE_INDEX_SLUGS.has(segments[0]!);
  return false;
}

function displayTitleForTopPage(
  pageTitle: string,
  pageLocation: string,
  pathname: string
): string {
  const title = (pageTitle || "").trim();
  if (title && title !== "(not set)") return title;
  if (pageLocation.includes("://")) return slugFromUrl(pageLocation);
  return slugFromUrl(`https://local${pathname.startsWith("/") ? pathname : `/${pathname}`}`);
}

/** GA4-titelzoekopdracht voor pagina's die niet in de top-N lookup staan (bv. nieuw artikel). */
async function searchGa4UrlByPageTitle(
  accessToken: string,
  propertyId: string,
  pageTitle: string,
  sourceLabel: string
): Promise<string | undefined> {
  const phrase = titleSearchPhrase(pageTitle, sourceLabel);
  if (phrase.length < 12) return undefined;

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
  const range = recentDaysInAmsterdam(28);
  const targetKeys = new Set(titleLookupKeys(pageTitle, sourceLabel));

  try {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: "pageLocation" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }],
        dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
        dimensionFilter: {
          filter: {
            fieldName: "pageTitle",
            stringFilter: {
              matchType: "CONTAINS",
              value: phrase,
              caseSensitive: false,
            },
          },
        },
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: "15",
      },
    });

    if (!data.rows) return undefined;

    let fallback: string | undefined;
    for (const row of data.rows) {
      const pageLocation = row.dimensionValues?.[0]?.value ?? "";
      const histTitle = row.dimensionValues?.[1]?.value ?? "";
      if (!isLikelyArticlePath(pageLocation, histTitle)) continue;

      for (const key of titleLookupKeys(histTitle, sourceLabel)) {
        if (targetKeys.has(key)) return pageLocation.trim();
      }
      if (!fallback) fallback = pageLocation.trim();
    }
    return fallback;
  } catch (err) {
    console.error(`GA4 title search failed for ${sourceLabel}:`, err);
  }

  return undefined;
}

async function fetchRealtimeRowsForSite(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  propertyId: string,
  fetchLimit: number
): Promise<{ rows: { pageTitle: string; pagePath?: string; views: number }[]; hasPagePath: boolean }> {
  try {
    const { data } = await analyticsdata.properties.runRealtimeReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: "unifiedScreenName" }, { name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: String(fetchLimit),
      },
    });

    const rows = (data.rows ?? []).map((row) => ({
      pageTitle: row.dimensionValues?.[0]?.value ?? "(zonder titel)",
      pagePath: row.dimensionValues?.[1]?.value ?? undefined,
      views: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    }));
    const hasPagePath = rows.some(
      (r) => r.pagePath && r.pagePath !== "(not set)" && r.pagePath.trim() !== ""
    );
    return { rows, hasPagePath };
  } catch {
    const { data } = await analyticsdata.properties.runRealtimeReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: "unifiedScreenName" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: String(fetchLimit),
      },
    });

    return {
      rows: (data.rows ?? []).map((row) => ({
        pageTitle: row.dimensionValues?.[0]?.value ?? "(zonder titel)",
        views: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      })),
      hasPagePath: false,
    };
  }
}

export async function fetchGA4TopPagesByScreenViews(
  accessToken: string,
  startDate: string,
  endDate: string,
  limitPerProperty = 120,
  onlyTitleId?: string
): Promise<GA4TopPageRow[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const out: GA4TopPageRow[] = [];

  await Promise.all(
    titlesWithGa4().filter((x) => !onlyTitleId || x.id === onlyTitleId).map(async (t) => {
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
          const pathname = pathnameFromPageLocation(pageLocation);
          if (views > 0 && isLikelyArticlePath(pageLocation, pageTitle)) {
            out.push({
              source: t.label,
              pageTitle: displayTitleForTopPage(pageTitle, pageLocation, pathname),
              url: absolutePageLocation(pageLocation, t),
              screenPageViews: views,
            });
          }
        }
      }
    } catch (err) {
      console.error(`GA4 top pages failed for ${t.label}:`, err);
    }
  })
  );

  return out;
}

type Ga4DataClient = ReturnType<typeof google.analyticsdata>;

async function runGa4PagePathReport(
  analyticsdata: Ga4DataClient,
  propertyId: string,
  startDate: string,
  endDate: string,
  paths: string[]
): Promise<{ pagePath: string; views: number }[]> {
  if (!paths.length) return [];
  try {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        dateRanges: [{ startDate, endDate }],
        dimensionFilter: {
          filter: {
            fieldName: "pagePath",
            inListFilter: { values: paths, caseSensitive: false },
          },
        },
        limit: String(Math.min(Math.max(paths.length, 1), 100000)),
      },
    });

    return (data.rows ?? [])
      .map((row) => ({
        pagePath: row.dimensionValues?.[0]?.value ?? "",
        views: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      }))
      .filter((row) => row.pagePath && row.pagePath !== "(not set)" && row.views > 0);
  } catch (err) {
    if (paths.length <= 8) {
      console.error(`GA4 pagePath lookup failed for ${propertyId}:`, err);
      return [];
    }
    const mid = Math.ceil(paths.length / 2);
    const [left, right] = await Promise.all([
      runGa4PagePathReport(analyticsdata, propertyId, startDate, endDate, paths.slice(0, mid)),
      runGa4PagePathReport(analyticsdata, propertyId, startDate, endDate, paths.slice(mid)),
    ]);
    return [...left, ...right];
  }
}

/**
 * Pageviews voor specifieke artikel-URLs (buiten de top-N pageLocation-fetch).
 * Gebruikt `pagePath` zodat UTM-varianten samenvallen.
 */
export async function fetchGA4PageviewsForUrls(
  accessToken: string,
  startDate: string,
  endDate: string,
  urls: string[]
): Promise<{ url: string; screenPageViews: number }[]> {
  const uniqueByKey = new Map<string, string>();
  for (const url of urls) {
    const key = agendaUrlKey(url);
    if (key && !uniqueByKey.has(key)) uniqueByKey.set(key, url);
  }

  const bySite = new Map<string, { site: ResolvedSiteTitle; urls: string[] }>();
  for (const url of uniqueByKey.values()) {
    const site = titleFromPageUrl(url);
    if (!site?.ga4PropertyId) continue;
    const prev = bySite.get(site.id);
    if (prev) prev.urls.push(url);
    else bySite.set(site.id, { site, urls: [url] });
  }
  if (!bySite.size) return [];

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const batches = await Promise.all(
    [...bySite.values()].map(async ({ site, urls: siteUrls }) => {
      const paths = [...new Set(siteUrls.flatMap((url) => agendaPagePathVariants(url)))];
      const rows = await runGa4PagePathReport(
        analyticsdata,
        site.ga4PropertyId!,
        startDate,
        endDate,
        paths
      );
      const viewsByPath = new Map<string, number>();
      for (const row of rows) {
        const key = agendaPathKey(row.pagePath);
        viewsByPath.set(key, (viewsByPath.get(key) ?? 0) + row.views);
      }
      const found: { url: string; screenPageViews: number }[] = [];
      for (const url of siteUrls) {
        let path = "";
        try {
          path = new URL(url).pathname;
        } catch {
          continue;
        }
        const views = viewsByPath.get(agendaPathKey(path));
        if (views != null && views > 0) found.push({ url, screenPageViews: views });
      }
      return found;
    })
  );

  return batches.flat();
}

/**
 * Paginatitels voor een beperkt aantal paden (filter op pagePath), bv. voor artikelen waarvan we
 * de HTML niet kunnen lezen. Klein gefilterd rapport, dus snel. Titel = variant met de meeste views.
 */
export async function fetchGA4TitlesForPaths(
  accessToken: string,
  titleId: string,
  startDate: string,
  endDate: string,
  paths: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const site = titlesWithGa4().find((t) => t.id === titleId);
  if (!site || !paths.length) return out;
  const variants = [...new Set(paths.flatMap((p) => {
    const noSlash = p.replace(/\/+$/, "") || "/";
    return [noSlash, noSlash === "/" ? "/" : `${noSlash}/`];
  }))].slice(0, 500);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
  try {
    const { data } = await analyticsdata.properties.runReport({
      property: `properties/${site.ga4PropertyId}`,
      requestBody: {
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }],
        dateRanges: [{ startDate, endDate }],
        dimensionFilter: { filter: { fieldName: "pagePath", inListFilter: { values: variants } } },
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: "2000",
      },
    });
    for (const row of data.rows ?? []) {
      const key = agendaPathKey(row.dimensionValues?.[0]?.value ?? "");
      const title = (row.dimensionValues?.[1]?.value ?? "").trim();
      if (!key || !title || title === "(not set)" || out.has(key)) continue;
      out.set(key, title);
    }
  } catch (err) {
    console.error(`GA4 titels voor paden mislukt (${titleId}):`, err);
  }
  return out;
}

export interface GA4PathViewsRow {
  /** Volledige URL op het primaire domein van de titel */
  url: string;
  /** Genormaliseerde padsleutel (lowercase, zonder trailing slash) */
  pathKey: string;
  pageTitle: string;
  screenPageViews: number;
}

/**
 * Alle paden van één titel met pageviews in het venster, in één GA4-call
 * (gesorteerd aflopend, max `limit` rijen). Bewust zonder `pageTitle`-dimensie: die maakt het
 * rapport over een jaar 10× trager; titels komen uit de CMS-feed of de artikel-HTML.
 */
export async function fetchGA4PathViewsForTitle(
  accessToken: string,
  titleId: string,
  startDate: string,
  endDate: string,
  limit = 25000
): Promise<GA4PathViewsRow[]> {
  const site = titlesWithGa4().find((t) => t.id === titleId);
  if (!site) return [];
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const { data } = await analyticsdata.properties.runReport({
    property: `properties/${site.ga4PropertyId}`,
    requestBody: {
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      dateRanges: [{ startDate, endDate }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: String(limit),
    },
  });

  const byPath = new Map<string, { path: string; views: number; title: string; titleViews: number }>();
  for (const row of data.rows ?? []) {
    const pagePath = row.dimensionValues?.[0]?.value ?? "";
    const pageTitle = "";
    const views = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    if (!pagePath || pagePath === "(not set)" || views <= 0) continue;
    if (!isLikelyArticlePath(pagePath, pageTitle)) continue;
    const key = agendaPathKey(pagePath);
    const prev = byPath.get(key);
    if (prev) {
      prev.views += views;
      if (views > prev.titleViews && pageTitle && pageTitle !== "(not set)") {
        prev.title = pageTitle;
        prev.titleViews = views;
      }
    } else {
      byPath.set(key, {
        path: pagePath,
        views,
        title: pageTitle && pageTitle !== "(not set)" ? pageTitle : "",
        titleViews: views,
      });
    }
  }

  const base = `https://${site.gscSiteUrl?.includes("://www.") ? "www." : ""}${site.primaryDomain}`;
  return [...byPath.entries()]
    .map(([pathKey, v]) => ({
      url: `${base}${v.path.startsWith("/") ? v.path : `/${v.path}`}`,
      pathKey,
      pageTitle: v.title || slugFromUrl(`${base}${v.path}`),
      screenPageViews: v.views,
    }))
    .sort((a, b) => b.screenPageViews - a.screenPageViews);
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
  endDate: string,
  opts: { metric?: "sessions" | "screenPageViews"; newsletterOnly?: boolean } = {}
): Promise<GA4WeeklySessionsRow[]> {
  const metric = opts.metric ?? "sessions";
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  // Alle titels tegelijk: na elkaar liep dit bij vijf titels en vier reeksen op tot >60 s.
  const perTitle = await Promise.all(
    titlesWithGa4().map(async (t) => {
      const out: GA4WeeklySessionsRow[] = [];
      try {
        const { data } = await analyticsdata.properties.runReport({
          property: `properties/${t.ga4PropertyId!}`,
          requestBody: {
            dimensions: [{ name: "isoYearIsoWeek" }],
            metrics: [{ name: metric }],
            dateRanges: [{ startDate, endDate }],
            orderBys: [{ dimension: { dimensionName: "isoYearIsoWeek" } }],
            ...(opts.newsletterOnly ? { dimensionFilter: buildNewsletterDimensionFilter() } : {}),
          },
        });
        for (const row of data.rows ?? []) {
          const isoW = row.dimensionValues?.[0]?.value ?? "";
          const sessions = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
          if (isoW) out.push({ source: t.label, isoYearIsoWeek: isoW, sessions });
        }
      } catch (err) {
        console.error(`GA4 weekly sessions failed for ${t.label}:`, err);
      }
      return out;
    })
  );
  const rowsOut = perTitle.flat();

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
  referenceDate = new Date(),
  opts: { metric?: "sessions" | "screenPageViews"; newsletterOnly?: boolean } = {}
): Promise<GA4WeeklySessionsYoYPayload> {
  const year = referenceDate.getFullYear();
  const startCurrent = `${year}-01-01`;
  const endCurrent = isoDateLocal(referenceDate);

  const refPrev = new Date(referenceDate);
  refPrev.setFullYear(refPrev.getFullYear() - 1);
  const startPrevious = `${year - 1}-01-01`;
  const endPrevious = isoDateLocal(refPrev);

  const [current, previous] = await Promise.all([
    fetchGA4WeeklySessionsForRange(accessToken, startCurrent, endCurrent, opts),
    fetchGA4WeeklySessionsForRange(accessToken, startPrevious, endPrevious, opts),
  ]);

  return { current, previous };
}
