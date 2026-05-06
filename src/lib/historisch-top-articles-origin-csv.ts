import type { OriginMonthBundle } from "@/lib/historisch-top-articles-origin-shared";

function escCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function originMonthBundleToCsv(bundle: OriginMonthBundle): string {
  const lines: string[] = [];
  lines.push(`# ${bundle.label} — herkomst top 25 (paywall_abonneren)`);
  lines.push("## Samenvatting kanaal (sessionDefaultChannelGroup)");
  lines.push(
    [
      "maand",
      "sessionDefaultChannelGroup",
      "paywall_view",
      "paywall_abonneren",
      "aandeel_paywall_view_binnen_top25",
      "aandeel_paywall_abonneren_binnen_top25",
      "paywall_abonneer_ratio",
    ].join(",")
  );
  for (const r of bundle.summary) {
    lines.push(
      [
        r.maand,
        r.sessionDefaultChannelGroup,
        r.paywall_view,
        r.paywall_abonneren,
        r.aandeel_paywall_view_binnen_top25,
        r.aandeel_paywall_abonneren_binnen_top25,
        r.paywall_abonneer_ratio,
      ].map(escCell).join(",")
    );
  }
  lines.push("");
  lines.push("## Analyse A — kanaal per artikel");
  lines.push(
    [
      "maand",
      "pagePath",
      "pageTitle",
      "sessionDefaultChannelGroup",
      "paywall_view",
      "paywall_abonneren",
      "paywall_abonneer_ratio",
    ].join(",")
  );
  for (const r of bundle.analysisA) {
    lines.push(
      [
        r.maand,
        r.pagePath,
        r.pageTitle,
        r.sessionDefaultChannelGroup,
        r.paywall_view,
        r.paywall_abonneren,
        r.paywall_abonneer_ratio,
      ].map(escCell).join(",")
    );
  }
  lines.push("");
  lines.push("## Analyse B — bron/medium per artikel (sessionSourceMedium)");
  lines.push(
    [
      "maand",
      "pagePath",
      "pageTitle",
      "sessionSourceMedium",
      "paywall_view",
      "paywall_abonneren",
      "paywall_abonneer_ratio",
    ].join(",")
  );
  for (const r of bundle.analysisB) {
    lines.push(
      [
        r.maand,
        r.pagePath,
        r.pageTitle,
        r.sessionSourceMedium,
        r.paywall_view,
        r.paywall_abonneren,
        r.paywall_abonneer_ratio,
      ].map(escCell).join(",")
    );
  }
  return lines.join("\n");
}
