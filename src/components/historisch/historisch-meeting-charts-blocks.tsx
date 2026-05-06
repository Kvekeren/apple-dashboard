"use client";

import type { ReactNode, RefObject } from "react";
import { toPng } from "html-to-image";
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
import { useMemo } from "react";

export const NlInt = (n: number) => n.toLocaleString("nl-NL", { maximumFractionDigits: 0 });
export const NRatio = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
export const NSmall = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("nl-NL", { maximumFractionDigits: 4 });

export const CHANNEL_DISPLAY_ORDER: { key: string; label: string }[] = [
  { key: "email", label: "E-mail" },
  { key: "organic search", label: "Organisch zoeken" },
  { key: "direct", label: "Direct" },
  { key: "organic social", label: "Organisch social" },
  { key: "referral", label: "Verwijzing" },
];

/** Thema voor presentaties in F&L-huisstijl (kleur en cards volgens design system). */
export type HistorischChartTheme = "default" | "fnl";

function chartGridStroke(theme: HistorischChartTheme): string {
  return theme === "fnl" ? "#E5ECF2" : "#e2e8f0";
}

/** Presentatie (fnl): blauw + warm accent zodat series duidelijk te onderscheiden zijn. */
const FNL_BLUE = "#004077";
const FNL_ORANGE = "#C25621";
const FNL_GREEN = "#287D52";
const FNL_TEAL = "#0F766E";

export function channelAbonneren(
  summary: HistorischTopArticlesOriginReport["january2024"]["summary"],
  gaKey: string
): number {
  const k = gaKey.toLowerCase();
  const row = summary.find((s) => s.sessionDefaultChannelGroup.toLowerCase() === k);
  return row?.paywall_abonneren ?? 0;
}

export function exportChartPng(node: HTMLElement | null, filename: string): Promise<void> {
  if (!node) return Promise.resolve();
  return toPng(node, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
  }).then((dataUrl) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  });
}

