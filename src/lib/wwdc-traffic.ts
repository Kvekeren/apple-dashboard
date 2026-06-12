import { google } from "googleapis";

import { slugFromUrl } from "@/lib/monitoring/shared";
import type { SiteTitleId, SiteTitleLabel } from "@/lib/site-titles";
import { getTitleById, titleLabelFromPageUrl } from "@/lib/site-titles";

export type WwdcTrafficChannel = "discover" | "googleSearch" | "newsletter";

export interface WwdcArticleTrafficRow {
  url: string;
  pageTitle: string;
  /** Totaal GA4 screenPageViews in de periode */
  pageviews: number;
  /** GSC Discover-clicks in de periode */
  discover: number;
  /** GSC Search-clicks (web) in de periode */
  googleSearch: number;
  /** GA4 screenPageViews via nieuwsbrief-sessies (o.a. nieuwsbrief_ic) */
  newsletter: number;
}

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

function isLikelyArticlePath(pageLocation: string, pageTitle: string): boolean {
  const pathname = pathnameFromPageLocation(pageLocation);
  if (!pathname || pathname === "/") return false;

  const lower = pathname.toLowerCase();
  const exclude =
    /^\/(wp-admin|wp-login|tag|tags|author|authors|categorie|category|categories|zoek|search|feed|page)(\/|$)/i;
  if (exclude.test(lower)) return false;

  const title = (pageTitle || "").trim();
  if (title && title !== "(not set)") return true;

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

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/** Canonicaliseer URL voor matching tussen GA4 en GSC (www, trailing slash). */
function canonicalUrlKey(url: string): string {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "") || "/";
    return `${u.protocol}//${u.hostname}${path}`;
  } catch {
    return normalizeUrl(url);
  }
}

function pageKeyFromGa4(hostName: string, pagePath: string): string {
  const host = hostName.toLowerCase().trim().replace(/^www\./, "");
  const path = (pagePath.trim().startsWith("/") ? pagePath.trim() : `/${pagePath.trim()}`).replace(
    /\/$/,
    ""
  ) || "/";
  return `https://${host}${path}`;
}

/** Map GA4-sessie-attributie naar nieuwsbrief-verkeer. */
export function classifyNewsletterTraffic(
  sessionSource: string,
  sessionMedium: string,
  channelGroup: string
): boolean {
  const source = sessionSource.toLowerCase().trim();
  const medium = sessionMedium.toLowerCase().trim();
  const channel = channelGroup.toLowerCase().trim();
  const combined = `${source} / ${medium}`;

  if (!source && !medium && !channel) return false;
  if (source === "(not set)" && medium === "(not set)" && !channel) return false;

  if (source.startsWith("nieuwsbrief_")) return true;
  if (source === "nieuwsbrief" || source.includes("nieuwsbrief")) return true;
  if (source === "newsletter" || source.includes("newsletter")) return true;

  if (channel === "email") return true;

  if (medium === "email" || medium === "e-mail" || medium === "e_mail") return true;

  const espPatterns = [
    "mailchimp",
    "activecampaign",
    "spotler",
    "mailblue",
    "selligent",
    "copernica",
    "mailplus",
    "laposta",
    "cm.com",
    "revista",
  ];
  if (espPatterns.some((p) => source.includes(p) || combined.includes(p))) return true;

  return combined.includes("nieuwsbrief") || combined.includes("newsletter");
}

/** @deprecated gebruik classifyNewsletterTraffic */
export function classifyNewsletterSourceMedium(sourceMedium: string): boolean {
  const [source = "", medium = ""] = sourceMedium.split("/").map((s) => s.trim());
  return classifyNewsletterTraffic(source, medium, "");
}

