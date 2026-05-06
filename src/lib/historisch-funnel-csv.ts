import type { HistorischFunnelMonthlyReport } from "@/lib/historisch-funnel-shared";

export function historischFunnelReportToCsv(report: HistorischFunnelMonthlyReport): string {
  const headers = [
    "yearMonth",
    "paywall_view",
    "paywall_abonneren",
    "paywall_inloggen",
    "nieuwsbrief_inschrijving_artikelen",
    "paywall_abonneer_ratio",
    "paywall_login_ratio",
    "nieuwsbrief_per_paywall_view",
  ];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const line = (cells: string[]) => cells.map(esc).join(",");

  const body = report.rows.map((r) =>
    line([
      r.yearMonth,
      String(r.paywall_view),
      String(r.paywall_abonneren),
      String(r.paywall_inloggen),
      String(r.nieuwsbrief_inschrijving_artikelen),
      r.paywall_abonneer_ratio == null ? "" : String(r.paywall_abonneer_ratio),
      r.paywall_login_ratio == null ? "" : String(r.paywall_login_ratio),
      r.nieuwsbrief_per_paywall_view == null ? "" : String(r.nieuwsbrief_per_paywall_view),
    ])
  );

  return [line(headers), ...body].join("\n");
}
