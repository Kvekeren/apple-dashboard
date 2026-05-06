"use client";

import { useMemo, useRef, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistorischCombinedMonthlyReport } from "@/lib/historisch-combined-shared";
import type { HistorischNieuwsbriefArtikelReport } from "@/lib/historisch-nieuwsbrief-artikel-shared";
import type { HistorischTopArticlesOriginReport } from "@/lib/historisch-top-articles-origin-shared";
import type { HistorischTopArticlesReport } from "@/lib/historisch-top-articles-shared";
import {
  avgDeviceNbPer1k,
  avgMetricByYear,
  avgNbPer1k,
  avgPaywallShareByYear,
  channelAbonneerAandeel,
  channelComparisonData,
  combinedPeriodLabel,
  formatNlMonthYear,
  formatNlNum,
  formatPct1,
  lowestNbPer1kMonth,
  minMaxPaywallViewMonth,
  paywallShareOfPageviews,
} from "@/lib/historisch-powerpoint-metrics";
import {
  powerpointChannelsJanJunCsv,
  powerpointMeetingRowsCsv,
  powerpointNbDeviceMonthCsv,
  powerpointSlide4PageviewsPaywallCsv,
  powerpointTopArticlesCsv,
} from "@/lib/historisch-powerpoint-csv";
import {
  exportChartPng,
  NlInt,
  NRatio,
  NSmall,
  useMeetingChartData,
} from "@/components/historisch/historisch-meeting-charts-blocks";

function ymToNlLabel(ym: string): string {
  return formatNlMonthYear(`${ym}-01`);
}

function shortPath(p: string, max = 44): string {
  if (!p) return "—";
  if (p.length <= max) return p;
  return `…${p.slice(-(max - 1))}`;
}

function downloadUtf8Csv(csv: string, filename: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Kerntallen({ items }: { items: { label: string; value: string }[] }) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] leading-tight text-slate-700 sm:grid-cols-3">
      {items.map((x) => (
        <li key={x.label}>
          <span className="text-slate-500">{x.label}: </span>
          <span className="font-mono tabular-nums text-slate-900">{x.value}</span>
        </li>
      ))}
    </ul>
  );
}

function Duiding({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 border-l-2 border-slate-300 pl-2 text-[10px] leading-snug text-slate-600">{children}</p>
  );
}

const CHART_H = 232;

