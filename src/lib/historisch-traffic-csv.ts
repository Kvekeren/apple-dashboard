import type { HistorischTrafficMonthlyReport } from "@/lib/historisch-traffic-shared";

export function historischTrafficReportToCsv(report: HistorischTrafficMonthlyReport): string {
  const hasViews = report.technical.metricsUsed.includes("views");
  const headers = [
    "yearMonth",
    "sessions",
    "totalUsers",
    ...(report.technical.metricsUsed.includes("activeUsers") ? ["activeUsers"] : []),
    "newUsers",
    "screenPageViews",
    ...(hasViews ? ["views"] : []),
    "new_user_share",
    "views_per_session",
    "views_per_user",
  ];

  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const line = (cells: string[]) => cells.map(esc).join(",");

  const body = report.rows.map((r) => {
    const cells: string[] = [
      r.yearMonth,
      String(r.sessions),
      String(r.totalUsers),
    ];
    if (report.technical.metricsUsed.includes("activeUsers")) cells.push(String(r.activeUsers));
    cells.push(String(r.newUsers), String(r.screenPageViews));
    if (hasViews) cells.push(String(r.views ?? ""));
    cells.push(
      r.new_user_share == null ? "" : String(r.new_user_share),
      r.views_per_session == null ? "" : String(r.views_per_session),
      r.views_per_user == null ? "" : String(r.views_per_user)
    );
    return line(cells);
  });

  return [line(headers), ...body].join("\n");
}
