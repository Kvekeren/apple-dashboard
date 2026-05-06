import type {
  HistorischTopArticleMonthBundle,
  HistorischTopArticlePivotRow,
} from "@/lib/historisch-top-articles-shared";

const HEADERS = [
  "pagePath",
  "pageTitle",
  "paywall_view",
  "paywall_abonneren",
  "paywall_inloggen",
  "nieuwsbrief_inschrijving_artikelen",
  "paywall_abonneer_ratio",
  "paywall_login_ratio",
  "nieuwsbrief_per_paywall_view",
] as const;

function cell(v: string | number | null | undefined): string {
  if (v == null) return "";
  return String(v);
}

function rowLine(r: HistorischTopArticlePivotRow): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const cells = [
    r.pagePath,
    r.pageTitle,
    cell(r.paywall_view),
    cell(r.paywall_abonneren),
    cell(r.paywall_inloggen),
    cell(r.nieuwsbrief_inschrijving_artikelen),
    cell(r.paywall_abonneer_ratio),
    cell(r.paywall_login_ratio),
    cell(r.nieuwsbrief_per_paywall_view),
  ].map(esc);
  return cells.join(",");
}

export function topArticleMonthBundleToCsv(
  bundle: HistorischTopArticleMonthBundle,
  sortLabel: "paywall_abonneren" | "paywall_view"
): string {
  const rows = sortLabel === "paywall_abonneren" ? bundle.topByAbonnement : bundle.topByView;
  const title = `# ${bundle.label} — top ${rows.length} op ${sortLabel}`;
  return [title, HEADERS.join(","), ...rows.map(rowLine)].join("\n");
}
