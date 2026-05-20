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
};

export type IdeeenApiPayload = {
  sections: Record<
    IdeeenCategoryKey,
    {
      items: DiscoverSnoopArticle[];
      meta: { week: number | null; total: number | null };
    }
  >;
  fetchedAt: string;
};

const OWN_HOST_SUFFIXES = ["icreatemagazine.nl", "iphoned.nl", "iculture.nl"];

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

export function faviconForPublisher(publisherUrl: string): string {
  const domain = publisherUrl.replace(/^www\./, "").trim();
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

export async function fetchDiscoverSnoopCategory(
  category: IdeeenCategoryKey,
  limit: number
): Promise<DiscoverSnoopArticlesResponse> {
  const qs = new URLSearchParams({
    category,
    limit: String(limit),
  });
  const res = await fetch(`${DISCOVER_SNOOP_API_BASE}/api/articles?${qs}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`DiscoverSnoop ${category}: HTTP ${res.status}`);
  }
  return res.json() as Promise<DiscoverSnoopArticlesResponse>;
}
