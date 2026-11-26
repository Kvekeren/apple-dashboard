import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

import { fetchTitleFeed } from "@/lib/agenda-feed";
import { agendaPathKey, agendaUrlKey } from "@/lib/agenda-url";
import { fetchGA4PathViewsForTitle } from "@/lib/ga4";
import { getDateRange } from "@/lib/search-console";
import type { SiteTitleId } from "@/lib/site-titles";

export type ArtikelRow = {
  url: string;
  title: string;
  /** Posttype uit de CMS-feed (Nieuws, Tips, …) — onbekend bij artikelen buiten de feed. */
  type: string | null;
  /** `YYYY-MM-DD` in Nederlandse tijd, of null als onbekend. */
  publishedDate: string | null;
  /** `HH:mm` in Nederlandse tijd, of null als onbekend. */
  publishedTime: string | null;
  pageviews: number;
  /** Gepubliceerd binnen het gekozen tijdvenster. */
  inPeriod: boolean;
};

export type ArtikelenPayload = {
  brand: SiteTitleId;
  meta: { startDate: string; endDate: string; days: number; generatedAt: string };
  rows: ArtikelRow[];
  /** Aantal GA4-toppagina's waarvoor de publicatiedatum (nog) niet bekend is. */
  missingDates: number;
};

/* ------------------------------------------------------------------ */
/* Publicatiedatum + titel uit de artikel-HTML (persistente cache)      */
/* ------------------------------------------------------------------ */

const CACHE_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const PUB_CACHE_FILE = path.join(CACHE_DIR, "published-iso-cache.json");

type PubCacheEntry = { iso: string | null; title: string | null; checkedAt: number };
let pubCache: Record<string, PubCacheEntry> | null = null;

async function loadPubCache(): Promise<Record<string, PubCacheEntry>> {
  if (pubCache) return pubCache;
  try {
    pubCache = existsSync(PUB_CACHE_FILE)
      ? (JSON.parse(await readFile(PUB_CACHE_FILE, "utf-8")) as Record<string, PubCacheEntry>)
      : {};
  } catch {
    pubCache = {};
  }
  return pubCache;
}

async function savePubCache(): Promise<void> {
  if (!pubCache) return;
  try {
    if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(PUB_CACHE_FILE, JSON.stringify(pubCache));
  } catch {
    /* read-only fs */
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/** Meta-tags uit de <head> (lineaire scan, geen backtracking op grote pagina's). */
function metaTags(html: string): Map<string, string> {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 200_000);
  const out = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (key && content && !out.has(key)) out.set(key, content[1] ?? content[2] ?? "");
  }
  return out;
}

export function extractPublishedIso(html: string): string | null {
  const ld = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (ld?.[1]) return ld[1].trim();
  const meta = metaTags(html);
  return (meta.get("article:published_time") ?? meta.get("og:published_time") ?? null)?.trim() || null;
}

/** `null` = tijdelijk mislukt (timeout/netwerk) → niet cachen, later opnieuw proberen. */
async function lookupArticleMeta(url: string): Promise<PubCacheEntry | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AppleDashboard/1.0)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return res.status >= 500 || res.status === 429 ? null : { iso: null, title: null, checkedAt: Date.now() };
    const html = await res.text();
    const ogTitle = metaTags(html).get("og:title");
    return {
      iso: extractPublishedIso(html),
      title: ogTitle ? decodeEntities(ogTitle) : null,
      checkedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/** ISO-string → datum + tijd in Nederlandse tijd. Zonder offset = al lokale sitetijd. */
export function isoToAmsterdam(iso: string): { date: string; time: string } | null {
  const raw = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  const hasOffset = /([+-]\d{2}:?\d{2}|Z)$/i.test(raw);
  if (!hasOffset) {
    return { date: raw.slice(0, 10), time: raw.slice(11, 16) || "00:00" };
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]!);
      }
    })
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* Hoofdfunctie                                                         */
/* ------------------------------------------------------------------ */

/** Hoeveel REST-pagina's (100 items) per posttype we maximaal ophalen. */
function feedPagesForDays(days: number): number {
  if (days <= 28) return 5;
  if (days <= 90) return 10;
  return 20;
}

/**
 * Publicatiedatums van GA4-toppagina's buiten de CMS-feed (oudere artikelen) halen we uit de
 * artikel-HTML. Sommige sites remmen veel gelijktijdige verzoeken af, dus: weinig tegelijk,
 * een tijdsbudget per API-verzoek, en de cache vult zich bij elke verversing verder aan.
 */