export function HistorischPowerpointAssets({
  combined,
  nbArtikel,
  topOrigin,
  topArticles,
}: {
  combined: HistorischCombinedMonthlyReport | null;
  nbArtikel: HistorischNieuwsbriefArtikelReport | null;
  topOrigin: HistorischTopArticlesOriginReport | null;
  topArticles: HistorischTopArticlesReport | null;
}) {
  const slideRefs = useRef(new Map<string, HTMLDivElement | null>());
  const bindSlide = (id: string) => (el: HTMLDivElement | null) => {
    if (el) slideRefs.current.set(id, el);
    else slideRefs.current.delete(id);
  };
  const png = (id: string, filename: string) =>
    exportChartPng(slideRefs.current.get(id) ?? null, filename);

  const rows = combined?.rows ?? [];
  const hasCombined = rows.length > 0;
  const periodLabel = combinedPeriodLabel(combined);

  const meeting = useMeetingChartData(combined, nbArtikel, topOrigin);

  const slide4Rows = useMemo(
    () =>
      rows.map((r) => ({
        yearMonth: r.yearMonth,
        screenPageViews: r.screenPageViews,
        paywall_view: r.paywall_view,
        paywall_pct: paywallShareOfPageviews(r),
      })),
    [rows]
  );

  const chPack = useMemo(() => channelComparisonData(topOrigin), [topOrigin]);
  const chMerged = useMemo(
    () =>
      chPack.jan.map((row, i) => ({
        kanaal: row.kanaal,
        januari: row.abo,
        juni: chPack.jun[i]?.abo ?? 0,
      })),
    [chPack]
  );

  const janAand = topOrigin && !topOrigin.fatalError ? channelAbonneerAandeel(topOrigin.january2024.summary) : null;
  const junAand = topOrigin && !topOrigin.fatalError ? channelAbonneerAandeel(topOrigin.june2024.summary) : null;

  const topJan = topArticles && !topArticles.fatalError ? topArticles.january2024.topByAbonnement.slice(0, 10) : [];
  const topJun = topArticles && !topArticles.fatalError ? topArticles.june2024.topByAbonnement.slice(0, 10) : [];

  const topJanChart = useMemo(
    () => topJan.map((r) => ({ ...r, pagePathShort: shortPath(r.pagePath, 40) })),
    [topJan]
  );
  const topJunChart = useMemo(
    () => topJun.map((r) => ({ ...r, pagePathShort: shortPath(r.pagePath, 40) })),
    [topJun]
  );

  const mm = minMaxPaywallViewMonth(rows);
  const avgPw2024 = avgMetricByYear(rows, 2024, "paywall_view");
  const avgPw2025 = avgMetricByYear(rows, 2025, "paywall_view");
  const avgPw2026 = avgMetricByYear(rows, 2026, "paywall_view");

  const share24 = avgPaywallShareByYear(rows, 2024);
  const share25 = avgPaywallShareByYear(rows, 2025);
  const share26 = avgPaywallShareByYear(rows, 2026);

  const ratio24 = avgMetricByYear(rows, 2024, "paywall_abonneer_ratio");
  const ratio25 = avgMetricByYear(rows, 2025, "paywall_abonneer_ratio");
  const ratio26 = avgMetricByYear(rows, 2026, "paywall_abonneer_ratio");

  const nbTableA = nbArtikel && !nbArtikel.fatalError && !nbArtikel.error ? nbArtikel.tableA : [];
  const avgNb24 = avgNbPer1k(nbTableA, 2024);
  const avgNb25 = avgNbPer1k(nbTableA, 2025);
  const avgNb26 = avgNbPer1k(nbTableA, 2026);
  const nbLow = lowestNbPer1kMonth(nbTableA);

  const deskAvg = avgDeviceNbPer1k(nbArtikel?.tableB ?? [], "desktop");
  const mobAvg = avgDeviceNbPer1k(nbArtikel?.tableB ?? [], "mobile");
  const dmRatio =
    deskAvg != null && mobAvg != null && mobAvg > 0 ? deskAvg / mobAvg : null;

  const defX = { angle: -32 as const, textAnchor: "end" as const, height: 44 };

  return (
    <section id="powerpoint-assets" className="scroll-mt-36 space-y-10">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">PowerPoint-assets</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Slideblokken in 16:9 voor export naar PNG. Waar mogelijk: onderliggende CSV. Cijfers zijn dynamisch uit
          de geladen historische dataset (geen extra GA4-calls). Voor artikelen is <span className="font-mono">pagePath</span>{" "}
          leidend.
        </p>
      </div>

      {/* Slide 1 */}
      <SlideChrome
        label="Slide 1 — Titel & aanleiding"
        csv={undefined}
        onCsv={undefined}
        onPng={() => void png("s01", "historisch-ppt-slide-01-titel.png")}
      >
        <div
          ref={bindSlide("s01")}
          className="flex aspect-video w-full max-w-[960px] flex-col justify-center rounded-xl border-2 border-slate-900 bg-gradient-to-br from-slate-50 to-white px-10 py-8 shadow-lg"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Historisch Nieuwsblad</p>
          <h4 className="mt-2 text-2xl font-bold leading-tight text-slate-900 md:text-[1.65rem]">
            Analyse online/digitale instroom Historisch Nieuwsblad
          </h4>
          <p className="mt-4 text-sm text-slate-700">
            <span className="font-medium text-slate-800">Periode (dataset):</span>{" "}
            {periodLabel === "—" ? "januari 2024 t/m laatste maand in export" : periodLabel}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-medium text-slate-800">Databron:</span> GA4 Data API
          </p>
          <p className="mt-5 max-w-[40rem] text-[11px] leading-relaxed text-slate-600">
            <span className="font-medium text-slate-800">Aanleiding:</span> online/digitale abonnementen blijven achter;
            we onderzoeken paywall, piekmaanden, nieuw verkeer en nieuwsbriefblokken.
          </p>
        </div>
      </SlideChrome>

      {/* Slide 2 */}
      <SlideChrome
        label="Slide 2 — Onderzoeksvragen"
        onPng={() => void png("s02", "historisch-ppt-slide-02-onderzoeksvragen.png")}
      >
        <div
          ref={bindSlide("s02")}
          className="aspect-video w-full max-w-[960px] space-y-3 rounded-xl border-2 border-slate-900 bg-white px-8 py-7 shadow-lg"
        >
          <h4 className="text-lg font-bold text-slate-900">Onderzoeksvragen</h4>
          <ul className="list-disc space-y-2 pl-4 text-[11px] leading-snug text-slate-800">
            <li>Hoe ontwikkelen paywall views en abonneerkliks zich?</li>
            <li>Daalt het aantal paywall-views even sterk als het totale aantal pageviews?</li>
            <li>Is er een verband met nieuw verkeer?</li>
            <li>Welke artikelen verklaarden pieken in januari en juni 2024?</li>
            <li>Via welke kanalen kwamen die piekartikelen?</li>
            <li>Hoe ontwikkelen nieuwsbriefinschrijvingen vanuit artikelblokken zich?</li>
          </ul>
        </div>
      </SlideChrome>

      {/* Slide 3 */}
      <SlideChrome label="Slide 3 — Kernbevindingen" onPng={() => void png("s03", "historisch-ppt-slide-03-kern.png")}>
        <div
          ref={bindSlide("s03")}
          className="aspect-video w-full max-w-[960px] space-y-3 rounded-xl border-2 border-slate-900 bg-white px-8 py-6 shadow-lg"
        >
          <h4 className="text-lg font-bold text-slate-900">Kernbevindingen (voorzichtig geformuleerd)</h4>
          <ul className="list-disc space-y-2 pl-4 text-[11px] leading-snug text-slate-800">
            <li>Paywall views liggen vanaf 2025 meestal lager dan in 2024.</li>
            <li>
              Totale pageviews lijken niet even sterk mee te dalen; het aandeel pageviews dat leidt tot een
              paywall-view lijkt lager geworden.
            </li>
            <li>Abonneerkliks dalen minder sterk dan paywall views; de paywallratio lijkt in 2025 vaak hoger.</li>
            <li>
              Piekartikelen in januari en juni 2024 werden naar alle waarschijnlijkheid sterk gedragen door
              E-mail/nieuwsbrief; Organisch zoeken speelt vooral in juni mee.
            </li>
            <li>
              Nieuwsbrief-events vanuit artikelblokken lijken per 1.000 pageviews duidelijk te dalen, vooral vanaf
              2025.
            </li>
          </ul>
        </div>
      </SlideChrome>

      {/* Slide 4 */}
      <SlideChrome
        label="Slide 4 — Pageviews versus paywall-views"
        csv={hasCombined ? powerpointSlide4PageviewsPaywallCsv(rows) : undefined}
        csvFilename="historisch-ppt-slide-04-pageviews-paywall.csv"
        onCsv={(c, f) => downloadUtf8Csv(c, f)}
        onPng={() => void png("s04", "historisch-ppt-slide-04-pageviews-paywall.png")}
      >
        <div
          ref={bindSlide("s04")}
          className="flex aspect-video w-full max-w-[960px] flex-col rounded-xl border-2 border-slate-900 bg-white px-5 pb-4 pt-4 shadow-lg"
        >
          <h4 className="text-base font-bold text-slate-900">Pageviews versus paywall-views</h4>
          {hasCombined ? (
            <>
              <div className="mt-1" style={{ height: CHART_H }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={slide4Rows} margin={{ top: 4, right: 10, left: 0, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="yearMonth" tick={{ fontSize: 8 }} {...defX} />
                    <YAxis
                      yAxisId="spv"
                      tick={{ fontSize: 8 }}
                      width={40}
                      tickFormatter={(v) => NlInt(Number(v))}
                    />
                    <YAxis
                      yAxisId="pw"
                      orientation="right"
                      tick={{ fontSize: 8 }}
                      width={38}
                      tickFormatter={(v) => NlInt(Number(v))}
                    />
                    <Tooltip
                      formatter={(value) => [NlInt(typeof value === "number" ? value : Number(value)), ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Bar
                      yAxisId="spv"
                      dataKey="screenPageViews"
                      name="Screen pageviews"
                      fill="#cbd5e1"
                      maxBarSize={14}
                    />
                    <Line
                      yAxisId="pw"
                      type="monotone"
                      dataKey="paywall_view"
                      name="Paywallweergaven"
                      stroke="#2563eb"
                      dot={false}
                      strokeWidth={2}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <Kerntallen
                items={[
                  { label: "Gem. aandeel paywall/view 2024", value: formatPct1(share24) },
                  { label: "Gem. aandeel 2025", value: formatPct1(share25) },
                  { label: "Gem. aandeel 2026 (maanden in data)", value: formatPct1(share26) },
                ]}
              />
              <Duiding>
                Het probleem lijkt niet het totale siteverkeer, maar het aandeel verkeer dat de paywall bereikt.
              </Duiding>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-600">Geen gecombineerde maanddata geladen.</p>
          )}
        </div>
      </SlideChrome>

      {/* Slide 5 */}
      <SlideChrome
        label="Slide 5 — Maandontwikkeling paywall"
        csv={hasCombined ? powerpointMeetingRowsCsv("paywall_maand", meeting.data1 as unknown as Record<string, string | number | null | undefined>[]) : undefined}
        csvFilename="historisch-ppt-slide-05-paywall-maand.csv"
        onCsv={(c, f) => downloadUtf8Csv(c, f)}
        onPng={() => void png("s05", "historisch-ppt-slide-05-paywall-maand.png")}
      >
        <div
          ref={bindSlide("s05")}
          className="flex aspect-video w-full max-w-[960px] flex-col rounded-xl border-2 border-slate-900 bg-white px-5 pb-4 pt-4 shadow-lg"
        >
          <h4 className="text-base font-bold text-slate-900">Paywallweergaven en abonneerkliks per maand</h4>
          {hasCombined ? (
            <>
              <div className="mt-1" style={{ height: CHART_H }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={meeting.data1} margin={{ top: 4, right: 10, left: 0, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="yearMonth" tick={{ fontSize: 8 }} {...defX} />
                    <YAxis yAxisId="left" tick={{ fontSize: 8 }} width={40} tickFormatter={(v) => NlInt(Number(v))} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 8 }}
                      width={38}
                      tickFormatter={(v) => NlInt(Number(v))}
                    />
                    <Tooltip
                      formatter={(value) => [NlInt(typeof value === "number" ? value : Number(value)), ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="paywall_view"
                      name="Paywallweergaven"
                      stroke="#2563eb"
                      dot={false}
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="paywall_abonneren"
                      name="Abonneerkliks"
                      stroke="#c026d3"
                      dot={false}
                      strokeWidth={2}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <Kerntallen
                items={[
                  {
                    label: "Hoogste maand paywall_view",
                    value: mm.max ? `${ymToNlLabel(mm.max.ym)} (${NlInt(mm.max.v)})` : "—",
                  },
                  {
                    label: "Laagste maand paywall_view",
                    value: mm.min ? `${ymToNlLabel(mm.min.ym)} (${NlInt(mm.min.v)})` : "—",
                  },
                  { label: "Gem. paywall_view 2024", value: formatNlNum(avgPw2024, 0) },
                  { label: "Gem. paywall_view 2025", value: formatNlNum(avgPw2025, 0) },
                  { label: "Gem. paywall_view 2026", value: formatNlNum(avgPw2026, 0) },
                ]}
              />
              <Duiding>
                Paywallweergaven liggen vanaf 2025 lager, terwijl abonneerkliks minder sterk lijken mee te bewegen.
              </Duiding>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-600">Geen gecombineerde maanddata geladen.</p>
          )}
        </div>
      </SlideChrome>

      {/* Slide 6 */}
      <SlideChrome
        label="Slide 6 — Paywallratio"
        csv={hasCombined ? powerpointMeetingRowsCsv("paywall_ratio", meeting.data2 as unknown as Record<string, string | number | null | undefined>[]) : undefined}
        csvFilename="historisch-ppt-slide-06-paywallratio.csv"
        onCsv={(c, f) => downloadUtf8Csv(c, f)}
        onPng={() => void png("s06", "historisch-ppt-slide-06-paywallratio.png")}
      >
        <div
          ref={bindSlide("s06")}
          className="flex aspect-video w-full max-w-[960px] flex-col rounded-xl border-2 border-slate-900 bg-white px-5 pb-4 pt-4 shadow-lg"
        >
          <h4 className="text-base font-bold text-slate-900">Paywall abonneerratio per maand</h4>
          {hasCombined ? (
            <>
              <div className="mt-1" style={{ height: CHART_H }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={meeting.data2} margin={{ top: 4, right: 10, left: 0, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="yearMonth" tick={{ fontSize: 8 }} {...defX} />
                    <YAxis tick={{ fontSize: 8 }} width={36} />
                    <Tooltip formatter={(value) => [NRatio(typeof value === "number" ? value : Number(value)), ""]} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Line
                      type="monotone"
                      dataKey="paywall_abonneer_ratio"
                      name="Abonneerratio"
                      stroke="#0d9488"
                      dot={false}
                      strokeWidth={2}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Kerntallen
                items={[
                  { label: "Gem. ratio 2024", value: NRatio(ratio24) },
                  { label: "Gem. ratio 2025", value: NRatio(ratio25) },
                  { label: "Gem. ratio 2026", value: NRatio(ratio26) },
                ]}
              />
              <Duiding>
                De klikratio vanuit de paywall lijkt niet het hoofdprobleem; die ligt naar alle waarschijnlijkheid
                hoger dan in 2024.
              </Duiding>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-600">Geen gecombineerde maanddata geladen.</p>
          )}
        </div>
      </SlideChrome>

      {/* Slide 7 */}
      <SlideChrome
        label="Slide 7 — Nieuw verkeer versus paywall-exposure"
        csv={hasCombined ? powerpointMeetingRowsCsv("index", meeting.data3 as unknown as Record<string, string | number | null | undefined>[]) : undefined}
        csvFilename="historisch-ppt-slide-07-index.csv"
        onCsv={(c, f) => downloadUtf8Csv(c, f)}
        onPng={() => void png("s07", "historisch-ppt-slide-07-index.png")}
      >
        <div
          ref={bindSlide("s07")}
          className="flex aspect-video w-full max-w-[960px] flex-col rounded-xl border-2 border-slate-900 bg-white px-5 pb-4 pt-4 shadow-lg"
        >
          <h4 className="text-base font-bold text-slate-900">Index: nieuwe gebruikers vs. paywallweergaven</h4>
          {hasCombined ? (
            <>
              <div className="mt-1" style={{ height: CHART_H }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={meeting.data3} margin={{ top: 4, right: 10, left: 0, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="yearMonth" tick={{ fontSize: 8 }} {...defX} />
                    <YAxis tick={{ fontSize: 8 }} width={36} />
                    <Tooltip formatter={(value) => [NRatio(typeof value === "number" ? value : Number(value)), ""]} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Line
                      type="monotone"
                      dataKey="index_newUsers"
                      name="Index nieuwe gebruikers"
                      stroke="#ea580c"
                      dot={false}
                      strokeWidth={2}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="index_paywall_view"
                      name="Index paywallweergaven"
                      stroke="#4338ca"
                      dot={false}
                      strokeWidth={2}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-slate-700">
                Nieuwe gebruikers en paywallweergaven bewegen niet één-op-één mee. Het gaat dus niet alleen om méér
                nieuw verkeer, maar om nieuw verkeer naar betaalde artikelen.
              </p>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-600">Geen gecombineerde maanddata geladen.</p>
          )}
        </div>
      </SlideChrome>

      {/* Slide 8 */}
      <SlideChrome
        label="Slide 8 — Januari 2024 topartikelen"
        csv={topJan.length ? powerpointTopArticlesCsv(topJan) : undefined}
        csvFilename="historisch-ppt-slide-08-top-jan-2024.csv"
        onCsv={(c, f) => downloadUtf8Csv(c, f)}
        onPng={() => void png("s08", "historisch-ppt-slide-08-top-jan.png")}
      >
        <div
          ref={bindSlide("s08")}
          className="flex aspect-video w-full max-w-[960px] flex-col rounded-xl border-2 border-slate-900 bg-white px-4 pb-3 pt-4 shadow-lg"
        >
          <h4 className="text-base font-bold text-slate-900">Top 10 artikelen — januari 2024 (abonneerkliks)</h4>
          {topJanChart.length ? (
            <>
              <div className="mt-1 w-full" style={{ height: CHART_H }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={[...topJanChart].reverse()}
                    margin={{ top: 2, right: 8, left: 2, bottom: 2 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 8 }} tickFormatter={(v) => NlInt(Number(v))} />
                    <YAxis type="category" dataKey="pagePathShort" tick={{ fontSize: 7 }} width={200} />
                    <Tooltip
                      formatter={(value) => [NlInt(typeof value === "number" ? value : Number(value)), ""]}
                      labelFormatter={(_, p) => {
                        const pl = p?.[0]?.payload as { pagePath?: string };
                        return pl?.pagePath ?? "";
                      }}
                    />
                    <Bar dataKey="paywall_abonneren" name="Abonneerkliks" fill="#6d28d9" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Duiding>
                De januaripiek lijkt gedragen door meerdere sterke artikelen; het grootste artikel hoeft niet de enige
                verklaring te zijn.
              </Duiding>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-600">Geen topartikeldata voor januari 2024.</p>
          )}
        </div>
      </SlideChrome>

      {/* Slide 9 */}
      <SlideChrome
        label="Slide 9 — Juni 2024 topartikelen"
        csv={topJun.length ? powerpointTopArticlesCsv(topJun) : undefined}
        csvFilename="historisch-ppt-slide-09-top-jun-2024.csv"
        onCsv={(c, f) => downloadUtf8Csv(c, f)}
        onPng={() => void png("s09", "historisch-ppt-slide-09-top-jun.png")}
      >
        <div
          ref={bindSlide("s09")}
          className="flex aspect-video w-full max-w-[960px] flex-col rounded-xl border-2 border-slate-900 bg-white px-4 pb-3 pt-4 shadow-lg"
        >
          <h4 className="text-base font-bold text-slate-900">Top 10 artikelen — juni 2024 (abonneerkliks)</h4>
          {topJunChart.length ? (
            <>
              <div className="mt-1 w-full" style={{ height: CHART_H }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={[...topJunChart].reverse()}
                    margin={{ top: 2, right: 8, left: 2, bottom: 2 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 8 }} tickFormatter={(v) => NlInt(Number(v))} />
                    <YAxis type="category" dataKey="pagePathShort" tick={{ fontSize: 7 }} width={200} />
                    <Tooltip
                      formatter={(value) => [NlInt(typeof value === "number" ? value : Number(value)), ""]}
                      labelFormatter={(_, p) => {
                        const pl = p?.[0]?.payload as { pagePath?: string };
                        return pl?.pagePath ?? "";
                      }}
                    />
                    <Bar dataKey="paywall_abonneren" name="Abonneerkliks" fill="#c2410c" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Duiding>
                Juni is interessant voor SEO-verdieping, omdat Organisch zoeken daar een groter aandeel lijkt te
                hebben in de abonneerkliks bij topartikelen.
              </Duiding>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-600">Geen topartikeldata voor juni 2024.</p>
          )}
        </div>
      </SlideChrome>

      {/* Slide 10 */}
      <SlideChrome
        label="Slide 10 — Herkomst piekartikelen"
        csv={
          chPack.jan.length && chPack.jun.length
            ? powerpointChannelsJanJunCsv(chPack.jan, chPack.jun)
            : undefined
        }
        csvFilename="historisch-ppt-slide-10-kanalen.csv"
        onCsv={(c, f) => downloadUtf8Csv(c, f)}
        onPng={() => void png("s10", "historisch-ppt-slide-10-kanalen.png")}
      >
        <div
          ref={bindSlide("s10")}
          className="flex aspect-video w-full max-w-[960px] flex-col rounded-xl border-2 border-slate-900 bg-white px-4 pb-3 pt-4 shadow-lg"
        >
          <h4 className="text-base font-bold text-slate-900">
            Abonneerkliks op piekartikelen — kanaal (jan vs. jun 2024)
          </h4>
          {meeting.hasStap6 && chMerged.length ? (
            <>
              <div className="mt-1 w-full" style={{ height: CHART_H }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chMerged} margin={{ top: 4, right: 8, left: 0, bottom: 36 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="kanaal" tick={{ fontSize: 7 }} interval={0} angle={-28} textAnchor="end" height={48} />
                    <YAxis tick={{ fontSize: 8 }} width={34} tickFormatter={(v) => NlInt(Number(v))} />
                    <Tooltip formatter={(value) => [NlInt(typeof value === "number" ? value : Number(value)), ""]} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Bar dataKey="januari" name="Jan 2024" fill="#0369a6" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="juni" name="Jun 2024" fill="#c2410c" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Kerntallen
                items={[
                  { label: "Aandeel E-mail (abonneerkliks) jan.", value: formatPct1(janAand?.emailPct ?? null) },
                  { label: "Aandeel org. zoeken jan.", value: formatPct1(janAand?.organicPct ?? null) },
                  { label: "Aandeel E-mail jun.", value: formatPct1(junAand?.emailPct ?? null) },
                  { label: "Aandeel org. zoeken jun.", value: formatPct1(junAand?.organicPct ?? null) },
                ]}
              />
              <Duiding>
                De piekmaanden lijken niet alleen door zoekverkeer verklaard; e-mail/nieuwsbrief speelde een grote rol.
              </Duiding>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-600">Stap 6 (herkomst topartikelen) niet beschikbaar.</p>
          )}
        </div>
      </SlideChrome>

      {/* Slide 11 */}
      <SlideChrome
        label="Slide 11 — Nieuwsbriefontwikkeling"
        csv={
          nbTableA.length
            ? powerpointMeetingRowsCsv("nb_per_1k", meeting.data4 as unknown as Record<string, string | number | null | undefined>[])
            : undefined
        }
        csvFilename="historisch-ppt-slide-11-nieuwsbrief-1k.csv"
        onCsv={(c, f) => downloadUtf8Csv(c, f)}
        onPng={() => void png("s11", "historisch-ppt-slide-11-nieuwsbrief.png")}
      >
        <div
          ref={bindSlide("s11")}
          className="flex aspect-video w-full max-w-[960px] flex-col rounded-xl border-2 border-slate-900 bg-white px-5 pb-4 pt-4 shadow-lg"
        >
          <h4 className="text-base font-bold text-slate-900">Nieuwsbrief-events per 1.000 paginaweergaven</h4>
          {meeting.hasNbA ? (
            <>
              <div className="mt-1" style={{ height: CHART_H }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={meeting.data4} margin={{ top: 4, right: 10, left: 0, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="yearMonth" tick={{ fontSize: 8 }} {...defX} />
                    <YAxis tick={{ fontSize: 8 }} width={34} />
                    <Tooltip
                      formatter={(value) => [NSmall(typeof value === "number" ? value : Number(value)), ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Line
                      type="monotone"
                      dataKey="nieuwsbrief_per_1000_pageviews"
                      name="Per 1.000 paginaweergaven"
                      stroke="#15803d"
                      dot={false}
                      strokeWidth={2}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Kerntallen
                items={[
                  { label: "Gem. per 1.000 pw 2024", value: NSmall(avgNb24) },
                  { label: "Gem. 2025", value: NSmall(avgNb25) },
                  { label: "Gem. 2026 (maanden in data)", value: NSmall(avgNb26) },
                  {
                    label: "Laagste maand",
                    value: nbLow ? `${ymToNlLabel(nbLow.ym)} (${NSmall(nbLow.v)})` : "—",
                  },
                ]}
              />
              <Duiding>
                Nieuwsbrief-events lijken ook gecorrigeerd voor pageviews te dalen; het ligt dus niet alleen aan minder
                verkeer.
              </Duiding>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-600">Stap 7 (nieuwsbrief) niet beschikbaar.</p>
          )}
        </div>
      </SlideChrome>

      {/* Slide 12 */}
      <SlideChrome
        label="Slide 12 — Nieuwsbrief per device"
        csv={
          meeting.data5.length ? powerpointNbDeviceMonthCsv(meeting.data5) : undefined
        }
        csvFilename="historisch-ppt-slide-12-nieuwsbrief-device.csv"
        onCsv={(c, f) => downloadUtf8Csv(c, f)}
        onPng={() => void png("s12", "historisch-ppt-slide-12-device.png")}
      >
        <div
          ref={bindSlide("s12")}
          className="flex aspect-video w-full max-w-[960px] flex-col rounded-xl border-2 border-slate-900 bg-white px-5 pb-4 pt-4 shadow-lg"
        >
          <h4 className="text-base font-bold text-slate-900">Nieuwsbrief per device (per 1.000 paginaweergaven)</h4>
          {meeting.hasNbB ? (
            <>
              <div className="mt-1" style={{ height: CHART_H }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={meeting.data5} margin={{ top: 4, right: 10, left: 0, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="yearMonth" tick={{ fontSize: 8 }} {...defX} />
                    <YAxis tick={{ fontSize: 8 }} width={34} />
                    <Tooltip formatter={(v) => [NSmall(typeof v === "number" ? v : Number(v)), ""]} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Line type="monotone" dataKey="desktop" name="Desktop" stroke="#1e40af" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="mobile" name="Mobiel" stroke="#b45309" dot={false} strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="tablet" name="Tablet" stroke="#6b21a8" dot={false} strokeWidth={2} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Kerntallen
                items={[
                  { label: "Gem. desktop", value: NSmall(deskAvg) },
                  { label: "Gem. mobiel", value: NSmall(mobAvg) },
                  {
                    label: "Verhouding desktop/mobiel",
                    value: dmRatio == null ? "—" : `${dmRatio.toLocaleString("nl-NL", { maximumFractionDigits: 2 })}×`,
                  },
                ]}
              />
              <Duiding>
                Mobiel presteert doorgaans lager dan desktop; mobiele zichtbaarheid en gebruiksgemak zijn logische
                aandachtspunten.
              </Duiding>
            </>
          ) : (
            <p className="mt-6 text-sm text-slate-600">Device-opdeling (stap 7B) niet beschikbaar.</p>
          )}
        </div>
      </SlideChrome>

      {/* Slide 13 */}
      <SlideChrome label="Slide 13 — Wat weten we nog niet?" onPng={() => void png("s13", "historisch-ppt-slide-13-beperkingen.png")}>
        <div
          ref={bindSlide("s13")}
          className="aspect-video w-full max-w-[960px] space-y-2 rounded-xl border-2 border-slate-900 bg-white px-7 py-6 shadow-lg"
        >
          <h4 className="text-lg font-bold text-slate-900">Beperkingen</h4>
          <ul className="list-disc space-y-2 pl-4 text-[10px] leading-snug text-slate-800">
            <li>
              <code className="rounded bg-slate-100 px-0.5">paywall_abonneren</code> meet klik naar shop, niet
              noodzakelijk een betaald abonnement.
            </li>
            <li>
              <code className="rounded bg-slate-100 px-0.5">nieuwsbrief_inschrijving_artikelen</code> meet het
              GA4-event, niet per se backend-inschrijving of double opt-in.
            </li>
            <li>
              Zonder aparte <code className="rounded bg-slate-100 px-0.5">nieuwsbriefblok_view</code> en{" "}
              <code className="rounded bg-slate-100 px-0.5">nieuwsbriefblok_click</code> is niet vast te stellen of
              het probleem zichtbaarheid, klikbereidheid of formulierconversie is.
            </li>
            <li>
              PageTitle lijkt soms afwijkend of vertaald; <span className="font-mono">pagePath</span> is betrouwbaarder
              voor artikelanalyse.
            </li>
          </ul>
        </div>
      </SlideChrome>

      {/* Slide 14 */}
      <SlideChrome
        label="Slide 14 — Conclusies en vervolgstappen"
        onPng={() => void png("s14", "historisch-ppt-slide-14-conclusies.png")}
      >
        <div
          ref={bindSlide("s14")}
          className="grid aspect-video w-full max-w-[960px] grid-cols-1 gap-3 rounded-xl border-2 border-slate-900 bg-white p-5 shadow-lg md:grid-cols-3"
        >
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Conclusies</h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-3 text-[9px] leading-snug text-slate-800">
              <li>Minder paywall-exposure lijkt belangrijker dan een lagere paywallklikratio.</li>
              <li>Niet het totale siteverkeer daalt zichtbaar, maar het aandeel dat de paywall bereikt.</li>
              <li>Piekmaanden werden sterk gedragen door e-mail/nieuwsbrief; org. zoeken was vooral in juni relevant.</li>
              <li>Nieuwsbriefblok-performance per pageview lijkt duidelijk gedaald.</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 md:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Vervolgstappen</h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-3 text-[9px] leading-snug text-slate-800">
              <li>Meet nieuwsbriefblok_view en nieuwsbriefblok_click apart.</li>
              <li>Analyseer shopconversie na paywall_abonneren indien mogelijk.</li>
              <li>Onderzoek mobiele zichtbaarheid en positie van nieuwsbriefblokken.</li>
              <li>Onderzoek juni 2024 op SEO-niveau: zoekwoorden, landingspagina’s en artikeltypen.</li>
              <li>Vergelijk nieuwe artikelen met bestaande evergreen-artikelen op paywallviews en abonneerkliks.</li>
            </ul>
          </div>
        </div>
      </SlideChrome>
    </section>
  );
}

function SlideChrome({
  label,
  csv,
  csvFilename,
  onCsv,
  onPng,
  children,
}: {
  label: string;
  csv?: string;
  csvFilename?: string;
  onCsv?: (csv: string, filename: string) => void;
  onPng: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 pb-12 last:border-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
        <div className="flex flex-wrap gap-2 print:hidden">
          {csv && csvFilename && onCsv ? (
            <button
              type="button"
              onClick={() => onCsv(csv, csvFilename)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
            >
              Download CSV
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void onPng()}
            className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Download slide asset als PNG
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
