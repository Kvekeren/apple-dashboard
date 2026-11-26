import {
  formatDiscoverArticleDate,
  IDEEEN_CATEGORY_SECTIONS,
  ownTitleLabelFromArticle,
  type DiscoverSnoopArticle,
  type IdeeenApiPayload,
  type IdeeenCategoryKey,
} from "@/lib/discover-snoop";
import { favIconUrl } from "@/lib/monitoring/shared";
import { titleLabelFromPageUrl, type SiteTitleLabel } from "@/lib/site-titles";

export const INSPIRATIE_LADE_KEY = "apple-dashboard-ideeen-lade";
/** Kaarten per kolom bij openen; daarna laadt de kolom automatisch bij in stappen van BOARD_STEP. */
export const BOARD_INITIAL = 20;
export const BOARD_STEP = 20;

export type BoardColumnId = "week-nl" | "week-ww" | "yoy";

export type BoardCard = {
  id: string;
  columnId: BoardColumnId;
  title: string;
  url: string;
  image?: string;
  publisher?: string;
  favicon?: string;
  ownLabel: SiteTitleLabel | null;
  categoryKey: IdeeenCategoryKey | null;
  rank: number;
  metricLabel?: string;
  /** DiscoverSnoop: firstviewed / lastviewed */
  dateLabel?: string;
  searchText: string;
};

export type LadeEntry = {
  pinKey: string;
  cardId: string;
  columnId: BoardColumnId;
  columnLabel: string;
  title: string;
  url: string;
  publisher?: string;
  favicon?: string;
  image?: string;
  ownLabel: SiteTitleLabel | null;
};

export const COLUMN_LABELS: Record<BoardColumnId, string> = {
  "week-nl": "Week · NL",
  "week-ww": "Week · Wereld",
  yoy: "YoY-week",
};

function cardIdForUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/** Sitenaam + favicon voor GSC-kaarten (eigen merk of hostname). */
export function publisherMetaFromUrl(
  url: string,
  ownLabel: SiteTitleLabel | null
): { publisher: string; favicon?: string } {
  if (ownLabel) {
    const fav = favIconUrl(ownLabel);
    return { publisher: ownLabel, favicon: fav || undefined };
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return {
      publisher: host,
      favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`,
    };
  } catch {
    return { publisher: "" };
  }
}

function formatClicks(clicks: number): string {
  return `${clicks.toLocaleString("nl-NL")} clicks`;
}

export function mergeSnoopArticles(
  sections: IdeeenApiPayload["sections"],
  scope: "nl" | "worldwide",
  columnId: BoardColumnId
): BoardCard[] {
  const merged: { article: DiscoverSnoopArticle; categoryKey: IdeeenCategoryKey }[] = [];
  for (const { key } of IDEEEN_CATEGORY_SECTIONS) {
    for (const item of sections[key]?.[scope]?.items ?? []) {
      merged.push({ article: item, categoryKey: key });
    }
  }
  merged.sort((a, b) => a.article.position - b.article.position);

  const cards = merged.map(({ article, categoryKey }, index) => {
    const ownLabel = ownTitleLabelFromArticle(article);
    const title = article.title.trim();
    return {
      id: `${columnId}-${cardIdForUrl(article.url)}`,
      columnId,
      title,
      url: article.url,
      image: article.image?.trim() || undefined,
      publisher: article.publisher,
      favicon: article.publisher_url
        ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(article.publisher_url.replace(/^www\./, ""))}&sz=32`
        : undefined,
      ownLabel,
      categoryKey,
      rank: index + 1,
      // De DiscoverSnoop-score zegt de redactie niets (los getal zonder eenheid); niet tonen.
      dateLabel: formatDiscoverArticleDate(
        article.firstviewed ?? article.lastviewed
      ),
      searchText: `${title} ${article.publisher} ${categoryKey}`.toLowerCase(),
    } satisfies BoardCard;
  });

  return cards;
}

export function gscRowsToYoyCards(
  discoverByUrl: Record<string, { clicks: number; impressions: number }>,
  resolveTitle: (url: string) => string
): BoardCard[] {
  const sorted = Object.entries(discoverByUrl)
    .filter(([, v]) => v.clicks > 0)
    .sort((a, b) => b[1].clicks - a[1].clicks);

  const cards = sorted.map(([url, v], index) => {
    const title = resolveTitle(url);
    const siteLabel = titleLabelFromPageUrl(url);
    const ownLabel =
      siteLabel !== "Overig" ? (siteLabel as SiteTitleLabel) : null;
    const { publisher, favicon } = publisherMetaFromUrl(url, ownLabel);
    return {
      id: `yoy-${cardIdForUrl(url)}`,
      columnId: "yoy" as const,
      title,
      url,
      publisher,
      favicon,
      ownLabel,
      categoryKey: null,
      rank: index + 1,
      metricLabel: formatClicks(v.clicks),
      searchText: `${title} ${publisher} ${url}`.toLowerCase(),
    } satisfies BoardCard;
  });

  return cards;
}

export function loadLade(): LadeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INSPIRATIE_LADE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LadeEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLade(entries: LadeEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INSPIRATIE_LADE_KEY, JSON.stringify(entries));
}

export function cardMatchesFilters(
  card: BoardCard,
  opts: {
    query: string;
    tabFilter?: string;
    columnId: BoardColumnId;
  }
): boolean {
  const q = opts.query.trim().toLowerCase();
  if (q && !card.searchText.includes(q)) return false;

  if (opts.columnId === "yoy" && opts.tabFilter && opts.tabFilter !== "all") {
    if (card.ownLabel !== opts.tabFilter) return false;
  }
  return true;
}
