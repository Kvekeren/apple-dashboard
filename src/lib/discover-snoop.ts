import { hostnameToTitleLabel, type SiteTitleLabel } from "@/lib/site-titles";

export const DISCOVER_SNOOP_API_BASE =
  process.env.DISCOVER_SNOOP_API_URL?.replace(/\/$/, "") ??
  "https://discoverknallers.vercel.app";

export const IDEEEN_INITIAL = 10;
export const IDEEEN_STEP = 10;
export const IDEEEN_MAX = 20;

export const IDEEEN_CATEGORY_SECTIONS = [
  { key: "tel", label: "Internet & Telecom" },
  { key: "electronics", label: "Computers & Electronics" },
] as const;

export type IdeeenCategoryKey = (typeof IDEEEN_CATEGORY_SECTIONS)[number]["key"];

export type DiscoverSnoopArticle = {
  url: string;
  title: string;
  image?: string;
  publisher: string;
  publisher_url: string;
  snippet?: string;
  score: number;
  position: number;
  category: string;
  firstviewed?: string;
  lastviewed?: string;
  is_new?: boolean;
};

export type DiscoverSnoopArticlesResponse = {
  items: DiscoverSnoopArticle[];
  category: string;
  week?: number;
  total?: number;
  view?: string;
  worldwide?: boolean;
};

export type DiscoverSnoopWeeksResponse = {
  weeks: number[];
  defaultWeek: number | null;
};

export type IdeeenFeedSlice = {
  items: DiscoverSnoopArticle[];
  meta: { total: number | null };
};

export type IdeeenCategoryPayload = {
  nl: IdeeenFeedSlice;
  worldwide: IdeeenFeedSlice;
};

export type IdeeenApiPayload = {
  week: number | null;
  sections: Record<IdeeenCategoryKey, IdeeenCategoryPayload>;
  fetchedAt: string;
};

export type IdeeenVisibleKey = `${IdeeenCategoryKey}-nl` | `${IdeeenCategoryKey}-worldwide`;

const OWN_HOST_SUFFIXES = [
  "icreatemagazine.nl",
  "iphoned.nl",
  "iculture.nl",
  "androidplanet.nl",
  "androidworld.nl",
];

export function ownTitleLabelFromArticle(
  article: Pick<DiscoverSnoopArticle, "url" | "publisher_url">
): SiteTitleLabel | null {
  try {
    const host = new URL(article.url).hostname;
    const lbl = hostnameToTitleLabel(host);
    if (lbl !== "Overig") return lbl;
  } catch {
    /* ignore */
  }
  const pub = article.publisher_url.toLowerCase().replace(/^www\./, "");
  if (OWN_HOST_SUFFIXES.some((h) => pub === h || pub.endsWith(`.${h}`))) {
    const lbl = hostnameToTitleLabel(pub);
    return lbl === "Overig" ? null : lbl;
  }
  return null;
}

/** Datum uit DiscoverSnoop (bv. `2026-05-14 14:00:58`) → `14 mei 2026`. */
export function formatDiscoverArticleDate(value: string | undefined): string {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  const months = [
    "jan",
    "feb",
    "mrt",
    "apr",
    "mei",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "dec",
  ];
  const day = Number(match[3]);
  const month = months[Number(match[2]) - 1];
  if (!month || !Number.isFinite(day)) return raw;
  return `${day} ${month} ${match[1]}`;
}

export function faviconForPublisher(publisherUrl: string): string {
  const domain = publisherUrl.replace(/^www\./, "").trim();
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

export async function fetchDiscoverSnoopWeeks(): Promise<DiscoverSnoopWeeksResponse> {
  const res = await fetch(`${DISCOVER_SNOOP_API_BASE}/api/weeks`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`DiscoverSnoop weeks: HTTP ${res.status}`);
  }
  return res.json() as Promise<DiscoverSnoopWeeksResponse>;
}

export async function resolveLatestDiscoverWeek(): Promise<number | null> {
  const { weeks, defaultWeek } = await fetchDiscoverSnoopWeeks();
  if (defaultWeek != null) return defaultWeek;
  return weeks[0] ?? null;
}

export async function fetchDiscoverSnoopCategory(
  category: IdeeenCategoryKey,
  limit: number,
  options: { week: number; worldwide?: boolean }
): Promise<DiscoverSnoopArticlesResponse> {
  const qs = new URLSearchParams({
    category,
    limit: String(limit),
    week: String(options.week),
  });
  if (options.worldwide) qs.set("worldwide", "1");
  const res = await fetch(`${DISCOVER_SNOOP_API_BASE}/api/articles?${qs}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    const scope = options.worldwide ? `${category}-worldwide` : category;
    throw new Error(`DiscoverSnoop ${scope}: HTTP ${res.status}`);
  }
  return res.json() as Promise<DiscoverSnoopArticlesResponse>;
}