export function ChartShell({
  title,
  caption,
  children,
  onDownloadPng,
  chartRef,
  chartHeight,
  className = "",
  titleClassName = "text-xs font-semibold text-slate-900",
  captionClassName = "mt-1 leading-snug text-slate-600",
  downloadLabel = "PNG",
  chartTheme = "default",
}: {
  title: string;
  caption: string;
  children: ReactNode;
  onDownloadPng: () => void;
  chartRef: RefObject<HTMLDivElement | null>;
  chartHeight: number;
  className?: string;
  titleClassName?: string;
  captionClassName?: string;
  /** Tekst op de downloadknop (bijv. “Download PNG” op presentatiepagina). */
  downloadLabel?: string;
  chartTheme?: HistorischChartTheme;
}) {
  const h = chartHeight;
  const figureBase =
    chartTheme === "fnl"
      ? "break-inside-avoid rounded-lg border border-[rgba(0,30,59,0.12)] bg-white p-4 shadow-[0_1px_2px_rgba(0,30,59,0.04),0_8px_24px_rgba(0,30,59,0.06)]"
      : "break-inside-avoid rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
  const btnBase =
    chartTheme === "fnl"
      ? "shrink-0 rounded border border-[#004077] bg-white px-2.5 py-1 text-xs font-semibold text-[#004077] transition-colors hover:bg-[#DCE7F0] active:translate-y-px print:hidden"
      : "shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 print:hidden";
  return (
    <figure className={`${figureBase} ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <figcaption className={titleClassName}>{title}</figcaption>
        <button type="button" onClick={onDownloadPng} className={btnBase}>
          {downloadLabel}
        </button>
      </div>
      {caption.trim() ? <p className={`${captionClassName} text-sm`}>{caption}</p> : null}
      <div ref={chartRef} className="mt-3 w-full bg-white" style={{ height: h }}>
        {children}
      </div>
    </figure>
  );
}

export function useMeetingChartData(
  combined: HistorischCombinedMonthlyReport | null,
  nbArtikel: HistorischNieuwsbriefArtikelReport | null,
  topOrigin: HistorischTopArticlesOriginReport | null
) {
  const data1 = useMemo(
    () =>
      (combined?.rows ?? []).map((r) => ({
        yearMonth: r.yearMonth,
        paywall_view: r.paywall_view,
        paywall_abonneren: r.paywall_abonneren,
      })),
    [combined]
  );

  const data2 = useMemo(
    () =>
      (combined?.rows ?? []).map((r) => ({
        yearMonth: r.yearMonth,
        paywall_abonneer_ratio: r.paywall_abonneer_ratio,
      })),
    [combined]
  );

  const data3 = useMemo(
    () =>
      (combined?.rows ?? []).map((r) => ({
        yearMonth: r.yearMonth,
        index_newUsers: r.index_newUsers,
        index_paywall_view: r.index_paywall_view,
      })),
    [combined]
  );

  const data4 = useMemo(
    () =>
      (nbArtikel?.tableA ?? []).map((r) => ({
        yearMonth: r.yearMonth,
        nieuwsbrief_per_1000_pageviews: r.nieuwsbrief_per_1000_pageviews,
      })),
    [nbArtikel]
  );

  const data5 = useMemo(() => {
    const byMonth = new Map<
      string,
      { desktop: number | null; mobile: number | null; tablet: number | null }
    >();
    for (const r of nbArtikel?.tableB ?? []) {
      const dev = r.deviceCategory.toLowerCase();
      if (dev !== "desktop" && dev !== "mobile" && dev !== "tablet") continue;
      let slot = byMonth.get(r.yearMonth);
      if (!slot) {
        slot = { desktop: null, mobile: null, tablet: null };
        byMonth.set(r.yearMonth, slot);
      }
      slot[dev as "desktop" | "mobile" | "tablet"] = r.nieuwsbrief_per_1000_pageviews;
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([yearMonth, v]) => ({
        yearMonth,
        desktop: v.desktop,
        mobile: v.mobile,
        tablet: v.tablet,
      }));
  }, [nbArtikel]);

  const data6Jan = useMemo(() => {
    const s = topOrigin?.january2024.summary ?? [];
    return CHANNEL_DISPLAY_ORDER.map(({ key, label }) => ({
      kanaal: label,
      abonneerkliks: channelAbonneren(s, key),
    }));
  }, [topOrigin]);

  const data6Jun = useMemo(() => {
    const s = topOrigin?.june2024.summary ?? [];
    return CHANNEL_DISPLAY_ORDER.map(({ key, label }) => ({
      kanaal: label,
      abonneerkliks: channelAbonneren(s, key),
    }));
  }, [topOrigin]);

  const dataPvPw = useMemo(
    () =>
      (combined?.rows ?? []).map((r) => ({
        yearMonth: r.yearMonth,
        screenPageViews: r.screenPageViews,
        paywall_view: r.paywall_view,
      })),
    [combined]
  );

  const hasCombined = !!combined && combined.rows.length > 0;
  const hasNbA = !!nbArtikel && !nbArtikel.fatalError && nbArtikel.tableA.length > 0;
  const hasNbB = !!nbArtikel && !nbArtikel.fatalError && data5.length > 0;
  const hasStap6 =
    !!topOrigin &&
    !topOrigin.fatalError &&
    !topOrigin.january2024.error &&
    !topOrigin.june2024.error;

  return {
    data1,
    data2,
    data3,
    data4,
    data5,
    data6Jan,
    data6Jun,
    dataPvPw,
    hasCombined,
    hasNbA,
    hasNbB,
    hasStap6,
  };
}

const defX = { angle: -35 as const, textAnchor: "end" as const, height: 52 };

export function ChartBlockPaywallDual({
  data1,
  chartRef,
  chartHeight,
  onDownloadPng,
  title,
  caption,
  xTick = 10,
  filename,
  downloadLabel,
  chartTheme = "default",
}: {
  data1: ReturnType<typeof useMeetingChartData>["data1"];
  chartRef: RefObject<HTMLDivElement | null>;
  chartHeight: number;
  onDownloadPng: () => void;
  title: string;
  caption: string;
  xTick?: number;
  filename: string;
  downloadLabel?: string;
  chartTheme?: HistorischChartTheme;
}) {
  const grid = chartGridStroke(chartTheme);
  const cPay = chartTheme === "fnl" ? FNL_BLUE : "#2563eb";
  const cAbo = chartTheme === "fnl" ? FNL_ORANGE : "#c026d3";
  const titleCls = chartTheme === "fnl" ? "text-sm font-semibold text-[#004077]" : "text-sm font-semibold text-slate-900";
  const capCls = chartTheme === "fnl" ? "mt-1 leading-snug text-[#2B3D52]" : "mt-1 leading-snug text-slate-600";
  return (
    <ChartShell
      title={title}
      caption={caption}
      chartRef={chartRef}
      chartHeight={chartHeight}
      onDownloadPng={onDownloadPng}
      titleClassName={titleCls}
      captionClassName={capCls}
      downloadLabel={downloadLabel}
      chartTheme={chartTheme}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data1} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="yearMonth" tick={{ fontSize: xTick }} {...defX} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: xTick }}
            tickFormatter={(v) => NlInt(Number(v))}
            width={52}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: xTick }}
            tickFormatter={(v) => NlInt(Number(v))}
            width={52}
          />
          <Tooltip
            formatter={(value, name) => [
              NlInt(typeof value === "number" ? value : Number(value)),
              String(name ?? ""),
            ]}
            labelFormatter={(l) => String(l)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="paywall_view"
            name="Paywallweergaven"
            stroke={cPay}
            dot={false}
            strokeWidth={2}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="paywall_abonneren"
            name="Abonneerkliks"
            stroke={cAbo}
            dot={false}
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/** Totaal paginaweergaven vs. paywallweergaven (stap 4 / gecombineerde maandrijen). */
export function ChartBlockScreenPageviewsPaywall({
  dataPvPw,
  chartRef,
  chartHeight,
  onDownloadPng,
  title,
  caption,
  xTick = 10,
  downloadLabel,
  chartTheme = "default",
}: {
  dataPvPw: ReturnType<typeof useMeetingChartData>["dataPvPw"];
  chartRef: RefObject<HTMLDivElement | null>;
  chartHeight: number;
  onDownloadPng: () => void;
  title: string;
  caption: string;
  xTick?: number;
  downloadLabel?: string;
  chartTheme?: HistorischChartTheme;
}) {
  const grid = chartGridStroke(chartTheme);
  const cPv = chartTheme === "fnl" ? FNL_BLUE : "#0f766e";
  const cPw = chartTheme === "fnl" ? FNL_ORANGE : "#1d4ed8";
  const titleCls = chartTheme === "fnl" ? "text-sm font-semibold text-[#004077]" : "text-sm font-semibold text-slate-900";
  const capCls = chartTheme === "fnl" ? "mt-1 leading-snug text-[#2B3D52]" : "mt-1 leading-snug text-slate-600";
  return (
    <ChartShell
      title={title}
      caption={caption}
      chartRef={chartRef}
      chartHeight={chartHeight}
      onDownloadPng={onDownloadPng}
      titleClassName={titleCls}
      captionClassName={capCls}
      downloadLabel={downloadLabel}
      chartTheme={chartTheme}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dataPvPw} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="yearMonth" tick={{ fontSize: xTick }} {...defX} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: xTick }}
            tickFormatter={(v) => NlInt(Number(v))}
            width={56}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: xTick }}
            tickFormatter={(v) => NlInt(Number(v))}
            width={56}
          />
          <Tooltip
            formatter={(value, name) => [
              NlInt(typeof value === "number" ? value : Number(value)),
              String(name ?? ""),
            ]}
            labelFormatter={(l) => String(l)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="screenPageViews"
            name="Paginaweergaven"
            stroke={cPv}
            dot={false}
            strokeWidth={2}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="paywall_view"
            name="Paywallweergaven"
            stroke={cPw}
            dot={false}
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function ChartBlockPaywallRatio({
  data2,
  chartRef,
  chartHeight,
  onDownloadPng,
  title,
  caption,
  xTick = 10,
  filename,
  downloadLabel,
  chartTheme = "default",
}: {
  data2: ReturnType<typeof useMeetingChartData>["data2"];
  chartRef: RefObject<HTMLDivElement | null>;
  chartHeight: number;
  onDownloadPng: () => void;
  title: string;
  caption: string;
  xTick?: number;
  filename: string;
  downloadLabel?: string;
  chartTheme?: HistorischChartTheme;
}) {
  const grid = chartGridStroke(chartTheme);
  const cRatio = chartTheme === "fnl" ? FNL_GREEN : "#0d9488";
  const titleCls = chartTheme === "fnl" ? "text-sm font-semibold text-[#004077]" : "text-sm font-semibold text-slate-900";
  const capCls = chartTheme === "fnl" ? "mt-1 leading-snug text-[#2B3D52]" : "mt-1 leading-snug text-slate-600";

  const ratioChartData = useMemo(() => {
    if (chartTheme === "fnl") {
      return data2.map((d) => ({
        yearMonth: d.yearMonth,
        paywall_abonneer_ratio:
          d.paywall_abonneer_ratio == null ? null : d.paywall_abonneer_ratio * 100,
      }));
    }
    return data2;
  }, [data2, chartTheme]);

  const lineName = chartTheme === "fnl" ? "Abonneerratio (%)" : "Abonneerratio";

  return (
    <ChartShell
      title={title}
      caption={caption}
      chartRef={chartRef}
      chartHeight={chartHeight}
      onDownloadPng={onDownloadPng}
      titleClassName={titleCls}
      captionClassName={capCls}
      downloadLabel={downloadLabel}
      chartTheme={chartTheme}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={ratioChartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="yearMonth" tick={{ fontSize: xTick }} {...defX} />
          <YAxis
            tick={{ fontSize: xTick }}
            width={52}
            tickFormatter={(v) =>
              chartTheme === "fnl"
                ? `${Number(v).toLocaleString("nl-NL", { maximumFractionDigits: 2 })}%`
                : NRatio(Number(v))
            }
          />
          <Tooltip
            formatter={(value) => {
              const n = typeof value === "number" ? value : Number(value);
              if (chartTheme === "fnl") {
                return [
                  `${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
                  lineName,
                ];
              }
              return [NRatio(n), lineName];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="paywall_abonneer_ratio"
            name={lineName}
            stroke={cRatio}
            dot={false}
            strokeWidth={2}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function ChartBlockIndex({
  data3,
  chartRef,
  chartHeight,
  onDownloadPng,
  title,
  caption,
  xTick = 10,
  downloadLabel,
  chartTheme = "default",
  legendLine1Name,
  legendLine2Name,
}: {
  data3: ReturnType<typeof useMeetingChartData>["data3"];
  chartRef: RefObject<HTMLDivElement | null>;
  chartHeight: number;
  onDownloadPng: () => void;
  title: string;
  caption: string;
  xTick?: number;
  downloadLabel?: string;
  chartTheme?: HistorischChartTheme;
  /** Default: "Index nieuwe gebruikers" */
  legendLine1Name?: string;
  /** Default: "Index paywallweergaven" */
  legendLine2Name?: string;
}) {
  const grid = chartGridStroke(chartTheme);
  const c1 = chartTheme === "fnl" ? FNL_BLUE : "#ea580c";
  const c2 = chartTheme === "fnl" ? FNL_ORANGE : "#4338ca";
  const titleCls = chartTheme === "fnl" ? "text-sm font-semibold text-[#004077]" : "text-sm font-semibold text-slate-900";
  const capCls = chartTheme === "fnl" ? "mt-1 leading-snug text-[#2B3D52]" : "mt-1 leading-snug text-slate-600";
  const name1 = legendLine1Name ?? "Index nieuwe gebruikers";
  const name2 = legendLine2Name ?? "Index paywallweergaven";
  return (
    <ChartShell
      title={title}
      caption={caption}
      chartRef={chartRef}
      chartHeight={chartHeight}
      onDownloadPng={onDownloadPng}
      titleClassName={titleCls}
      captionClassName={capCls}
      downloadLabel={downloadLabel}
      chartTheme={chartTheme}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data3} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="yearMonth" tick={{ fontSize: xTick }} {...defX} />
          <YAxis tick={{ fontSize: xTick }} width={48} />
          <Tooltip
            formatter={(value) => [NRatio(typeof value === "number" ? value : Number(value)), ""]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="index_newUsers"
            name={name1}
            stroke={c1}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="index_paywall_view"
            name={name2}
            stroke={c2}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function ChartBlockNewsletter1k({
  data4,
  chartRef,
  chartHeight,
  onDownloadPng,
  title,
  caption,
  xTick = 10,
  downloadLabel,
  chartTheme = "default",
}: {
  data4: ReturnType<typeof useMeetingChartData>["data4"];
  chartRef: RefObject<HTMLDivElement | null>;
  chartHeight: number;
  onDownloadPng: () => void;
  title: string;
  caption: string;
  xTick?: number;
  downloadLabel?: string;
  chartTheme?: HistorischChartTheme;
}) {
  const grid = chartGridStroke(chartTheme);
  const cNb = chartTheme === "fnl" ? FNL_GREEN : "#15803d";
  const titleCls = chartTheme === "fnl" ? "text-sm font-semibold text-[#004077]" : "text-sm font-semibold text-slate-900";
  const capCls = chartTheme === "fnl" ? "mt-1 leading-snug text-[#2B3D52]" : "mt-1 leading-snug text-slate-600";
  return (
    <ChartShell
      title={title}
      caption={caption}
      chartRef={chartRef}
      chartHeight={chartHeight}
      onDownloadPng={onDownloadPng}
      titleClassName={titleCls}
      captionClassName={capCls}
      downloadLabel={downloadLabel}
      chartTheme={chartTheme}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data4} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="yearMonth" tick={{ fontSize: xTick }} {...defX} />
          <YAxis tick={{ fontSize: xTick }} width={44} />
          <Tooltip
            formatter={(value) => [
              NSmall(typeof value === "number" ? value : Number(value)),
              "Per 1.000 pw",
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="nieuwsbrief_per_1000_pageviews"
            name="Per 1.000 paginaweergaven"
            stroke={cNb}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function ChartBlockNewsletterDevice({
  data5,
  chartRef,
  chartHeight,
  onDownloadPng,
  title,
  caption,
  xTick = 10,
  downloadLabel,
  chartTheme = "default",
}: {
  data5: ReturnType<typeof useMeetingChartData>["data5"];
  chartRef: RefObject<HTMLDivElement | null>;
  chartHeight: number;
  onDownloadPng: () => void;
  title: string;
  caption: string;
  xTick?: number;
  downloadLabel?: string;
  chartTheme?: HistorischChartTheme;
}) {
  const grid = chartGridStroke(chartTheme);
  const cD = chartTheme === "fnl" ? FNL_BLUE : "#1e40af";
  const cM = chartTheme === "fnl" ? FNL_ORANGE : "#b45309";
  const cT = chartTheme === "fnl" ? FNL_TEAL : "#6b21a8";
  const titleCls = chartTheme === "fnl" ? "text-sm font-semibold text-[#004077]" : "text-sm font-semibold text-slate-900";
  const capCls = chartTheme === "fnl" ? "mt-1 leading-snug text-[#2B3D52]" : "mt-1 leading-snug text-slate-600";
  return (
    <ChartShell
      title={title}
      caption={caption}
      chartRef={chartRef}
      chartHeight={chartHeight}
      onDownloadPng={onDownloadPng}
      titleClassName={titleCls}
      captionClassName={capCls}
      downloadLabel={downloadLabel}
      chartTheme={chartTheme}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data5} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="yearMonth" tick={{ fontSize: xTick }} {...defX} />
          <YAxis tick={{ fontSize: xTick }} width={44} />
          <Tooltip
            formatter={(value) => [NSmall(typeof value === "number" ? value : Number(value)), ""]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="desktop"
            name="Desktop"
            stroke={cD}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="mobile"
            name="Mobiel"
            stroke={cM}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="tablet"
            name="Tablet"
            stroke={cT}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

type ChannelBarRow = { kanaal: string; abonneerkliks: number };

export function ChartBlockChannelBarsSingle({
  data,
  chartRef,
  barHeight,
  monthTitle,
  fill,
  onDownloadPng,
  caption,
  downloadLabel = "PNG",
  chartTheme = "default",
}: {
  data: ChannelBarRow[];
  chartRef: RefObject<HTMLDivElement | null>;
  barHeight: number;
  monthTitle: string;
  fill: string;
  onDownloadPng: () => void;
  caption: string;
  downloadLabel?: string;
  chartTheme?: HistorischChartTheme;
}) {
  const wrap =
    chartTheme === "fnl"
      ? "rounded-lg border border-[rgba(0,30,59,0.12)] bg-white p-3 shadow-[0_1px_2px_rgba(0,30,59,0.04),0_8px_24px_rgba(0,30,59,0.06)]"
      : "rounded-xl border border-slate-200 bg-white p-3";
  const titleCls = chartTheme === "fnl" ? "text-sm font-semibold text-[#004077]" : "text-sm font-semibold text-slate-900";
  const capCls = chartTheme === "fnl" ? "text-sm text-[#2B3D52]" : "text-sm text-slate-600";
  const subCls = chartTheme === "fnl" ? "text-center text-xs font-medium text-[#2B3D52]" : "text-center text-xs font-medium text-slate-700";
  const btnCls =
    chartTheme === "fnl"
      ? "rounded border border-[#004077] bg-white px-2 py-1 text-xs font-semibold text-[#004077] hover:bg-[#DCE7F0] active:translate-y-px"
      : "rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700";
  const grid = chartGridStroke(chartTheme);
  return (
    <div ref={chartRef} className={wrap}>
      <div className="flex justify-between gap-2 print:hidden">
        <p className={titleCls}>{monthTitle}</p>
        <button type="button" onClick={onDownloadPng} className={btnCls}>
          {downloadLabel}
        </button>
      </div>
      <p className={`mt-1 ${capCls}`}>{caption}</p>
      <p className={`mb-2 ${subCls}`}>{monthTitle}</p>
      <ResponsiveContainer width="100%" height={barHeight}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} />
          <XAxis dataKey="kanaal" tick={{ fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={52} />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip
            formatter={(value) => [
              NlInt(typeof value === "number" ? value : Number(value)),
              "Abonneerkliks",
            ]}
          />
          <Bar dataKey="abonneerkliks" name="Abonneerkliks" fill={fill} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
