"use client";

import { useRef } from "react";
import {
  ChartBlockChannelBarsSingle,
  ChartBlockNewsletter1k,
  ChartBlockNewsletterDevice,
  ChartBlockIndex,
  ChartBlockPaywallDual,
  ChartBlockPaywallRatio,
  exportChartPng,
  useMeetingChartData,
} from "@/components/historisch/historisch-meeting-charts-blocks";
import type { HistorischCombinedMonthlyReport } from "@/lib/historisch-combined-shared";
import type { HistorischNieuwsbriefArtikelReport } from "@/lib/historisch-nieuwsbrief-artikel-shared";
import type { HistorischTopArticlesOriginReport } from "@/lib/historisch-top-articles-origin-shared";

const DASH_H = 310;
const DASH_TICK = 10;
const PEAK_BAR_H = 300;

/** Dashboard-sectie Overzicht: grafieken 1–4 (zelfde brondata als stap 8, groter formaat). */
export function HistorischDashboardOverviewCharts({
  combined,
  nbArtikel,
}: {
  combined: HistorischCombinedMonthlyReport | null;
  nbArtikel: HistorischNieuwsbriefArtikelReport | null;
}) {
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);

  const d = useMeetingChartData(combined, nbArtikel, null);

  if (!d.hasCombined && !d.hasNbA) {
    return (
      <p className="text-sm text-slate-600">
        Niet genoeg data voor het overzicht (stap 4 en/of 7).
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {d.hasCombined ? (
        <>
          <ChartBlockPaywallDual
            data1={d.data1}
            chartRef={ref1}
            chartHeight={DASH_H}
            xTick={DASH_TICK}
            filename="stap8-grafiek1-paywall-maand.png"
            title="Grafiek 1 — Paywallweergaven en abonneerkliks per maand"
            caption="Paywallweergaven (linkeras) en abonneerkliks (rechteras) per maand."
            onDownloadPng={() => void exportChartPng(ref1.current, "stap8-grafiek1-paywall-maand.png")}
          />
          <ChartBlockPaywallRatio
            data2={d.data2}
            chartRef={ref2}
            chartHeight={DASH_H}
            xTick={DASH_TICK}
            filename="stap8-grafiek2-paywall-ratio.png"
            title="Grafiek 2 — Paywall-abonneerratio"
            caption="Verhouding abonneerkliks ten opzichte van paywallweergaven per maand."
            onDownloadPng={() => void exportChartPng(ref2.current, "stap8-grafiek2-paywall-ratio.png")}
          />
          <ChartBlockIndex
            data3={d.data3}
            chartRef={ref3}
            chartHeight={DASH_H}
            xTick={DASH_TICK}
            title="Grafiek 3 — Index nieuwe gebruikers en paywallweergaven"
            caption="Indices met januari 2024 = 100 voor nieuwe gebruikers en paywallweergaven."
            onDownloadPng={() => void exportChartPng(ref3.current, "stap8-grafiek3-index-nieuw-pw.png")}
          />
        </>
      ) : null}
      {d.hasNbA ? (
        <ChartBlockNewsletter1k
          data4={d.data4}
          chartRef={ref4}
          chartHeight={DASH_H}
          xTick={DASH_TICK}
          title="Grafiek 4 — Nieuwsbrief artikelblok per 1.000 paginaweergaven"
          caption="Geschat aantal inschrijvings-events per duizend schermpaginaweergaven, per maand."
          onDownloadPng={() => void exportChartPng(ref4.current, "stap8-grafiek4-nieuwsbrief-per-1k-pv.png")}
        />
      ) : null}
    </div>
  );
}

/** Sectie Nieuwsbrief: grafiek 4 en 5 (aparte DOM voor leesbaarheid op projector). */
export function HistorischDashboardNewsletterCharts({
  combined,
  nbArtikel,
}: {
  combined: HistorischCombinedMonthlyReport | null;
  nbArtikel: HistorischNieuwsbriefArtikelReport | null;
}) {
  const ref4 = useRef<HTMLDivElement>(null);
  const ref5 = useRef<HTMLDivElement>(null);
  const d = useMeetingChartData(combined, nbArtikel, null);

  if (!d.hasNbA && !d.hasNbB) {
    return <p className="text-sm text-slate-600">Niet genoeg data voor nieuwsbriefgrafieken (stap 7).</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {d.hasNbA ? (
        <ChartBlockNewsletter1k
          data4={d.data4}
          chartRef={ref4}
          chartHeight={DASH_H}
          xTick={DASH_TICK}
          title="Grafiek 4 — Nieuwsbrief artikelblok per 1.000 paginaweergaven"
          caption="Geschat aantal inschrijvings-events per duizend schermpaginaweergaven, per maand."
          onDownloadPng={() => void exportChartPng(ref4.current, "stap8-grafiek4-nieuwsbrief-per-1k-pv.png")}
        />
      ) : null}
      {d.hasNbB ? (
        <ChartBlockNewsletterDevice
          data5={d.data5}
          chartRef={ref5}
          chartHeight={DASH_H}
          xTick={DASH_TICK}
          title="Grafiek 5 — Nieuwsbrief per 1.000 paginaweergaven, per apparaat"
          caption="Zelfde maatstaf uitgesplitst naar desktop, mobiel en tablet."
          onDownloadPng={() => void exportChartPng(ref5.current, "stap8-grafiek5-nieuwsbrief-device.png")}
        />
      ) : null}
    </div>
  );
}

export type PeakMonthKey = "jan" | "jun";

/** Grafiek 6 (én maand) voor piek-dashboard. */
export function HistorischDashboardPeakChannelChart({
  topOrigin,
  month,
}: {
  topOrigin: HistorischTopArticlesOriginReport | null;
  month: PeakMonthKey;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const d = useMeetingChartData(null, null, topOrigin);

  if (!d.hasStap6) {
    return <p className="text-sm text-slate-600">Geen kanaaldata voor piekmaanden (stap 6).</p>;
  }

  const isJan = month === "jan";
  const data = isJan ? d.data6Jan : d.data6Jun;
  const title = isJan ? "Januari 2024" : "Juni 2024";
  const file = isJan ? "stap8-grafiek6a-kanaal-januari-2024.png" : "stap8-grafiek6b-kanaal-juni-2024.png";
  const fill = isJan ? "#4f46e5" : "#7c3aed";

  return (
    <ChartBlockChannelBarsSingle
      data={data}
      chartRef={ref}
      barHeight={PEAK_BAR_H}
      monthTitle={`Grafiek 6 — ${title}`}
      fill={fill}
      caption={`Abonneerkliks op de top-25-artikelen naar standaardkanalen (${title}).`}
      onDownloadPng={() => void exportChartPng(ref.current, file)}
    />
  );
}