const TOP_LOOKUP_CANDIDATES = 60;
const LOOKUP_CONCURRENCY = 4;
const LOOKUP_BUDGET_MS = 10_000;

function stripBrandSuffix(title: string): string {
  return title.replace(/\s+[-|–]\s+(iPhoned|iCulture|iCreate|Android ?Planet|Androidworld)\s*$/i, "").trim();
}

export async function buildArtikelenPayload(
  accessToken: string,
  brand: SiteTitleId,
  days: number
): Promise<ArtikelenPayload> {
  const { startDate, endDate } = getDateRange(days);
  const after = `${startDate}T00:00:00`;

  const t0 = Date.now();
  const [feed, pathViews] = await Promise.all([
    fetchTitleFeed(brand, after, feedPagesForDays(days)).catch((err) => {
      console.error("artikelen feed", brand, err);
      return [];
    }),
    fetchGA4PathViewsForTitle(accessToken, brand, startDate, endDate),
  ]);
  const tFetched = Date.now();

  const viewsByPath = new Map(pathViews.map((p) => [p.pathKey, p]));
  const byKey = new Map<string, ArtikelRow>();
  const pathOf = (url: string) => {
    try {
      return agendaPathKey(new URL(url).pathname);
    } catch {
      return "";
    }
  };

  // 1) Alles uit de CMS-feed (datum + tijd bekend), met pageviews uit het padrapport.
  for (const a of feed) {
    const path = pathOf(a.url);
    if (!path || byKey.has(path)) continue;
    byKey.set(path, {
      url: a.url,
      title: a.headline,
      type: a.type,
      publishedDate: a.date,
      publishedTime: a.time,
      pageviews: viewsByPath.get(path)?.screenPageViews ?? 0,
      inPeriod: a.date >= startDate && a.date <= endDate,
    });
  }

  // 2) GA4-toppagina's die niet in de feed staan (ouder, of buiten de feed-limiet).
  for (const p of pathViews.slice(0, 500)) {
    if (byKey.has(p.pathKey)) continue;
    byKey.set(p.pathKey, {
      url: p.url,
      title: stripBrandSuffix(p.pageTitle),
      type: null,
      publishedDate: null,
      publishedTime: null,
      pageviews: p.screenPageViews,
      inPeriod: false,
    });
  }

  // Toppagina's zonder datum: publicatiedatum uit de artikel-HTML (gecachet per URL).
  const cache = await loadPubCache();
  const undated = [...byKey.values()]
    .filter((r) => !r.publishedDate)
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, TOP_LOOKUP_CANDIDATES);
  const toFetch = undated.filter((r) => !cache[agendaUrlKey(r.url)]);
  if (toFetch.length) {
    const deadline = Date.now() + LOOKUP_BUDGET_MS;
    let fetched = 0;
    const work = mapLimit(toFetch, LOOKUP_CONCURRENCY, async (r) => {
      if (Date.now() > deadline) return;
      const hit = await lookupArticleMeta(r.url);
      if (hit) {
        cache[agendaUrlKey(r.url)] = hit;
        fetched++;
      }
    });
    // Harde grens: lopende lookups mogen het antwoord niet ophouden.
    await Promise.race([work, new Promise((r) => setTimeout(r, LOOKUP_BUDGET_MS + 2000))]);
    if (fetched) await savePubCache();
  }
  const tLookups = Date.now();

  let missingDates = 0;
  for (const row of undated) {
    const hit = cache[agendaUrlKey(row.url)];
    const local = hit?.iso ? isoToAmsterdam(hit.iso) : null;
    if (local) {
      row.publishedDate = local.date;
      row.publishedTime = local.time;
      row.inPeriod = local.date >= startDate && local.date <= endDate;
    } else {
      missingDates++;
    }
    // Rijen buiten de feed hebben alleen een slug als titel; og:title is beter.
    if (hit?.title && row.type == null) row.title = stripBrandSuffix(hit.title);
  }

  console.info(
    `artikelen ${brand} ${days}d: feed ${feed.length}, paden ${pathViews.length}, ` +
      `ophalen ${tFetched - t0}ms, html-lookups (${toFetch.length} kandidaten) ${tLookups - tFetched}ms`
  );

  const rows = [...byKey.values()]
    .filter((r) => r.pageviews > 0 || r.inPeriod)
    .sort((a, b) => b.pageviews - a.pageviews);

  return {
    brand,
    meta: { startDate, endDate, days, generatedAt: new Date().toISOString() },
    rows,
    missingDates,
  };
}
