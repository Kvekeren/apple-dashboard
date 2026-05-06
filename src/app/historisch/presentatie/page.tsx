"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChartBlockChannelBarsSingle,
  ChartBlockNewsletter1k,
  ChartBlockNewsletterDevice,
  ChartBlockPaywallDual,
  ChartBlockPaywallRatio,
  ChartBlockScreenPageviewsPaywall,
  channelAbonneren,
  exportChartPng,
  useMeetingChartData,
} from "@/components/historisch/historisch-meeting-charts-blocks";
import type { HistorischCombinedMonthRow } from "@/lib/historisch-combined-shared";
import { buildHistorischCombinedMonthly } from "@/lib/historisch-combined-shared";
import type { HistorischFunnelMonthlyReport } from "@/lib/historisch-funnel-shared";
import type { HistorischNieuwsbriefArtikelReport } from "@/lib/historisch-nieuwsbrief-artikel-shared";
import { formatPer1k, formatPct, formatRatio } from "@/lib/historisch-page-format";
import type { HistorischTopArticlesOriginReport } from "@/lib/historisch-top-articles-origin-shared";
import type { HistorischTopArticlePivotRow } from "@/lib/historisch-top-articles-shared";
import type { HistorischTopArticlesReport } from "@/lib/historisch-top-articles-shared";
import type { HistorischTrafficMonthlyReport } from "@/lib/historisch-traffic-shared";

const PRES_MAX_W = "max-w-[1180px]";
const CHART_H = 360;
const CHART_X = 11;
const BAR_H = 280;
const DL = "Download PNG";

function meanMonthlyPaywallShare(rows: HistorischCombinedMonthRow[], yearPrefix: string): number | null {
  const subset = rows.filter((r) => r.yearMonth.startsWith(yearPrefix));
  if (!subset.length) return null;
  let sum = 0;
  let n = 0;
  for (const r of subset) {
    if (r.screenPageViews > 0) {
      sum += r.paywall_view / r.screenPageViews;
      n++;
    }
  }
  return n ? sum / n : null;
}

