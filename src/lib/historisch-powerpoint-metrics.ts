import type { HistorischCombinedMonthRow, HistorischCombinedMonthlyReport } from "@/lib/historisch-combined-shared";
import type { HistorischTopArticlesOriginReport } from "@/lib/historisch-top-articles-origin-shared";
import type { HistorischNieuwsbriefArtikelReport } from "@/lib/historisch-nieuwsbrief-artikel-shared";

const CHANNEL_DISPLAY_ORDER: { key: string; label: string }[] = [
  { key: "email", label: "E-mail" },
  { key: "organic search", label: "Organisch zoeken" },
  { key: "direct", label: "Direct" },
  { key: "organic social", label: "Organisch social" },
  { key: "referral", label: "Verwijzing" },
];

function channelAbonneren(
  summary: HistorischTopArticlesOriginReport["january2024"]["summary"],
  gaKey: string
): number {
  const k = gaKey.toLowerCase();
  const row = summary.find((s) => s.sessionDefaultChannelGroup.toLowerCase() === k);
  return row?.paywall_abonneren ?? 0;
}

export function ymYear(ym: string): number {
  return parseInt(ym.slice(0, 4), 10);
}

export function mean(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function paywallShareOfPageviews(row: HistorischCombinedMonthRow): number | null {
  if (row.screenPageViews <= 0) return null;
  return (row.paywall_view / row.screenPageViews) * 100;
}

export function filterYear(rows: HistorischCombinedMonthRow[], y: number): HistorischCombinedMonthRow[] {
  return rows.filter((r) => ymYear(r.yearMonth) === y);
}

export function formatNlMonthYear(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}

export function formatPct1(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("nl-NL", { maximumFractionDigits: 2 }) + "%";
}

export function formatNlNum(n: number | null | undefined, fd = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("nl-NL", { maximumFractionDigits: fd });
}

export function combinedPeriodLabel(report: HistorischCombinedMonthlyReport | null): string {
  if (!report?.dateRange?.startDate || !report?.dateRange?.endDate) return "—";
  return `${formatNlMonthYear(report.dateRange.startDate)} t/m ${formatNlMonthYear(report.dateRange.endDate)}`;
}

export function avgPaywallShareByYear(rows: HistorischCombinedMonthRow[], year: number): number | null {
  const subset = filterYear(rows, year).map(paywallShareOfPageviews).filter((x): x is number => x != null);
  return mean(subset);
}

export function avgMetricByYear(
  rows: HistorischCombinedMonthRow[],
  year: number,
  key: "paywall_view" | "screenPageViews" | "paywall_abonneer_ratio"
): number | null {
  const subset = filterYear(rows, year)
    .map((r) => (key === "paywall_abonneer_ratio" ? r.paywall_abonneer_ratio : r[key]))
    .filter((x): x is number => x != null && typeof x === "number");
  return mean(subset);
}

export function minMaxPaywallViewMonth(
  rows: HistorischCombinedMonthRow[]
): { min: { ym: string; v: number } | null; max: { ym: string; v: number } | null } {
  if (!rows.length) return { min: null, max: null };
  let min = { ym: rows[0].yearMonth, v: rows[0].paywall_view };
  let max = { ym: rows[0].yearMonth, v: rows[0].paywall_view };
  for (const r of rows) {
    if (r.paywall_view < min.v) min = { ym: r.yearMonth, v: r.paywall_view };
    if (r.paywall_view > max.v) max = { ym: r.yearMonth, v: r.paywall_view };
  }
  return { min, max };
}

export function avgNbPer1k(
  tableA: HistorischNieuwsbriefArtikelReport["tableA"],
  year: number
): number | null {
  const vals = tableA
    .filter((r) => ymYear(r.yearMonth) === year)
    .map((r) => r.nieuwsbrief_per_1000_pageviews)
    .filter((x): x is number => x != null);
  return mean(vals);
}

export function lowestNbPer1kMonth(
  tableA: HistorischNieuwsbriefArtikelReport["tableA"]
): { ym: string; v: number } | null {
  let best: { ym: string; v: number } | null = null;
  for (const r of tableA) {
    if (r.nieuwsbrief_per_1000_pageviews == null) continue;
    if (!best || r.nieuwsbrief_per_1000_pageviews < best.v) {
      best = { ym: r.yearMonth, v: r.nieuwsbrief_per_1000_pageviews };
    }
  }
  return best;
}

export function avgDeviceNbPer1k(
  tableB: HistorischNieuwsbriefArtikelReport["tableB"],
  device: "desktop" | "mobile" | "tablet"
): number | null {
  const vals = tableB
    .filter((r) => r.deviceCategory.toLowerCase() === device)
    .map((r) => r.nieuwsbrief_per_1000_pageviews)
    .filter((x): x is number => x != null);
  return mean(vals);
}

export type ChannelAandeel = {
  emailPct: number | null;
  organicPct: number | null;
  totalAbo: number;
};

export function channelAbonneerAandeel(
  summary: HistorischTopArticlesOriginReport["january2024"]["summary"]
): ChannelAandeel {
  const totalAbo = summary.reduce((s, r) => s + r.paywall_abonneren, 0);
  if (totalAbo <= 0) return { emailPct: null, organicPct: null, totalAbo: 0 };
  const email = channelAbonneren(summary, "email");
  const organic = channelAbonneren(summary, "organic search");
  return {
    emailPct: (email / totalAbo) * 100,
    organicPct: (organic / totalAbo) * 100,
    totalAbo,
  };
}

export function channelComparisonData(topOrigin: HistorischTopArticlesOriginReport | null): {
  jan: { kanaal: string; abo: number }[];
  jun: { kanaal: string; abo: number }[];
} {
  if (!topOrigin || topOrigin.fatalError) return { jan: [], jun: [] };
  const jan = CHANNEL_DISPLAY_ORDER.map(({ key, label }) => ({
    kanaal: label,
    abo: channelAbonneren(topOrigin.january2024.summary, key),
  }));
  const jun = CHANNEL_DISPLAY_ORDER.map(({ key, label }) => ({
    kanaal: label,
    abo: channelAbonneren(topOrigin.june2024.summary, key),
  }));
  return { jan, jun };
}
