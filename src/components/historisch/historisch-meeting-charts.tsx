"use client";

import { useCallback, useRef } from "react";
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

const COMPACT_H = 170;
const TICK = 9;

/** Compacte grafieken + bulk-PNG (stap 8 / tab Data & exports). */
export function HistorischMeetingCharts({
  combined,
  nbArtikel,
  topOrigin,
}: {
  combined: HistorischCombinedMonthlyReport | null;
  nbArtikel: HistorischNieuwsbriefArtikelReport | null;
  topOrigin: HistorischTopArticlesOriginReport | null;
}) {
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const ref3 = useRef<HTMLDivElement>(null);
  const ref4 = useRef<HTMLDivElement>(null);
  const ref5 = useRef<HTMLDivElement>(null);
  const ref6a = useRef<HTMLDivElement>(null);
  const ref6b = useRef<HTMLDivElement>(null);

  const d = useMeetingChartData(combined, nbArtikel, topOrigin);

  const downloadAll = useCallback(() => {
    void (async () => {
      const items: [HTMLElement | null, string][] = [];
      if (d.hasCombined) {
        items.push(
          [ref1.current, "stap8-grafiek1-paywall-maand.png"],
          [ref2.current, "stap8-grafiek2-paywall-ratio.png"],
          [ref3.current, "stap8-grafiek3-index-nieuw-pw.png"]
        );
      }
      if (d.hasNbA) items.push([ref4.current, "stap8-grafiek4-nieuwsbrief-per-1k-pv.png"]);
      if (d.hasNbB) items.push([ref5.current, "stap8-grafiek5-nieuwsbrief-device.png"]);
      if (d.hasStap6) {
        items.push(
          [ref6a.current, "stap8-grafiek6a-kanaal-januari-2024.png"],
          [ref6b.current, "stap8-grafiek6b-kanaal-juni-2024.png"]
        );
      }
      for (const [el, name] of items) {
        if (!el?.querySelector(".recharts-wrapper")) continue;
        await exportChartPng(el, name);
        await new Promise((r) => setTimeout(r, 300));
      }
    })();
  }, [d.hasCombined, d.hasNbA, d.hasNbB, d.hasStap6]);

  if (!d.hasCombined && !d.hasNbA && !d.hasStap6) {
    return (
      <p className="text-sm text-slate-600">
        Niet genoeg data geladen voor grafieken (stap 4, 6 en/of 7).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={downloadAll}
          className="rounded-md border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200"
        >
          Alle grafieken downloaden (PNG)
        </button>
        <span className="text-[10px] text-slate-500">
          Browser kan meerdere downloads vragen; bestandsnamen stap8-grafiek….
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {d.hasCombined ? (
          <>
            <ChartBlockPaywallDual
              data1={d.data1}
              chartRef={ref1}
              chartHeight={COMPACT_H}
              xTick={TICK}
              filename="stap8-grafiek1-paywall-maand.png"
              title="Grafiek 1 — Paywall per maand"
              caption="Paywallweergaven (linkeras) en abonneerkliks (rechteras) per maand."
              onDownloadPng={() => void exportChartPng(ref1.current, "stap8-grafiek1-paywall-maand.png")}
            />
            <ChartBlockPaywallRatio
              data2={d.data2}
              chartRef={ref2}
              chartHeight={COMPACT_H}
              xTick={TICK}
              filename="stap8-grafiek2-paywall-ratio.png"
              title="Grafiek 2 — Paywall-abonneerratio"
              caption="Verhouding abonneerkliks ten opzichte van paywallweergaven per maand."
              onDownloadPng={() => void exportChartPng(ref2.current, "stap8-grafiek2-paywall-ratio.png")}
            />
            <ChartBlockIndex
              data3={d.data3}
              chartRef={ref3}
              chartHeight={COMPACT_H}
              xTick={TICK}
              title="Grafiek 3 — Index nieuwe gebruikers en paywall-weergaven"
              caption="Indices met januari 2024 = 100 voor nieuwe gebruikers en paywallweergaven."
              onDownloadPng={() => void exportChartPng(ref3.current, "stap8-grafiek3-index-nieuw-pw.png")}
            />
          </>
        ) : null}

        {d.hasNbA ? (
          <ChartBlockNewsletter1k
            data4={d.data4}
            chartRef={ref4}
            chartHeight={COMPACT_H}
            xTick={TICK}
            title="Grafiek 4 — Nieuwsbrief artikelblok per 1.000 paginaweergaven"
            caption="Geschat aantal inschrijvings-events per duizend schermpaginaweergaven, per maand."
            onDownloadPng={() => void exportChartPng(ref4.current, "stap8-grafiek4-nieuwsbrief-per-1k-pv.png")}
          />
        ) : null}

        {d.hasNbB ? (
          <ChartBlockNewsletterDevice
            data5={d.data5}
            chartRef={ref5}
            chartHeight={COMPACT_H}
            xTick={TICK}
            title="Grafiek 5 — Nieuwsbrief per 1.000 paginaweergaven, per apparaat"
            caption="Zelfde maatstaf uitgesplitst naar desktop, mobiel en tablet."
            onDownloadPng={() => void exportChartPng(ref5.current, "stap8-grafiek5-nieuwsbrief-device.png")}
          />
        ) : null}

        {d.hasStap6 ? (
          <div className="col-span-2 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-xs font-semibold text-slate-900">
                Grafiek 6 — Herkomst topartikelen: abonneerkliks per kanaal
              </p>
              <div className="flex gap-1 print:hidden">
                <button
                  type="button"
                  onClick={() => void exportChartPng(ref6a.current, "stap8-grafiek6a-kanaal-januari-2024.png")}
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium"
                >
                  PNG jan.
                </button>
                <button
                  type="button"
                  onClick={() => void exportChartPng(ref6b.current, "stap8-grafiek6b-kanaal-juni-2024.png")}
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium"
                >
                  PNG jun.
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Abonneerkliks op de top-25-artikelen (paywall) naar geselecteerde standaardkanalen, januari versus
              juni 2024.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <ChartBlockChannelBarsSingle
                data={d.data6Jan}
                chartRef={ref6a}
                barHeight={168}
                monthTitle="Januari 2024"
                fill="#4f46e5"
                caption="Kanaalverdeling top 25 (jan.)."
                onDownloadPng={() => void exportChartPng(ref6a.current, "stap8-grafiek6a-kanaal-januari-2024.png")}
              />
              <ChartBlockChannelBarsSingle
                data={d.data6Jun}
                chartRef={ref6b}
                barHeight={168}
                monthTitle="Juni 2024"
                fill="#7c3aed"
                caption="Kanaalverdeling top 25 (jun.)."
                onDownloadPng={() => void exportChartPng(ref6b.current, "stap8-grafiek6b-kanaal-juni-2024.png")}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
