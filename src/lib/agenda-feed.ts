import { XMLParser } from "fast-xml-parser";

import { titleLabelFromPageUrl, type SiteTitleId } from "@/lib/site-titles";

type TitleId = SiteTitleId;

export type AgendaFeedArticle = {
  id: string;
  titleId: TitleId;
  titleLabel: string;
  headline: string;
  type: string;
  date: string;
  time: string;
  url: string;
  status: "published";
};

export type AgendaFeedPayload = {
  articles: AgendaFeedArticle[];
  meta: {
    after: string;
    counts: Record<TitleId, number>;
  };
};

const IPHONED_TYPES = [
  { rest: "news", type: "Nieuws" },
  { rest: "tips", type: "Tips" },
  { rest: "deal", type: "Deal" },
  { rest: "purchase-advice", type: "Koopadvies" },
  { rest: "reviews", type: "Review" },
];

const ANDROIDPLANET_TYPES = [
  { rest: "news", type: "Nieuws" },
  { rest: "tips", type: "Tips" },
  { rest: "reviews", type: "Review" },
  { rest: "deal", type: "Deal" },
  { rest: "purchase-advice", type: "Koopadvies" },
  { rest: "apps", type: "Apps" },
  { rest: "videos", type: "Video" },
];

const ANDROIDWORLD_TYPES = [
  { rest: "news", type: "Nieuws" },
  { rest: "tips", type: "Tips" },
  { rest: "reviews", type: "Review" },
  { rest: "deal", type: "Aanbieding" },
  { rest: "purchase-advice", type: "Koopadvies" },
  { rest: "background", type: "Achtergrond" },
  { rest: "apps", type: "Apps" },
];

/** WordPress-sites met REST-API per posttype. iCulture heeft de REST-API dicht → RSS. */
const WP_SOURCES: Record<
  Exclude<TitleId, "iculture">,
  { base: string; label: string; types: { rest: string; type: string }[] }
> = {
  iphoned: { base: "https://www.iphoned.nl", label: "iPhoned", types: [] },
  icreate: { base: "https://www.icreatemagazine.nl", label: "iCreate", types: [] },
  androidplanet: {
    base: "https://www.androidplanet.nl",
    label: "Android Planet",
    types: ANDROIDPLANET_TYPES,
  },
  androidworld: { base: "https://androidworld.nl", label: "Androidworld", types: ANDROIDWORLD_TYPES },
};

const ICREATE_TYPES = [
  { rest: "nieuws", type: "Nieuws" },
  { rest: "tips", type: "Tips" },
  { rest: "reviews", type: "Review" },
  { rest: "hardware", type: "Hardware" },
  { rest: "koopadvies", type: "Koopadvies" },
  { rest: "software", type: "Software" },
  { rest: "academy", type: "Academy" },
];

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 19);
}

function decodeTitle(raw: unknown): string {
  const s = typeof raw === "string" ? raw : String(raw ?? "");
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<\/?[^>]+>/g, "")
    .trim();
}

function splitDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: iso.slice(0, 10), time: "09:00" };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Datum + tijd in Nederlandse tijd (RSS-pubDate is UTC). */
function amsterdamDateTime(d: Date): { date: string; time: string } {
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

function titleIdFromLabel(label: string): TitleId | null {
  if (label === "iCreate") return "icreate";
  if (label === "iPhoned") return "iphoned";
  if (label === "iCulture") return "iculture";
  if (label === "Android Planet") return "androidplanet";
  if (label === "Androidworld") return "androidworld";
  return null;
}

function typeFromIcultureUrl(url: string): string {
  if (url.includes("/tips/")) return "Tips";
  if (url.includes("/deals/")) return "Deals";
  if (url.includes("/gids/")) return "Gids";
  if (url.includes("/review")) return "Review";
  if (url.includes("/koopadvies/")) return "Koopadvies";
  return "Nieuws";
}

async function fetchJson(url: string): Promise<{ data: unknown; totalPages: number }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AppleDashboard/1.0)",
      Accept: "application/json",
    },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res) return { data: [], totalPages: 0 };
  if (!res.ok) return { data: [], totalPages: 0 };
  const data = await res.json().catch(() => []);
  const totalPages = Number(res.headers.get("x-wp-totalpages") || "1") || 1;
  return { data, totalPages };
}