/** GA4-dimensionFilter: sessies met nieuwsbrief-herkomst (o.a. nieuwsbrief_ic). */
export function buildNewsletterDimensionFilter() {
  const sourceContains = (value: string) => ({
    filter: {
      fieldName: "sessionSource",
      stringFilter: { matchType: "CONTAINS" as const, value, caseSensitive: false },
    },
  });

  const sourceExact = (value: string) => ({
    filter: {
      fieldName: "sessionSource",
      stringFilter: { matchType: "EXACT" as const, value, caseSensitive: false },
    },
  });

  return {
    orGroup: {
      expressions: [
        sourceExact("nieuwsbrief_ic"),
        sourceExact("nieuwsbrief_ip"),
        sourceExact("nieuwsbrief_iculture"),
        sourceContains("nieuwsbrief_"),
        sourceContains("nieuwsbrief"),
        sourceContains("newsletter"),
        {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: { matchType: "EXACT" as const, value: "Email" },
          },
        },
        {
          filter: {
            fieldName: "sessionMedium",
            stringFilter: { matchType: "EXACT" as const, value: "email" },
          },
        },
        {
          filter: {
            fieldName: "sessionCampaignName",
            stringFilter: { matchType: "CONTAINS" as const, value: "nieuwsbrief", caseSensitive: false },
          },
        },
      ],
    },
  };
}

type PageAgg = {
  pageTitle: string;
  pageviews: number;
  discover: number;
  googleSearch: number;
  newsletter: number;
};

function isGa4NotSet(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v || v === "(not set)" || v === "(not provided)";
}

function ingestPageRow(
  byUrl: Map<string, PageAgg>,
  hostName: string,
  pagePath: string,
  pageTitle: string,
  views: number,
  field: "pageviews" | "newsletter"
) {
  if (isGa4NotSet(hostName) || isGa4NotSet(pagePath)) return;

  const pageLocation = pageKeyFromGa4(hostName, pagePath);
  const pathname = pathnameFromPageLocation(pageLocation);
  if (views <= 0 || !isLikelyArticlePath(pageLocation, pageTitle)) return;

  const url = canonicalUrlKey(pageLocation);
  if (isGa4NotSet(url) || url.toLowerCase().includes("(not set)")) return;
  const title = displayTitleForTopPage(pageTitle, pageLocation, pathname);
  const prev = byUrl.get(url);

  if (!prev) {
    byUrl.set(url, {
      pageTitle: title,
      pageviews: field === "pageviews" ? views : 0,
      discover: 0,
      googleSearch: 0,
      newsletter: field === "newsletter" ? views : 0,
    });
  } else {
    prev[field] += views;
    if (title && title !== "(not set)" && (!prev.pageTitle || prev.pageTitle === "(not set)")) {
      prev.pageTitle = title;
    }
  }
}

async function fetchGa4PageviewsByUrl(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensionFilter?: ReturnType<typeof buildNewsletterDimensionFilter>
): Promise<{ hostName: string; pagePath: string; pageTitle: string; views: number }[]> {
  const { data } = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dimensions: [
        { name: "hostName" },
        { name: "pagePath" },
        { name: "pageTitle" },
      ],
      metrics: [{ name: "screenPageViews" }],
      dateRanges: [{ startDate, endDate }],
      ...(dimensionFilter ? { dimensionFilter } : {}),
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: "10000",
    },
  });

  const rows: { hostName: string; pagePath: string; pageTitle: string; views: number }[] = [];
  for (const row of data.rows ?? []) {
    const views = parseInt(row.metricValues?.[0]?.value ?? "0", 10);
    rows.push({
      hostName: row.dimensionValues?.[0]?.value ?? "",
      pagePath: row.dimensionValues?.[1]?.value ?? "",
      pageTitle: row.dimensionValues?.[2]?.value ?? "",
      views,
    });
  }
  return rows;
}

/** GSC-clicks per URL, gefilterd op één merk. */
export function buildGscClicksByUrlForBrand(
  rows: { url: string; clicks: number }[],
  brandLabel: SiteTitleLabel
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (titleLabelFromPageUrl(row.url) !== brandLabel) continue;
    const key = canonicalUrlKey(row.url);
    map.set(key, (map.get(key) ?? 0) + row.clicks);
  }
  return map;
}

export function lookupGscClicks(map: Map<string, number>, url: string): number {
  return map.get(canonicalUrlKey(url)) ?? 0;
}

export function mergeGscIntoWwdcRows(
  rows: WwdcArticleTrafficRow[],
  discoverByUrl: Map<string, number>,
  searchByUrl: Map<string, number>
): WwdcArticleTrafficRow[] {
  return rows.map((row) => ({
    ...row,
    discover: lookupGscClicks(discoverByUrl, row.url),
    googleSearch: lookupGscClicks(searchByUrl, row.url),
  }));
}

