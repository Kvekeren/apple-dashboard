import type { HistorischCombinedMonthRow } from "@/lib/historisch-combined-shared";
import type { HistorischTopArticlePivotRow } from "@/lib/historisch-top-articles-shared";
import { paywallShareOfPageviews } from "@/lib/historisch-powerpoint-metrics";

function cell(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function powerpointSlide4PageviewsPaywallCsv(rows: HistorischCombinedMonthRow[]): string {
  const header = [
    "yearMonth",
    "screenPageViews",
    "paywall_view",
    "paywall_view_pct_van_screenPageViews",
  ];
  const lines = rows.map((r) => {
    const p = paywallShareOfPageviews(r);
    return [
      cell(r.yearMonth),
      cell(r.screenPageViews),
      cell(r.paywall_view),
      cell(p == null ? "" : p.toFixed(6)),
    ].join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

export function powerpointTopArticlesCsv(rows: HistorischTopArticlePivotRow[]): string {
  const header = [
    "pagePath",
    "paywall_abonneren",
    "paywall_view",
    "paywall_abonneer_ratio",
  ];
  const lines = rows.map((r) =>
    [
      cell(r.pagePath ?? ""),
      cell(r.paywall_abonneren),
      cell(r.paywall_view),
      cell(r.paywall_abonneer_ratio == null ? "" : r.paywall_abonneer_ratio),
    ].join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

export function powerpointChannelsJanJunCsv(
  jan: { kanaal: string; abo: number }[],
  jun: { kanaal: string; abo: number }[]
): string {
  const header = ["kanaal", "paywall_abonneren_januari_2024", "paywall_abonneren_juni_2024"];
  const n = Math.max(jan.length, jun.length);
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = jan[i];
    const b = jun[i];
    lines.push(
      [
        cell(a?.kanaal ?? b?.kanaal ?? ""),
        cell(a?.abo ?? ""),
        cell(b?.abo ?? ""),
      ].join(",")
    );
  }
  return [header.join(","), ...lines].join("\n");
}

export function powerpointMeetingRowsCsv(
  label: string,
  rows: Record<string, string | number | null | undefined>[]
): string {
  if (!rows.length) return "key\n";
  const keys = Object.keys(rows[0]);
  const header = ["_reeks", ...keys].map(cell);
  const lines = rows.map((r) => [cell(label), ...keys.map((k) => cell(r[k] ?? ""))].join(","));
  return [header.join(","), ...lines].join("\n");
}

export function powerpointNbDeviceMonthCsv(
  rows: {
    yearMonth: string;
    desktop: number | null;
    mobile: number | null;
    tablet: number | null;
  }[]
): string {
  const header = [
    "yearMonth",
    "nieuwsbrief_per_1000_pageviews_desktop",
    "nieuwsbrief_per_1000_pageviews_mobile",
    "nieuwsbrief_per_1000_pageviews_tablet",
  ];
  const lines = rows.map((r) =>
    [cell(r.yearMonth), cell(r.desktop ?? ""), cell(r.mobile ?? ""), cell(r.tablet ?? "")].join(",")
  );
  return [header.join(","), ...lines].join("\n");
}