async function fetchWpType(
  base: string,
  restType: string,
  typeLabel: string,
  titleId: TitleId,
  titleLabel: string,
  after: string,
  maxPages = 5
): Promise<AgendaFeedArticle[]> {
  const out: AgendaFeedArticle[] = [];
  const firstUrl = `${base}/wp-json/wp/v2/${restType}?per_page=100&after=${encodeURIComponent(after)}&orderby=date&order=desc&_fields=id,date,link,title`;
  const first = await fetchJson(firstUrl);
  const pages = Math.min(first.totalPages || 1, maxPages);
  const batches: unknown[] = Array.isArray(first.data) ? first.data : [];
  // Vervolgpagina's parallel (in groepjes van 5) — bij 12 maanden scheelt dat veel tijd.
  for (let page = 2; page <= pages; page += 5) {
    const group = Array.from({ length: Math.min(5, pages - page + 1) }, (_, i) => page + i);
    const results = await Promise.all(group.map((p) => fetchJson(`${firstUrl}&page=${p}`)));
    for (const next of results) if (Array.isArray(next.data)) batches.push(...next.data);
  }
  for (const row of batches) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { id?: number; date?: string; link?: string; title?: { rendered?: string } };
    if (!rec.link || !rec.date) continue;
    const { date, time } = splitDateTime(rec.date);
    out.push({
      id: `${titleId}-wp-${rec.id ?? rec.link}`,
      titleId,
      titleLabel,
      headline: decodeTitle(rec.title?.rendered),
      type: typeLabel,
      date,
      time,
      url: rec.link,
      status: "published",
    });
  }
  return out;
}

async function fetchIcultureRssPage(
  parser: XMLParser,
  page: number
): Promise<{ link: string; pub: number; title: unknown }[] | null> {
  const url = page === 1 ? "https://www.iculture.nl/feed/" : `https://www.iculture.nl/feed/?paged=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AppleDashboard/1.0)" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const parsed = parser.parse(await res.text());
  let items = parsed?.rss?.channel?.item ?? [];
  if (!Array.isArray(items)) items = items ? [items] : [];
  return (items as { link?: unknown; pubDate?: unknown; title?: unknown }[]).map((item) => ({
    link: typeof item.link === "string" ? item.link : "",
    pub: item.pubDate ? new Date(String(item.pubDate)).getTime() : NaN,
    title: item.title,
  }));
}

async function fetchIcultureRss(after: string, maxPages = 12): Promise<AgendaFeedArticle[]> {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const out: AgendaFeedArticle[] = [];
  const cutoff = new Date(after).getTime();
  // Per groep van 6 pagina's parallel; stop zodra we vóór de cutoff zitten.
  for (let start = 1; start <= maxPages; start += 6) {
    const pages = Array.from({ length: Math.min(6, maxPages - start + 1) }, (_, k) => start + k);
    const results = await Promise.all(pages.map((p) => fetchIcultureRssPage(parser, p)));
    let reachedCutoff = false;
    for (const items of results) {
      if (!items || !items.length) {
        reachedCutoff = true;
        continue;
      }
      for (const item of items) {
        if (!item.link || Number.isNaN(item.pub)) continue;
        if (item.pub < cutoff) {
          reachedCutoff = true;
          continue;
        }
        if (titleIdFromLabel(titleLabelFromPageUrl(item.link)) !== "iculture") continue;
        const { date, time } = amsterdamDateTime(new Date(item.pub));
        out.push({
          id: `iculture-rss-${item.link}`,
          titleId: "iculture",
          titleLabel: "iCulture",
          headline: decodeTitle(item.title),
          type: typeFromIcultureUrl(item.link),
          date,
          time,
          url: item.link,
          status: "published",
        });
      }
    }
    if (reachedCutoff) break;
  }
  return out;
}

WP_SOURCES.iphoned.types = IPHONED_TYPES;
WP_SOURCES.icreate.types = ICREATE_TYPES;

function dedupeAndSort(articles: AgendaFeedArticle[]): AgendaFeedArticle[] {
  const seen = new Set<string>();
  const unique = articles.filter((a) => {
    const key = a.url.replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(a.headline);
  });
  unique.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return unique;
}

/**
 * Gepubliceerde artikelen van één titel sinds `after` (ISO, site-lokale tijd).
 * `maxPages` begrenst het aantal REST/RSS-pagina's per posttype.
 */
export async function fetchTitleFeed(
  titleId: TitleId,
  after: string,
  maxPages = 5
): Promise<AgendaFeedArticle[]> {
  if (titleId === "iculture") {
    return dedupeAndSort(await fetchIcultureRss(after, Math.max(12, maxPages * 3)));
  }
  const src = WP_SOURCES[titleId];
  const batches = await Promise.all(
    src.types.map((t) =>
      fetchWpType(src.base, t.rest, t.type, titleId, src.label, after, maxPages).catch(() => [])
    )
  );
  return dedupeAndSort(batches.flat());
}

export function feedAfterIso(days: number): string {
  return daysAgoIso(days);
}

export async function fetchAgendaFeed(): Promise<AgendaFeedPayload> {
  const after = daysAgoIso(28);
  const ids: TitleId[] = ["icreate", "iphoned", "iculture", "androidplanet", "androidworld"];
  const perTitle = await Promise.all(ids.map((id) => fetchTitleFeed(id, after)));
  const unique = dedupeAndSort(perTitle.flat());
  const counts = Object.fromEntries(
    ids.map((id) => [id, unique.filter((a) => a.titleId === id).length])
  ) as Record<TitleId, number>;

  return { articles: unique, meta: { after, counts } };
}
