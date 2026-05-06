import type { HistorischCombinedMonthRow, HistorischCombinedMonthlyReport } from "@/lib/historisch-combined-shared";

function cell(v: number | null | undefined): string {
  if (v == null) return "";
  return String(v);
}

export function historischCombinedReportToCsv(report: HistorischCombinedMonthlyReport): string {
  const headers = [
    "yearMonth",
    "sessions",
    "totalUsers",
    "activeUsers",
    "newUsers",
    "screenPageViews",
    "new_user_share",
    "views_per_session",
    "views_per_user",
    "paywall_view",
    "paywall_abonneren",
    "paywall_inloggen",
    "nieuwsbrief_inschrijving_artikelen",
    "paywall_abonneer_ratio",
    "paywall_login_ratio",
    "nieuwsbrief_per_paywall_view",
    "paywall_views_per_session",
    "paywall_views_per_user",
    "paywall_views_per_new_user",
    "paywall_abonneren_per_session",
    "paywall_abonneren_per_new_user",
    "nieuwsbrief_per_session",
    "nieuwsbrief_per_new_user",
    "index_sessions",
    "index_totalUsers",
    "index_newUsers",
    "index_screenPageViews",
    "index_paywall_view",
    "index_paywall_abonneren",
    "index_nieuwsbrief_inschrijving_artikelen",
  ];

  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const line = (cells: string[]) => cells.map(esc).join(",");

  const rowLine = (r: HistorischCombinedMonthRow) =>
    line([
      r.yearMonth,
      cell(r.sessions),
      cell(r.totalUsers),
      cell(r.activeUsers),
      cell(r.newUsers),
      cell(r.screenPageViews),
      cell(r.new_user_share),
      cell(r.views_per_session),
      cell(r.views_per_user),
      cell(r.paywall_view),
      cell(r.paywall_abonneren),
      cell(r.paywall_inloggen),
      cell(r.nieuwsbrief_inschrijving_artikelen),
      cell(r.paywall_abonneer_ratio),
      cell(r.paywall_login_ratio),
      cell(r.nieuwsbrief_per_paywall_view),
      cell(r.paywall_views_per_session),
      cell(r.paywall_views_per_user),
      cell(r.paywall_views_per_new_user),
      cell(r.paywall_abonneren_per_session),
      cell(r.paywall_abonneren_per_new_user),
      cell(r.nieuwsbrief_per_session),
      cell(r.nieuwsbrief_per_new_user),
      cell(r.index_sessions),
      cell(r.index_totalUsers),
      cell(r.index_newUsers),
      cell(r.index_screenPageViews),
      cell(r.index_paywall_view),
      cell(r.index_paywall_abonneren),
      cell(r.index_nieuwsbrief_inschrijving_artikelen),
    ]);

  return [line(headers), ...report.rows.map(rowLine)].join("\n");
}