export async function fetchGA4WwdcArticleTraffic(
  accessToken: string,
  brandId: SiteTitleId,
  startDate: string,
  endDate: string,
  limit = 25
): Promise<WwdcArticleTrafficRow[]> {
  const propertyId = getTitleById(brandId)?.ga4PropertyId;
  if (!propertyId) return [];

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const byUrl = new Map<string, PageAgg>();

  try {
    const totalRows = await fetchGa4PageviewsByUrl(
      analyticsdata,
      propertyId,
      startDate,
      endDate
    );
    for (const row of totalRows) {
      ingestPageRow(
        byUrl,
        row.hostName,
        row.pagePath,
        row.pageTitle,
        row.views,
        "pageviews"
      );
    }
  } catch (err) {
    console.error(`GA4 WWDC total traffic failed for ${brandId}:`, err);
  }

  try {
    const newsletterRows = await fetchGa4PageviewsByUrl(
      analyticsdata,
      propertyId,
      startDate,
      endDate,
      buildNewsletterDimensionFilter()
    );
    for (const row of newsletterRows) {
      ingestPageRow(
        byUrl,
        row.hostName,
        row.pagePath,
        row.pageTitle,
        row.views,
        "newsletter"
      );
    }
  } catch (err) {
    console.error(`GA4 WWDC newsletter traffic failed for ${brandId}:`, err);
  }

  return [...byUrl.entries()]
    .filter(([url]) => !isGa4NotSet(url) && !url.toLowerCase().includes("(not set)"))
    .map(([url, v]) => ({
      url,
      pageTitle: v.pageTitle,
      pageviews: v.pageviews,
      discover: v.discover,
      googleSearch: v.googleSearch,
      newsletter: v.newsletter,
    }))
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, limit);
}

export type WwdcBrandTotals = {
  pageviews: number;
  discover: number;
  googleSearch: number;
  newsletter: number;
};

export function sumGscClicksForBrand(
  rows: { url: string; clicks: number }[],
  brandLabel: SiteTitleLabel
): number {
  let total = 0;
  for (const value of buildGscClicksByUrlForBrand(rows, brandLabel).values()) {
    total += value;
  }
  return total;
}

async function fetchGa4BrandMetricTotal(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  propertyId: string,
  startDate: string,
  endDate: string,
  dimensionFilter?: ReturnType<typeof buildNewsletterDimensionFilter>
): Promise<number> {
  const { data } = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      metrics: [{ name: "screenPageViews" }],
      dateRanges: [{ startDate, endDate }],
      ...(dimensionFilter ? { dimensionFilter } : {}),
    },
  });

  return parseInt(data.rows?.[0]?.metricValues?.[0]?.value ?? "0", 10);
}

export async function fetchGA4WwdcBrandTotals(
  accessToken: string,
  brandId: SiteTitleId,
  startDate: string,
  endDate: string,
  discoverRows: { url: string; clicks: number }[],
  searchRows: { url: string; clicks: number }[]
): Promise<WwdcBrandTotals> {
  const brandLabel = getTitleById(brandId)?.label;
  if (!brandLabel) {
    return { pageviews: 0, discover: 0, googleSearch: 0, newsletter: 0 };
  }

  const propertyId = getTitleById(brandId)?.ga4PropertyId;
  if (!propertyId) {
    return {
      pageviews: 0,
      discover: sumGscClicksForBrand(discoverRows, brandLabel),
      googleSearch: sumGscClicksForBrand(searchRows, brandLabel),
      newsletter: 0,
    };
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  let pageviews = 0;
  let newsletter = 0;

  try {
    pageviews = await fetchGa4BrandMetricTotal(
      analyticsdata,
      propertyId,
      startDate,
      endDate
    );
  } catch (err) {
    console.error(`GA4 WWDC brand pageviews failed for ${brandId}:`, err);
  }

  try {
    newsletter = await fetchGa4BrandMetricTotal(
      analyticsdata,
      propertyId,
      startDate,
      endDate,
      buildNewsletterDimensionFilter()
    );
  } catch (err) {
    console.error(`GA4 WWDC brand newsletter failed for ${brandId}:`, err);
  }

  return {
    pageviews,
    discover: sumGscClicksForBrand(discoverRows, brandLabel),
    googleSearch: sumGscClicksForBrand(searchRows, brandLabel),
    newsletter,
  };
}
