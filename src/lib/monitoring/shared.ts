import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";

import {
  APPLE_TITLE_TABS,
  listTitleLabelsInOrder,
  titleLabelFromPageUrl,
  type SiteTitleId,
  type SiteTitleLabel,
} from "@/lib/site-titles";

export type PeriodPreset = "7d" | "28d" | "365d" | "custom";

export const SOURCE_LABELS = listTitleLabelsInOrder();

export const MONITORING_NAV: {
  href: string;
  label: string;
  requiresAuth?: boolean;
}[] = [
  { href: "/", label: "Home" },
  { href: "/recent", label: "Recent" },
  { href: "/ideeen", label: "Ideeën" },
  { href: "/jaarcijfers", label: "Jaarcijfers", requiresAuth: true },
  { href: "/discover", label: "Discover", requiresAuth: true },
  { href: "/vergelijking", label: "Vergelijking", requiresAuth: true },
];

export const TOP_ARTICLES_INITIAL = 5;
export const TOP_ARTICLES_STEP = 5;
export const TOP_ARTICLES_MAX = 30;

export type TopTenMetricFilter = "ga4" | "gsc-discover" | "gsc-web";

export type WeeklyTopArticleRow = {
  pageTitle: string;
  url: string;
  metricValue: number;
};

export type YtdWeeklySessionRow = { source: string; isoYearIsoWeek: string; sessions: number };

export const YTD_PRIOR_SESSIONS_DATAKEY = "priorYearSessions";

export const LINE_COLORS: Record<string, string> = {
  iCreate: "#004077",
  iPhoned: "#1a5f96",
  iCulture: "#5c7a94",
};

export const CIJFERS_RANGE_QS = "days=7";

export const GSC_AUTH_ERR: Record<string, string> = {
  access_denied: "Google-toegang is geannuleerd.",
  no_code: "Geen autorisatiecode ontvangen.",
  config: "OAuth niet geconfigureerd (GOOGLE_CLIENT_ID / SECRET).",
  token_failed: "Token mislukt.",
  unknown: "Verbinden mislukt.",
};

export const CIJFERS: { key: string; label: string }[] = [
  { key: "pageviews", label: "Pageviews (GA4)" },
  { key: "discoverClicks", label: "Discover-clicks (GSC)" },
  { key: "searchClicks", label: "Zoekresultaten web (GSC)" },
  { key: "searchConsoleTotal", label: "GSC totaal (Discover + Search)" },
];

export const YOY_DASHBOARD_KPIS = [
  { key: "pageviews", label: "Pageviews", source: "GA4" },
  { key: "discoverClicks", label: "Discover", source: "Google Search Console" },
  { key: "searchClicks", label: "Organisch", source: "Google Search (web)" },
] as const;

export type CijfersMetricValue = {
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
};

export type CijfersData = {
  periods: {
    current: { startDate: string; endDate: string };
    previous: { startDate: string; endDate: string };
  };
  sources: { source: string; metrics: Record<string, CijfersMetricValue> }[];
};

export interface GscPayload {
  discoverByUrl: Record<string, { clicks: number; impressions: number }>;
  searchWebByUrl: Record<string, { clicks: number; impressions: number }>;
  gscByTitle: Record<
    string,
    { web: { clicks: number; impressions: number }; discover: { clicks: number; impressions: number } }
  >;
  meta: { startDate: string; endDate: string };
}

export interface SiteCfg {
  id: SiteTitleId;
  label: string;
  hasGa4Property: boolean;
}

export function formatIsoYearIsoWeekAxis(iso: string): string {
  if (iso.length < 6) return iso;
  const w = parseInt(iso.slice(4), 10);
  return Number.isFinite(w) ? `w${w}` : iso;
}

export function primaryDomain(label: string): string | undefined {
  const row = APPLE_TITLE_TABS.find((t) => t.label === label);
  if (!row || row.id === "all") return undefined;
  const map: Record<SiteTitleId, string> = {
    icreate: "icreatemagazine.nl",
    iphoned: "iphoned.nl",
    iculture: "iculture.nl",
  };
  return map[row.id];
}

export function favIconUrl(source: string, fallback?: string): string {
  if (fallback) return fallback;
  const d = primaryDomain(source);
  if (!d) return "";
  return `https://www.google.com/s2/favicons?domain=${d}&sz=32`;
}

export function sourceFromArticleUrl(url: string): string {
  const lbl = titleLabelFromPageUrl(url);
  return lbl === "Overig" ? lbl : lbl;
}

export function realtimeUrlLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

export function slugFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const slug = path.split("/").filter(Boolean).pop() ?? path;
    return slug.replace(/-/g, " ").slice(0, 80);
  } catch {
    return url;
  }
}

export function normArticleUrl(u: string): string {
  return u.replace(/\/$/, "");
}

export function periodApiQuery(preset: PeriodPreset, cStart: string, cEnd: string): string {
  if (preset === "custom" && cStart && cEnd)
    return `startDate=${encodeURIComponent(cStart)}&endDate=${encodeURIComponent(cEnd)}`;
  if (preset === "365d") return "days=365";
  if (preset === "28d") return "days=28";
  return "days=7";
}

export function formatDashboardPeriod(start: string, end: string): string {
  const startFmt = format(parseISO(start), "d MMMM", { locale: nl });
  const endFmt = format(parseISO(end), "d MMMM yyyy", { locale: nl });
  return `${startFmt} – ${endFmt}`;
}

export function aggregateWeeklyTopArticlesBySource(
  rows: { source: string; pageTitle: string; url: string; screenPageViews: number }[],
  labels: readonly string[],
  limit: number
): Record<string, WeeklyTopArticleRow[]> {
  const out: Record<string, WeeklyTopArticleRow[]> = {};
  for (const label of labels) {
    const byTitle = new Map<string, { total: number; url: string; urlPeakViews: number }>();
    for (const r of rows) {
      if (r.source !== label) continue;
      const k = r.pageTitle.trim();
      const u = r.url.trim();
      if (!k || !u) continue;
      const prev = byTitle.get(k);
      if (!prev) {
        byTitle.set(k, {
          total: r.screenPageViews,
          url: u,
          urlPeakViews: r.screenPageViews,
        });
      } else {
        prev.total += r.screenPageViews;
        if (r.screenPageViews > prev.urlPeakViews) {
          prev.url = u;
          prev.urlPeakViews = r.screenPageViews;
        }
      }
    }
    out[label] = [...byTitle.entries()]
      .map(([pageTitle, acc]) => ({
        pageTitle,
        url: acc.url,
        metricValue: acc.total,
      }))
      .sort((a, b) => b.metricValue - a.metricValue)
      .slice(0, limit);
  }
  return out;
}

export function aggregateGscTopUrlsBySource(
  urlMap: Record<string, { clicks: number }>,
  labels: readonly string[],
  limit: number,
  resolveTitle: (url: string) => string
): Record<string, WeeklyTopArticleRow[]> {
  const out: Record<string, WeeklyTopArticleRow[]> = {};
  for (const label of labels) {
    out[label] = Object.entries(urlMap)
      .filter(([url]) => titleLabelFromPageUrl(url) === label)
      .filter(([, v]) => v.clicks > 0)
      .sort((a, b) => b[1].clicks - a[1].clicks)
      .slice(0, limit)
      .map(([url, v]) => ({
        pageTitle: resolveTitle(url),
        url,
        metricValue: v.clicks,
      }));
  }
  return out;
}

export function redirectToGoogleLogin() {
  window.location.href = "/api/auth/google";
}
