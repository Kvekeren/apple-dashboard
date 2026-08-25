import { XMLParser } from "fast-xml-parser";
import { NextResponse } from "next/server";
import { titleLabelFromPageUrl } from "@/lib/site-titles";

export const revalidate = 300;

type TitleId = "icreate" | "iphoned" | "iculture";

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

const AFTER = daysAgoIso(28);

const IPHONED_TYPES = [
  { rest: "news", type: "Nieuws" },
  { rest: "tips", type: "Tips" },
  { rest: "deal", type: "Deal" },
  { rest: "purchase-advice", type: "Koopadvies" },
  { rest: "reviews", type: "Review" },
];

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

function titleIdFromLabel(label: string): TitleId | null {
  if (label === "iCreate") return "icreate";
  if (label === "iPhoned") return "iphoned";
  if (label === "iCulture") return "iculture";
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
  });
  if (!res.ok) return { data: [], totalPages: 0 };
  const data = await res.json();
  const totalPages = Number(res.headers.get("x-wp-totalpages") || "1") || 1;
  return { data, totalPages };
}

async function fetchWpType(
  base: string,
  restType: string,
  typeLabel: string,
  titleId: TitleId,
  titleLabel: string
): Promise<AgendaFeedArticle[]> {
  const out: AgendaFeedArticle[] = [];
  const firstUrl = `${base}/wp-json/wp/v2/${restType}?per_page=100&after=${encodeURIComponent(AFTER)}&orderby=date&order=desc&_fields=id,date,link,title`;
  const first = await fetchJson(firstUrl);
  const pages = Math.min(first.totalPages || 1, 5);
  const batches: unknown[] = Array.isArray(first.data) ? first.data : [];
  for (let page = 2; page <= pages; page++) {
    const next = await fetchJson(`${firstUrl}&page=${page}`);
    if (Array.isArray(next.data)) batches.push(...next.data);
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

async function fetchIcultureRss(): Promise<AgendaFeedArticle[]> {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const out: AgendaFeedArticle[] = [];
  const cutoff = new Date(AFTER).getTime();
  for (let page = 1; page <= 12; page++) {
    const url =
      page === 1
        ? "https://www.iculture.nl/feed/"
        : `https://www.iculture.nl/feed/?paged=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AppleDashboard/1.0)" },
      next: { revalidate: 300 },
    });
    if (!res.ok) break;
    const xml = await res.text();
    const parsed = parser.parse(xml);
    let items = parsed?.rss?.channel?.item ?? [];
    if (!Array.isArray(items)) items = items ? [items] : [];
    if (!items.length) break;
    let oldest = Date.now();
    for (const item of items) {
      const link = typeof item.link === "string" ? item.link : "";
      const pub = item.pubDate ? new Date(item.pubDate).getTime() : NaN;
      if (!link || Number.isNaN(pub)) continue;
      if (pub < oldest) oldest = pub;
      if (pub < cutoff) continue;
      const { date, time } = splitDateTime(new Date(pub).toISOString());
      const titleId = titleIdFromLabel(titleLabelFromPageUrl(link));
      if (titleId !== "iculture") continue;
      out.push({
        id: `iculture-rss-${date}-${out.length}`,
        titleId: "iculture",
        titleLabel: "iCulture",
        headline: decodeTitle(item.title),
        type: typeFromIcultureUrl(link),
        date,
        time,
        url: link,
        status: "published",
      });
    }
    if (oldest < cutoff) break;
  }
  return out;
}

export async function GET() {
  try {
    const [iphoned, icreate, iculture] = await Promise.all([
      Promise.all(
        IPHONED_TYPES.map((t) =>
          fetchWpType("https://www.iphoned.nl", t.rest, t.type, "iphoned", "iPhoned")
        )
      ),
      Promise.all(
        ICREATE_TYPES.map((t) =>
          fetchWpType("https://www.icreatemagazine.nl", t.rest, t.type, "icreate", "iCreate")
        )
      ),
      fetchIcultureRss(),
    ]);

    const articles = [...iphoned.flat(), ...icreate.flat(), ...iculture];
    const seen = new Set<string>();
    const unique = articles.filter((a) => {
      const key = a.url.replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(a.headline);
    });
    unique.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

    return NextResponse.json({
      articles: unique,
      meta: {
        after: AFTER,
        counts: {
          icreate: unique.filter((a) => a.titleId === "icreate").length,
          iphoned: unique.filter((a) => a.titleId === "iphoned").length,
          iculture: unique.filter((a) => a.titleId === "iculture").length,
        },
      },
    });
  } catch (err) {
    console.error("agenda-feed", err);
    return NextResponse.json({ articles: [], error: "feed_failed" }, { status: 500 });
  }
}