function meanPaywallAbonneerRatio(rows: HistorischCombinedMonthRow[], yearPrefix: string): number | null {
  const subset = rows.filter((r) => r.yearMonth.startsWith(yearPrefix));
  const vals = subset.map((r) => r.paywall_abonneer_ratio).filter((x): x is number => x != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function formatSharePct(x: number | null): string {
  if (x == null) return "—";
  return (x * 100).toLocaleString("nl-NL", { maximumFractionDigits: 2 }) + "%";
}

function meanFromTableA(
  table: HistorischNieuwsbriefArtikelReport["tableA"],
  yearPrefix: string,
  key: "nieuwsbrief_per_1000_pageviews"
): number | null {
  const subset = table.filter((r) => r.yearMonth.startsWith(yearPrefix));
  const vals = subset.map((r) => r[key]).filter((x): x is number => x != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function lowestNbPer1kMonth(table: HistorischNieuwsbriefArtikelReport["tableA"]): {
  yearMonth: string;
  v: number;
} | null {
  let best: { yearMonth: string; v: number } | null = null;
  for (const r of table) {
    const v = r.nieuwsbrief_per_1000_pageviews;
    if (v == null) continue;
    if (!best || v < best.v) best = { yearMonth: r.yearMonth, v };
  }
  return best;
}

function avgNbPer1kByDevice(tableB: HistorischNieuwsbriefArtikelReport["tableB"]): {
  desktop: number | null;
  mobile: number | null;
  tablet: number | null;
} {
  const acc = {
    desktop: [] as number[],
    mobile: [] as number[],
    tablet: [] as number[],
  };
  for (const r of tableB) {
    const d = r.deviceCategory.toLowerCase();
    if (d !== "desktop" && d !== "mobile" && d !== "tablet") continue;
    const v = r.nieuwsbrief_per_1000_pageviews;
    if (v == null) continue;
    acc[d as "desktop" | "mobile" | "tablet"].push(v);
  }
  const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  return { desktop: mean(acc.desktop), mobile: mean(acc.mobile), tablet: mean(acc.tablet) };
}

function channelAboSharePct(
  summary: HistorischTopArticlesOriginReport["january2024"]["summary"],
  gaKey: string
): number | null {
  const total = summary.reduce((s, r) => s + r.paywall_abonneren, 0);
  if (total <= 0) return null;
  return (channelAbonneren(summary, gaKey) / total) * 100;
}

function shortenPagePath(path: string, max = 46): string {
  if (!path) return "—";
  return path.length > max ? `${path.slice(0, max - 1)}…` : path;
}

function InsightList({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc space-y-1.5 text-base leading-relaxed text-slate-700">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function KpiCards({ items, columnsClass = "sm:grid-cols-3" }: { items: { label: string; value: string }[]; columnsClass?: string }) {
  return (
    <div className={`grid gap-3 ${columnsClass}`}>
      {items.map((x) => (
        <div key={x.label} className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{x.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{x.value}</p>
        </div>
      ))}
    </div>
  );
}

function TopFiveMiniTable({ rows }: { rows: HistorischTopArticlePivotRow[] }) {
  const five = rows.slice(0, 5);
  if (!five.length) {
    return <p className="text-sm text-slate-600">Data niet beschikbaar.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-3 py-2 font-medium text-slate-800">pagePath</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-800">abo</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-800">view</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium text-slate-800">ratio</th>
          </tr>
        </thead>
        <tbody>
          {five.map((r) => (
            <tr key={r.pagePath} className="border-b border-slate-100 last:border-0">
              <td className="max-w-[14rem] px-3 py-2 font-mono text-xs text-slate-800" title={r.pagePath}>
                {shortenPagePath(r.pagePath, 40)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                {r.paywall_abonneren.toLocaleString("nl-NL")}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                {r.paywall_view.toLocaleString("nl-NL")}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                {formatRatio(r.paywall_abonneer_ratio)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NAV: [string, string][] = [
  ["pres-kader", "1. Kader"],
  ["pres-conclusie", "2. Conclusie"],
  ["pres-pv-pw", "3. Verkeer vs paywall"],
  ["pres-pw-abo", "4. Paywall & abo"],
  ["pres-ratio", "5. Paywallratio"],
  ["pres-piek-art", "6. Piekartikelen"],
  ["pres-piek-kanaal", "7. Kanalen piek"],
  ["pres-nb-1k", "8. Nieuwsbrief / 1k"],
  ["pres-nb-device", "9. Nieuwsbrief device"],
  ["pres-vervolg", "10. Vervolg"],
];

export default function HistorischPresentatiePage() {
  const [funnel, setFunnel] = useState<HistorischFunnelMonthlyReport | null>(null);
  const [traffic, setTraffic] = useState<HistorischTrafficMonthlyReport | null>(null);
  const [topArticles, setTopArticles] = useState<HistorischTopArticlesReport | null>(null);
  const [topOrigin, setTopOrigin] = useState<HistorischTopArticlesOriginReport | null>(null);
  const [nbArtikel, setNbArtikel] = useState<HistorischNieuwsbriefArtikelReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const combined = useMemo(() => buildHistorischCombinedMonthly(funnel, traffic), [funnel, traffic]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [resF, resT, resTop, resOrigin, resNb] = await Promise.all([
        fetch("/api/historisch/funnel-monthly", { credentials: "include" }),
        fetch("/api/historisch/traffic-monthly", { credentials: "include" }),
        fetch("/api/historisch/top-articles", { credentials: "include" }),
        fetch("/api/historisch/top-articles-origin", { credentials: "include" }),
        fetch("/api/historisch/nieuwsbrief-artikel", { credentials: "include" }),
      ]);

      const jf = (await resF.json()) as HistorischFunnelMonthlyReport & { error?: string };
      if (resF.ok) setFunnel(jf);
      else {
        setFunnel(null);
        setErr(jf.error ?? `Funnel: HTTP ${resF.status}`);
      }

      const jt = (await resT.json()) as HistorischTrafficMonthlyReport & { error?: string };
      if (resT.ok) setTraffic(jt);
      else {
        setTraffic(null);
        setErr((e) => (e ? `${e}; ` : "") + (jt.error ?? `Verkeer: HTTP ${resT.status}`));
      }

      const jTop = (await resTop.json()) as HistorischTopArticlesReport & { error?: string };
      if (resTop.ok) setTopArticles(jTop);
      else {
        setTopArticles(null);
        setErr((e) => (e ? `${e}; ` : "") + (jTop.error ?? `Topartikelen: HTTP ${resTop.status}`));
      }

      const jOr = (await resOrigin.json()) as HistorischTopArticlesOriginReport & { error?: string };
      if (resOrigin.ok) setTopOrigin(jOr);
      else {
        setTopOrigin(null);
        setErr((e) => (e ? `${e}; ` : "") + (jOr.error ?? `Herkomst: HTTP ${resOrigin.status}`));
      }

      const jNb = (await resNb.json()) as HistorischNieuwsbriefArtikelReport & { error?: string };
      if (resNb.ok) setNbArtikel(jNb);
      else {
        setNbArtikel(null);
        setErr((e) => (e ? `${e}; ` : "") + (jNb.error ?? `Nieuwsbrief: HTTP ${resNb.status}`));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Onbekende fout");
      setFunnel(null);
      setTraffic(null);
      setTopArticles(null);
      setTopOrigin(null);
      setNbArtikel(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const chart = useMeetingChartData(
    combined.rows.length > 0 ? combined : null,
    nbArtikel && !nbArtikel.fatalError && !nbArtikel.error ? nbArtikel : null,
    topOrigin && !topOrigin.fatalError ? topOrigin : null
  );

  const refPvPw = useRef<HTMLDivElement>(null);
  const refPwAbo = useRef<HTMLDivElement>(null);
  const refRatio = useRef<HTMLDivElement>(null);
  const refNb1k = useRef<HTMLDivElement>(null);
  const refNbDev = useRef<HTMLDivElement>(null);
  const refChJan = useRef<HTMLDivElement>(null);
  const refChJun = useRef<HTMLDivElement>(null);

  const rows = combined.rows;
  const share2024 = meanMonthlyPaywallShare(rows, "2024-");
  const share2025 = meanMonthlyPaywallShare(rows, "2025-");
  const share2026 = meanMonthlyPaywallShare(rows, "2026-");

  const ratioAvg2024 = meanPaywallAbonneerRatio(rows, "2024-");
  const ratioAvg2025 = meanPaywallAbonneerRatio(rows, "2025-");
  const ratioAvg2026 = meanPaywallAbonneerRatio(rows, "2026-");

  const tableA = nbArtikel?.tableA ?? [];
  const nb2024 = meanFromTableA(tableA, "2024-", "nieuwsbrief_per_1000_pageviews");
  const nb2025 = meanFromTableA(tableA, "2025-", "nieuwsbrief_per_1000_pageviews");
  const nb2026 = meanFromTableA(tableA, "2026-", "nieuwsbrief_per_1000_pageviews");
  const nbLow = tableA.length ? lowestNbPer1kMonth(tableA) : null;

  const devAvg = useMemo(
    () => avgNbPer1kByDevice(nbArtikel?.tableB ?? []),
    [nbArtikel?.tableB]
  );
  const devRatio =
    devAvg.desktop != null && devAvg.mobile != null && devAvg.mobile !== 0
      ? devAvg.desktop / devAvg.mobile
      : null;

  const janSum = topOrigin?.january2024.summary ?? [];
  const junSum = topOrigin?.june2024.summary ?? [];

  function go(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900 print:bg-white">
      <header className={`border-b border-slate-200/80 bg-white/90 px-4 py-6 shadow-sm print:shadow-none ${PRES_MAX_W} mx-auto`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Presentatie</p>
            <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              Analyse online/digitale instroom Historisch Nieuwsblad
            </h1>
            <p className="mt-3 max-w-3xl text-pretty text-base text-slate-600">
              Paywall, piekartikelen en nieuwsbriefblokken — januari 2024 t/m april 2026
            </p>
          </div>
          <div className="shrink-0 space-y-2 rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-800">Databron:</span> GA4 Data API
            </p>
            <p>
              <span className="font-medium text-slate-800">Periode:</span> januari 2024 t/m april 2026
            </p>
            <div className="flex flex-col gap-2 print:hidden">
              <Link
                href="/historisch"
                className="inline-flex items-center justify-center rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-slate-800"
              >
                Terug naar dashboard
              </Link>
              <Link
                href="/historisch"
                className="text-center text-xs font-medium text-slate-600 underline-offset-4 hover:underline"
              >
                Ruwe data en exports
              </Link>
            </div>
          </div>
        </div>
      </header>

      <nav
        className={`sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden ${PRES_MAX_W} mx-auto supports-[backdrop-filter]:bg-white/85`}
      >
        <p className="mb-2 text-xs text-slate-500">Snel naar sectie</p>
        <div className="flex flex-wrap gap-1.5">
          {NAV.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className={`${PRES_MAX_W} mx-auto space-y-16 px-4 py-12 print:space-y-10 print:py-6`}>
        {loading && <p className="text-slate-600">Bezig met laden…</p>}
        {err && !loading && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {err} — controleer het dashboard op <Link className="underline" href="/historisch">/historisch</Link>.
          </p>
        )}

        <section
          id="pres-kader"
          className="scroll-mt-36 space-y-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:break-inside-avoid"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">1 — Waar kijken we naar?</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">1 / 10</span>
          </div>
          <p className="text-base text-slate-800">
            We kijken waar de instroom stokt: bij verkeer, paywall-exposure, klik naar abonnement of
            nieuwsbriefinschrijving.
          </p>
          <InsightList
            items={[
              "Paywall views",
              "Klikken naar abonnement",
              "Piekmaanden januari en juni 2024",
              "Nieuwsbriefblokken in artikelen",
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Paywall & conversie",
              "Piekartikelen (pagePath)",
              "Kanaalherkomst piek",
              "Nieuwsbrief per verkeer",
            ].map((t) => (
              <div key={t} className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-center text-sm font-medium text-slate-700">
                {t}
              </div>
            ))}
          </div>
        </section>

        <section
          id="pres-conclusie"
          className="scroll-mt-36 space-y-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">2 — Belangrijkste conclusie vooraf</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">2 / 10</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              "Paywall-views lijken te zijn gedaald, maar totale pageviews niet in dezelfde mate.",
              "Abonneerkliks dalen mogelijk minder hard; de paywallratio ligt daardoor vaak hoger.",
              "Nieuwsbriefblokken presteren waarschijnlijk duidelijk slechter per pageview, vooral op mobiel.",
            ].map((t) => (
              <div key={t} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-base leading-snug text-indigo-950">
                {t}
              </div>
            ))}
          </div>
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800">
            Het probleem lijkt niet simpelweg minder verkeer, maar minder verkeer dat de paywall of nieuwsbrief goed
            bereikt.
          </p>
        </section>

        <section
          id="pres-pv-pw"
          className="scroll-mt-36 space-y-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">3 — Siteverkeer versus paywall-views</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">3 / 10</span>
          </div>
          <p className="text-lg font-medium text-slate-800">Zijn paywall-views even sterk gedaald als totale pageviews?</p>
          {chart.hasCombined ? (
            <>
              <div className="aspect-video w-full min-h-[320px] min-w-0 max-h-[420px]">
                <ChartBlockScreenPageviewsPaywall
                  dataPvPw={chart.dataPvPw}
                  chartRef={refPvPw}
                  chartHeight={CHART_H}
                  xTick={CHART_X}
                  title="Paginaweergaven en paywallweergaven per maand"
                  caption="Twee assen: totale paginaweergaven (links) en paywallweergaven (rechts)."
                  onDownloadPng={() => void exportChartPng(refPvPw.current, "presentatie-verkeer-paywall.png")}
                  downloadLabel={DL}
                />
              </div>
              <KpiCards
                items={[
                  { label: "Gem. aandeel paywall/view 2024", value: formatSharePct(share2024) },
                  { label: "Gem. aandeel paywall/view 2025", value: formatSharePct(share2025) },
                  { label: "Gem. aandeel paywall/view 2026 YTD", value: formatSharePct(share2026) },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-slate-600">Data niet beschikbaar (stap 2 en 3 nodig).</p>
          )}
          <p className="font-medium text-slate-900">
            Totale pageviews lijken redelijk op peil te blijven, maar het aandeel pageviews met paywall-view daalt
            waarschijnlijk.
          </p>
          <InsightList
            items={[
              "Minder paywall-exposure binnen bestaand verkeer.",
              "Mogelijk meer verkeer naar gratis of niet-betaalde content.",
              "Mogelijk andere artikelmix of distributie.",
            ]}
          />
        </section>

        <section
          id="pres-pw-abo"
          className="scroll-mt-36 space-y-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">4 — Paywall-views en abonneerkliks</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">4 / 10</span>
          </div>
          <p className="text-lg font-medium text-slate-800">
            Daalt de instroom vooral omdat mensen minder op abonneren klikken?
          </p>
          {chart.hasCombined ? (
            <div className="aspect-video w-full min-h-[320px] min-w-0 max-h-[420px]">
              <ChartBlockPaywallDual
                data1={chart.data1}
                chartRef={refPwAbo}
                chartHeight={CHART_H}
                xTick={CHART_X}
                filename="presentatie-paywall-abo.png"
                title="Paywallweergaven en abonneerkliks per maand"
                caption="Paywallweergaven (links) en klikken naar de shop (rechts)."
                onDownloadPng={() => void exportChartPng(refPwAbo.current, "presentatie-paywall-abo.png")}
                downloadLabel={DL}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-600">Data niet beschikbaar.</p>
          )}
          <p className="font-medium text-slate-900">Paywall-views lijken sterker te dalen dan abonneerkliks.</p>
          <InsightList
            items={[
              "Waarschijnlijk zien minder mensen de paywall.",
              "Wie de paywall ziet, klikt nog steeds relatief vaak door.",
              "De paywall zelf lijkt daarmee niet het grootste lek (klikuitslag).",
            ]}
          />
        </section>

        <section
          id="pres-ratio"
          className="scroll-mt-36 space-y-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">5 — Paywallratio</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">5 / 10</span>
          </div>
          <p className="text-lg font-medium text-slate-800">Is de conversie vanuit de paywall verslechterd?</p>
          {chart.hasCombined ? (
            <>
              <div className="aspect-video w-full min-h-[320px] min-w-0 max-h-[420px]">
                <ChartBlockPaywallRatio
                  data2={chart.data2}
                  chartRef={refRatio}
                  chartHeight={CHART_H}
                  xTick={CHART_X}
                  filename="presentatie-paywall-ratio.png"
                  title="Paywall-abonneerratio per maand"
                  caption="Abonneerkliks gedeeld door paywallweergaven."
                  onDownloadPng={() => void exportChartPng(refRatio.current, "presentatie-paywall-ratio.png")}
                  downloadLabel={DL}
                />
              </div>
              <KpiCards
                items={[
                  { label: "Gemiddelde ratio 2024", value: formatRatio(ratioAvg2024) },
                  { label: "Gemiddelde ratio 2025", value: formatRatio(ratioAvg2025) },
                  { label: "Gemiddelde ratio 2026 YTD", value: formatRatio(ratioAvg2026) },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-slate-600">Data niet beschikbaar.</p>
          )}
          <p className="font-medium text-slate-900">
            De paywall-abonneerratio ligt in 2025 vaak hoger dan in 2024 — dit wijst niet per se op lagere klik vanuit
            de paywall.
          </p>
          <InsightList
            items={[
              "Dit wijst niet op een duidelijk slechtere klik vanuit de paywall.",
              "Eerder op minder volume vóór de paywall-exposure.",
              "Let op: paywall_abonneren is een klik naar de shop, geen bevestigd betaald abonnement.",
            ]}
          />
        </section>

        <section
          id="pres-piek-art"
          className="scroll-mt-36 space-y-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">6 — Wat verklaarde januari en juni 2024?</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">6 / 10</span>
          </div>
          <p className="text-lg font-medium text-slate-800">Welke artikelen zorgden voor de pieken?</p>
          {topArticles && !topArticles.fatalError ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">Januari 2024 — top 5 op abonneerkliks</p>
                <TopFiveMiniTable rows={topArticles.january2024.topByAbonnement} />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">Juni 2024 — top 5 op abonneerkliks</p>
                <TopFiveMiniTable rows={topArticles.june2024.topByAbonnement} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">Data niet beschikbaar (stap 5).</p>
          )}
          <p className="font-medium text-slate-900">
            De pieken kwamen waarschijnlijk niet door één artikel, maar door een groep sterke artikelen.
          </p>
          <InsightList
            items={[
              "Januari had een duidelijke grootste driver: /voor-houthis-is-oorlog-een-way-of-life/",
              "Juni had als belangrijke driver: /hamas-lang-gedoogd-door-israel/",
              "Actuele/geopolitieke onderwerpen lijken relatief sterk.",
              "pagePath is betrouwbaarder dan pageTitle (vertaling/varianten).",
            ]}
          />
        </section>

        <section
          id="pres-piek-kanaal"
          className="scroll-mt-36 space-y-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">7 — Waar kwamen de piekartikelen vandaan?</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">7 / 10</span>
          </div>
          <p className="text-lg font-medium text-slate-800">
            Kwam de piek door SEO, nieuwsbrief, social of direct?
          </p>
          {chart.hasStap6 ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartBlockChannelBarsSingle
                  data={chart.data6Jan}
                  chartRef={refChJan}
                  barHeight={BAR_H}
                  monthTitle="Januari 2024 — kanaal (topartikelen)"
                  fill="#4f46e5"
                  caption="Abonneerkliks op de top-25-artikelen naar standaardkanalen."
                  onDownloadPng={() => void exportChartPng(refChJan.current, "presentatie-kanaal-jan-2024.png")}
                  downloadLabel={DL}
                />
                <ChartBlockChannelBarsSingle
                  data={chart.data6Jun}
                  chartRef={refChJun}
                  barHeight={BAR_H}
                  monthTitle="Juni 2024 — kanaal (topartikelen)"
                  fill="#7c3aed"
                  caption="Zelfde maatstaf voor juni."
                  onDownloadPng={() => void exportChartPng(refChJun.current, "presentatie-kanaal-jun-2024.png")}
                  downloadLabel={DL}
                />
              </div>
              <KpiCards
                columnsClass="sm:grid-cols-2 lg:grid-cols-4"
                items={[
                  {
                    label: "Jan — aandeel E-mail (abo-kanalen)",
                    value: formatPct(channelAboSharePct(janSum, "email")),
                  },
                  {
                    label: "Jan — aandeel Organisch zoeken",
                    value: formatPct(channelAboSharePct(janSum, "organic search")),
                  },
                  {
                    label: "Jun — aandeel E-mail",
                    value: formatPct(channelAboSharePct(junSum, "email")),
                  },
                  {
                    label: "Jun — aandeel Organisch zoeken",
                    value: formatPct(channelAboSharePct(junSum, "organic search")),
                  },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-slate-600">Data niet beschikbaar (stap 6).</p>
          )}
          <p className="font-medium text-slate-900">
            Nieuwsbrief/e-mail lijkt sterk bij te dragen aan de piekmaanden; organisch zoeken was vooral in juni
            belangrijker.
          </p>
          <InsightList
            items={[
              "Januari was naar alle waarschijnlijkheid vooral e-mailgedreven.",
              "Juni had een groter aandeel uit organisch zoeken.",
              "Voor SEO-verdieping is juni interessanter dan januari.",
            ]}
          />
        </section>

        <section
          id="pres-nb-1k"
          className="scroll-mt-36 space-y-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">8 — Nieuwsbriefblokken: minder resultaat per pageview</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">8 / 10</span>
          </div>
          <p className="text-lg font-medium text-slate-800">Waarom zien we weinig nieuwsbriefinschrijvingen?</p>
          {chart.hasNbA ? (
            <>
              <div className="aspect-video w-full min-h-[320px] min-w-0 max-h-[420px]">
                <ChartBlockNewsletter1k
                  data4={chart.data4}
                  chartRef={refNb1k}
                  chartHeight={CHART_H}
                  xTick={CHART_X}
                  title="Nieuwsbrief (artikel) per 1.000 paginaweergaven"
                  caption="nieuwsbrief_inschrijving_artikelen per 1.000 screenPageViews (stap 7, tabel A)."
                  onDownloadPng={() => void exportChartPng(refNb1k.current, "presentatie-nieuwsbrief-1k.png")}
                  downloadLabel={DL}
                />
              </div>
              <KpiCards
                items={[
                  { label: "Gemiddelde / 1k PV 2024", value: formatPer1k(nb2024) },
                  { label: "Gemiddelde / 1k PV 2025", value: formatPer1k(nb2025) },
                  { label: "Gemiddelde / 1k PV 2026 YTD", value: formatPer1k(nb2026) },
                ]}
              />
              <p className="text-sm text-slate-700">
                Laagste maand (indicatie):{" "}
                <span className="font-mono font-medium">
                  {nbLow ? `${nbLow.yearMonth} (${formatPer1k(nbLow.v)})` : "—"}
                </span>
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">Data niet beschikbaar (stap 7 tabel A).</p>
          )}
          <p className="font-medium text-slate-900">
            De nieuwsbrief-events lijken ook gecorrigeerd voor pageviews te dalen.
          </p>
          <InsightList
            items={[
              "Het ligt waarschijnlijk niet alleen aan minder verkeer.",
              "Mogelijk zichtbaarheid, positie, copy of formuliergedrag.",
              "Met de huidige events is niet te zien of het blok gezien of aangeklikt is.",
            ]}
          />
        </section>

        <section
          id="pres-nb-device"
          className="scroll-mt-36 space-y-4 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">9 — Nieuwsbrief mobiel versus desktop</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">9 / 10</span>
          </div>
          <p className="text-lg font-medium text-slate-800">Kan het aan device of zichtbaarheid liggen?</p>
          {chart.hasNbB ? (
            <>
              <div className="aspect-video w-full min-h-[320px] min-w-0 max-h-[420px]">
                <ChartBlockNewsletterDevice
                  data5={chart.data5}
                  chartRef={refNbDev}
                  chartHeight={CHART_H}
                  xTick={CHART_X}
                  title="Nieuwsbrief per 1.000 paginaweergaven per apparaat"
                  caption="Desktop, mobiel en tablet (stap 7 tabel B — ruwe maandgemiddelden per device)."
                  onDownloadPng={() => void exportChartPng(refNbDev.current, "presentatie-nieuwsbrief-device.png")}
                  downloadLabel={DL}
                />
              </div>
              <KpiCards
                items={[
                  { label: "Gemiddelde desktop (/1k PV)", value: formatPer1k(devAvg.desktop) },
                  { label: "Gemiddelde mobiel (/1k PV)", value: formatPer1k(devAvg.mobile) },
                  {
                    label: "Verhouding desktop ÷ mobiel",
                    value:
                      devRatio == null
                        ? "—"
                        : devRatio.toLocaleString("nl-NL", { maximumFractionDigits: 2 }),
                  },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-slate-600">Data niet beschikbaar (stap 7 tabel B).</p>
          )}
          <p className="font-medium text-slate-900">Mobiel presteert doorgaans lager dan desktop.</p>
          <InsightList
            items={[
              "Test mobiele positie en zichtbaarheid.",
              "Check of het blok niet te laag in het artikel staat.",
              "Meet blok-view en blok-click apart als vervolg.",
            ]}
          />
        </section>

        <section
          id="pres-vervolg"
          className="scroll-mt-36 space-y-6 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900">10 — Wat doen we hiermee?</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600">10 / 10</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Wat lijkt duidelijk</h3>
              <InsightList
                items={[
                  "Minder paywall-exposure lijkt belangrijker dan een lagere paywallklikratio.",
                  "Het totale verkeer is niet het hele probleem; het gaat om verkeer dat de paywall bereikt.",
                  "Nieuwsbriefblok-performance lijkt te zijn gedaald.",
                ]}
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Wat weten we nog niet</h3>
              <InsightList
                items={[
                  "Of paywall_abonneren leidt tot betaalde abonnementen.",
                  "Of nieuwsbrief_inschrijving_artikelen een klik, submit of echte inschrijving meet.",
                  "Of het nieuwsbriefprobleem zit in zichtbaarheid, klik of formulierconversie.",
                ]}
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Vervolgacties</h3>
              <InsightList
                items={[
                  "Meet nieuwsbriefblok_view en nieuwsbriefblok_click.",
                  "Analyseer shopconversie na paywall_abonneren.",
                  "Bekijk mobiele nieuwsbriefblokken.",
                  "Onderzoek juni 2024 SEO-artikelen verder.",
                  "Vergelijk nieuwe content met evergreen-artikelen op paywallviews.",
                ]}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
