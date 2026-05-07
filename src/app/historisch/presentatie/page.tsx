"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartBlockChannelBarsSingle,
  ChartBlockIndex,
  ChartBlockNewsletter1k,
  ChartBlockPaywallDual,
  ChartBlockPaywallRatio,
  ChartBlockScreenPageviewsPaywall,
  NlInt,
  channelAbonneren,
  exportChartPng,
  useMeetingChartData,
} from "@/components/historisch/historisch-meeting-charts-blocks";
import type { HistorischCombinedMonthRow } from "@/lib/historisch-combined-shared";
import { buildHistorischCombinedMonthly } from "@/lib/historisch-combined-shared";
import type { HistorischFunnelMonthlyReport } from "@/lib/historisch-funnel-shared";
import type { HistorischNieuwsbriefArtikelReport } from "@/lib/historisch-nieuwsbrief-artikel-shared";
import { formatPer1k, formatPct, formatRatioAsPct } from "@/lib/historisch-page-format";
import type { HistorischTopArticlesOriginReport } from "@/lib/historisch-top-articles-origin-shared";
import type {
  HistorischTopArticlePivotRow,
  HistorischTopArticlesReport,
} from "@/lib/historisch-top-articles-shared";
import type { HistorischTrafficMonthlyReport } from "@/lib/historisch-traffic-shared";

const PRES_CONTAINER = "mx-auto w-full max-w-[1200px] px-[clamp(20px,4vw,48px)]";
const CHART_H = 360;
const CHART_X = 11;
const BAR_H = 280;
const DL = "Download PNG";
/** Publieke site voor klikbare pagePath-links in tabellen. */
const HN_PUBLIC_ORIGIN = "https://www.historischnieuwsblad.nl";
/** F&L-palette voor slide 5 (één kleur per jaarbalk). */
const ABO_JAAR_BAR_FILLS: Record<string, string> = {
  "2024": "#004077",
  "2025": "#C25621",
  "2026": "#287D52",
};

type NbDeviceKey = "desktop" | "mobile" | "tablet";

const NB_DEVICE_ORDER: { key: NbDeviceKey; label: string }[] = [
  { key: "desktop", label: "Desktop" },
  { key: "mobile", label: "Mobiel" },
];

const NL_MONTH_SHORT = ["jan.", "feb.", "mrt.", "apr.", "mei", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."] as const;

function normalizeNbDeviceCategory(category: string): NbDeviceKey | null {
  const d = category.trim().toLowerCase();
  if (d === "desktop") return "desktop";
  if (d === "mobile") return "mobile";
  if (d === "tablet") return "tablet";
  return null;
}

function yearMonthToNlShort(ym: string): string {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!y || m < 1 || m > 12) return ym;
  return `${NL_MONTH_SHORT[m - 1]} ${y}`;
}

function meanNbPer1kByDeviceYear(
  tableB: HistorischNieuwsbriefArtikelReport["tableB"],
  device: NbDeviceKey,
  yearPrefix: string
): number | null {
  const vals = tableB
    .filter((r) => r.yearMonth.startsWith(yearPrefix) && normalizeNbDeviceCategory(r.deviceCategory) === device)
    .map((r) => r.nieuwsbrief_per_1000_pageviews)
    .filter((x): x is number => x != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function nbPer1kDeviceMonth(
  tableB: HistorischNieuwsbriefArtikelReport["tableB"],
  yearMonth: string,
  device: NbDeviceKey
): number | null {
  const row = tableB.find(
    (r) => r.yearMonth === yearMonth && normalizeNbDeviceCategory(r.deviceCategory) === device
  );
  return row?.nieuwsbrief_per_1000_pageviews ?? null;
}

/** Eindmeetpunt: voorkeur apr. 2026; anders laatste beschikbare 2026-maand in tabel B. */
function pickNbCompareEndMonth2026(tableB: HistorischNieuwsbriefArtikelReport["tableB"]): {
  yearMonth: string | null;
  labelShort: string;
} {
  if (tableB.some((r) => r.yearMonth === "2026-04")) {
    return { yearMonth: "2026-04", labelShort: "apr. 2026" };
  }
  const y2026 = [...new Set(tableB.map((r) => r.yearMonth).filter((m) => m.startsWith("2026-")))].sort();
  const last = y2026[y2026.length - 1] ?? null;
  if (last) {
    return { yearMonth: last, labelShort: yearMonthToNlShort(last) };
  }
  return { yearMonth: null, labelShort: "—" };
}

function formatPer1k2(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPctChangeJanEnd(jan: number | null, end: number | null): string {
  if (jan == null || end == null || jan === 0) return "—";
  const p = Math.round(((end - jan) / jan) * 100);
  if (p === 0) return "0%";
  return `${p < 0 ? "−" : "+"}${Math.abs(p)}%`;
}

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

/** Gemiddeld aantal paywall_abonneren-events per kalendermaand binnen het jaarprefix. */
function avgPaywallAbonnerenPerMonth(rows: HistorischCombinedMonthRow[], yearPrefix: string): number | null {
  const subset = rows.filter((r) => r.yearMonth.startsWith(yearPrefix));
  if (!subset.length) return null;
  const sum = subset.reduce((s, r) => s + r.paywall_abonneren, 0);
  return sum / subset.length;
}

function avgScreenPageViewsPerMonth(rows: HistorischCombinedMonthRow[], yearPrefix: string): number | null {
  const subset = rows.filter((r) => r.yearMonth.startsWith(yearPrefix));
  if (!subset.length) return null;
  return subset.reduce((s, r) => s + r.screenPageViews, 0) / subset.length;
}

/** Paywall/view-deel als percentage met één decimaal (o.a. samenvatting). */
function formatSharePctCompact(x: number | null): string {
  if (x == null) return "—";
  return (x * 100).toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

/** Gemiddeld aantal nieuwe gebruikers per kalendermaand binnen het jaarprefix. */
function avgNewUsersPerMonth(rows: HistorischCombinedMonthRow[], yearPrefix: string): number | null {
  const subset = rows.filter((r) => r.yearMonth.startsWith(yearPrefix));
  if (!subset.length) return null;
  return subset.reduce((s, r) => s + r.newUsers, 0) / subset.length;
}

/** Afgerond op duizendtallen met k-suffix (bijv. 65k). */
function formatAvgNewUsersK(avg: number | null): string {
  if (avg == null) return "—";
  return `${Math.round(avg / 1000).toLocaleString("nl-NL")}k`;
}

/** Gemiddelde pageviews per maand afgerond op duizendtallen (bijv. 174k). */
function formatAvgPageviewsK(avg: number | null): string {
  if (avg == null) return "—";
  return `${Math.round(avg / 1000).toLocaleString("nl-NL")}k`;
}

function newUsersVolumeBullet(a24: number | null, a25: number | null, a26: number | null): string {
  const chain = `${formatAvgNewUsersK(a24)} → ${formatAvgNewUsersK(a25)} → ${formatAvgNewUsersK(a26)} per maand`;
  if (a24 != null && a26 != null && a26 > a24 * 1.02) {
    return `Het aantal nieuwe gebruikers stijgt licht: ${chain}.`;
  }
  if (a24 != null && a26 != null && a26 < a24 * 0.98) {
    return `Het aantal nieuwe gebruikers daalt gemiddeld: ${chain}.`;
  }
  return `Het gemiddelde aantal nieuwe gebruikers per maand: ${chain}.`;
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

/** Gemiddeld aantal nieuwsbrief_inschrijving_artikelen-events per kalendermaand (stap 7 tabel A). */
function avgNieuwsbriefEventsPerMonth(table: HistorischNieuwsbriefArtikelReport["tableA"], yearPrefix: string): number | null {
  const subset = table.filter((r) => r.yearMonth.startsWith(yearPrefix));
  if (!subset.length) return null;
  const sum = subset.reduce((s, r) => s + r.nieuwsbrief_inschrijving_artikelen, 0);
  return sum / subset.length;
}

function formatEventAvgPerMonth(avg: number | null): string {
  if (avg == null) return "—";
  return NlInt(Math.round(avg));
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

function publicArticleUrlFromPagePath(path: string): string | null {
  const p = path.trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const pathOnly = p.startsWith("/") ? p : `/${p}`;
  return `${HN_PUBLIC_ORIGIN}${pathOnly}`;
}

/** Waarde boven elke jaarbalk (Recharts LabelList content). */
function ShopKlikJaarBarLabelContent(props: unknown) {
  if (!props || typeof props !== "object") return <g />;
  const p = props as {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    value?: unknown;
  };
  const nx = Number(p.x);
  const ny = Number(p.y);
  const nw = Number(p.width);
  const value = p.value;
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nw) || value == null || Array.isArray(value))
    return <g />;
  const n = Math.round(Number(value));
  return (
    <text
      x={nx + nw / 2}
      y={ny - 6}
      textAnchor="middle"
      fill="#001e3b"
      fontSize={12}
      fontWeight={600}
      className="tabular-nums"
    >
      {NlInt(n)}
    </text>
  );
}

function InsightList({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc space-y-1.5 text-base leading-[1.6] text-[var(--fnl-ink-2)]">
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
        <div key={x.label} className="fnl-kpi">
          <p className="fnl-meta">{x.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--fnl-blue-deep)]">{x.value}</p>
        </div>
      ))}
    </div>
  );
}

function TopFiveMiniTable({ rows }: { rows: HistorischTopArticlePivotRow[] }) {
  const five = rows.slice(0, 5);
  if (!five.length) {
    return <p className="text-sm text-[var(--fnl-ink-3)]">Data niet beschikbaar.</p>;
  }
  return (
    <div className="fnl-table-wrap overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--fnl-ink-12)]">
            <th className="px-3 py-2">pagePath</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">abo</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">view</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">abo/view (%)</th>
          </tr>
        </thead>
        <tbody>
          {five.map((r) => {
            const href = publicArticleUrlFromPagePath(r.pagePath);
            const label = shortenPagePath(r.pagePath, 40);
            return (
              <tr key={r.pagePath} className="border-b border-[rgba(0,30,59,0.06)] last:border-0">
                <td className="fnl-mono max-w-[14rem] px-3 py-2 text-xs" title={r.pagePath}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="fnl-link font-medium underline-offset-2 hover:underline"
                    >
                      {label}
                    </a>
                  ) : (
                    label
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {r.paywall_abonneren.toLocaleString("nl-NL")}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {r.paywall_view.toLocaleString("nl-NL")}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {formatRatioAsPct(r.paywall_abonneer_ratio)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

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
  const refNieuwVerkeer = useRef<HTMLDivElement>(null);
  const refPwAbo = useRef<HTMLDivElement>(null);
  const refRatio = useRef<HTMLDivElement>(null);
  const refAboJaar = useRef<HTMLDivElement>(null);
  const refNb1k = useRef<HTMLDivElement>(null);
  const refNbDev = useRef<HTMLDivElement>(null);
  const refChJan = useRef<HTMLDivElement>(null);
  const refChJun = useRef<HTMLDivElement>(null);

  const rows = combined.rows;
  const avgNu2024 = avgNewUsersPerMonth(rows, "2024-");
  const avgNu2025 = avgNewUsersPerMonth(rows, "2025-");
  const avgNu2026 = avgNewUsersPerMonth(rows, "2026-");
  const share2024 = meanMonthlyPaywallShare(rows, "2024-");
  const share2025 = meanMonthlyPaywallShare(rows, "2025-");
  const share2026 = meanMonthlyPaywallShare(rows, "2026-");

  const avgAbo2024 = avgPaywallAbonnerenPerMonth(rows, "2024-");
  const avgAbo2025 = avgPaywallAbonnerenPerMonth(rows, "2025-");
  const avgAbo2026 = avgPaywallAbonnerenPerMonth(rows, "2026-");

  const ratioAvg2024 = meanPaywallAbonneerRatio(rows, "2024-");
  const ratioAvg2025 = meanPaywallAbonneerRatio(rows, "2025-");
  const ratioAvg2026 = meanPaywallAbonneerRatio(rows, "2026-");

  const tableA = nbArtikel?.tableA ?? [];
  const nb2024 = meanFromTableA(tableA, "2024-", "nieuwsbrief_per_1000_pageviews");
  const nb2025 = meanFromTableA(tableA, "2025-", "nieuwsbrief_per_1000_pageviews");
  const nb2026 = meanFromTableA(tableA, "2026-", "nieuwsbrief_per_1000_pageviews");
  const nbEventsAvg2024 = avgNieuwsbriefEventsPerMonth(tableA, "2024-");
  const nbEventsAvg2025 = avgNieuwsbriefEventsPerMonth(tableA, "2025-");
  const nbEventsAvg2026 = avgNieuwsbriefEventsPerMonth(tableA, "2026-");

  const nbDevicePres = useMemo(() => {
    const tableB = nbArtikel?.tableB ?? [];
    if (!tableB.length) return null;

    const barRows = NB_DEVICE_ORDER.map(({ key, label }) => ({
      device: label,
      v2024: meanNbPer1kByDeviceYear(tableB, key, "2024-"),
      v2025: meanNbPer1kByDeviceYear(tableB, key, "2025-"),
      v2026: meanNbPer1kByDeviceYear(tableB, key, "2026-"),
    }));

    const hasBar = barRows.some((r) => r.v2024 != null || r.v2025 != null || r.v2026 != null);

    const end = pickNbCompareEndMonth2026(tableB);
    const ymJan = "2024-01";
    const janM = nbPer1kDeviceMonth(tableB, ymJan, "mobile");
    const janD = nbPer1kDeviceMonth(tableB, ymJan, "desktop");
    const endYm = end.yearMonth;
    const endM = endYm ? nbPer1kDeviceMonth(tableB, endYm, "mobile") : null;
    const endD = endYm ? nbPer1kDeviceMonth(tableB, endYm, "desktop") : null;

    const bullets: string[] = [];
    if (endYm && janM != null && endM != null) {
      bullets.push(
        `Mobiel zat al lager én daalde sterk: ${formatPer1k2(janM)} → ${formatPer1k2(endM)} per 1.000 pageviews (${formatPctChangeJanEnd(janM, endM)}).`,
      );
    }
    if (endYm && janD != null && endD != null) {
      bullets.push(
        `Desktop daalde ook, maar minder hard: ${formatPer1k2(janD)} → ${formatPer1k2(endD)} (${formatPctChangeJanEnd(janD, endD)}).`,
      );
    }
    if (!endYm && bullets.length === 0) {
      bullets.push(
        "Er is nog geen 2026-maand in tabel B om jan. 2024 eenduidig mee te vergelijken; zie de jaargemiddelden in de grafiek.",
      );
    }
    bullets.push(
      "Mobiel is de grootste optimalisatiekans: veel verkeer, maar het zwakste nieuwsbriefresultaat.",
    );

    const deltaRows = [
      { device: "Desktop" as const, jan: janD, end: endD },
      { device: "Mobiel" as const, jan: janM, end: endM },
    ];

    const endColLabel =
      end.yearMonth == null
        ? "—"
        : end.labelShort.charAt(0).toUpperCase() + end.labelShort.slice(1);

    return {
      barRows,
      hasBar,
      end,
      endColLabel,
      bullets,
      deltaRows,
    };
  }, [nbArtikel?.tableB]);

  const janSum = topOrigin?.january2024.summary ?? [];
  const junSum = topOrigin?.june2024.summary ?? [];

  const aboJaarBarData = useMemo(() => {
    const pts: { jaar: string; gem: number; fill: string }[] = [];
    for (const [label, prefix] of [
      ["2024", "2024-"],
      ["2025", "2025-"],
      ["2026", "2026-"],
    ] as const) {
      const v = avgPaywallAbonnerenPerMonth(rows, prefix);
      if (v != null) {
        pts.push({ jaar: label, gem: v, fill: ABO_JAAR_BAR_FILLS[label] ?? "#004077" });
      }
    }
    return pts;
  }, [rows]);

  const conclusieItems = useMemo(() => {
    const pv24 = avgScreenPageViewsPerMonth(rows, "2024-");
    const pv25 = avgScreenPageViewsPerMonth(rows, "2025-");
    const pv26 = avgScreenPageViewsPerMonth(rows, "2026-");
    const pvChain =
      pv24 != null && pv25 != null && pv26 != null
        ? `${formatAvgPageviewsK(pv24)} → ${formatAvgPageviewsK(pv25)} → ${formatAvgPageviewsK(pv26)}`
        : "— → — → —";
    const nuChain = `${formatAvgNewUsersK(avgNu2024)} → ${formatAvgNewUsersK(avgNu2025)} → ${formatAvgNewUsersK(avgNu2026)}`;
    const shareChain = `${formatSharePctCompact(share2024)} → ${formatSharePctCompact(share2025)} → ${formatSharePctCompact(share2026)}`;
    const ratioChain = `${formatRatioAsPct(ratioAvg2024, 2)} → ${formatRatioAsPct(ratioAvg2025, 2)} → ${formatRatioAsPct(ratioAvg2026, 2)}`;
    const aboChain = `${formatEventAvgPerMonth(avgAbo2024)} → ${formatEventAvgPerMonth(avgAbo2025)} → ${formatEventAvgPerMonth(avgAbo2026)}`;

    const janEmail = channelAboSharePct(janSum, "email");
    const junEmail = channelAboSharePct(junSum, "email");
    const janOrg = channelAboSharePct(janSum, "organic search");
    const junOrg = channelAboSharePct(junSum, "organic search");

    const nbDropPct =
      nbEventsAvg2024 != null && nbEventsAvg2026 != null && nbEventsAvg2024 > 0
        ? Math.round((1 - nbEventsAvg2026 / nbEventsAvg2024) * 100)
        : null;
    const evChain = `${formatEventAvgPerMonth(nbEventsAvg2024)} → ${formatEventAvgPerMonth(nbEventsAvg2025)} → ${formatEventAvgPerMonth(nbEventsAvg2026)}`;
    const per1kChain = `${formatPer1k2(nb2024)} → ${formatPer1k2(nb2025)} → ${formatPer1k2(nb2026)}`;

    let mobileClause = "Mobiel daalt het hardst — zie ook slide 9.";
    const mobRow = nbDevicePres?.deltaRows.find((r) => r.device === "Mobiel");
    if (mobRow && nbDevicePres?.end.yearMonth) {
      const d = formatPctChangeJanEnd(mobRow.jan, mobRow.end);
      if (d !== "—") mobileClause = `Mobiel daalt het hardst (${d} sinds januari 2024).`;
    }

    const emailOrganicBody =
      janEmail != null && junEmail != null && janOrg != null && junOrg != null
        ? `E-mail leverde ${Math.round(janEmail)}% (januari) en ${Math.round(junEmail)}% (juni) van de abonneerkliks op de top-25 artikelen; organisch zoeken ${Math.round(janOrg)}% (januari) en ${Math.round(junOrg)}% (juni).`
        : "E-mail en organisch zoeken op de top-25 artikelen: zie kanaalcijfers op slide 7 (stap 6).";

    const nbTitlePct = nbDropPct != null ? `~${nbDropPct}%` : "~70%";

    return [
      {
        title: "1. Verkeer is niet het probleem.",
        body: `Pageviews per maand groeien door over drie jaren (${pvChain}); ook nieuwe gebruikers stijgen licht (${nuChain} per maand).`,
      },
      {
        title: "2. Paywall-vertoningen zijn bijna gehalveerd.",
        body: `Het aandeel pageviews dat de paywall bereikt: ${shareChain}. Dit valt het meest op in de data, en de daling versnelt.`,
      },
      {
        title: "3. De paywall zelf converteert juist beter.",
        body: `De abo-ratio (klik/view) steeg over drie jaren door: ${ratioChain}. Abonneerkliks blijven stabiel (${aboChain} per maand).`,
      },
      {
        title: "4. De pieken in 2024 kwamen vooral vanuit nieuwsbrieven.",
        body: emailOrganicBody,
      },
      {
        title: `5. Nieuwsbriefblok-performance zakte ${nbTitlePct} in twee jaar.`,
        body: `Maandgemiddelde inschrijvingen: ${evChain}. Per 1.000 pageviews: ${per1kChain}. ${mobileClause} Onderzoeken wat de oorzaak is.`,
      },
    ];
  }, [
    rows,
    share2024,
    share2025,
    share2026,
    avgNu2024,
    avgNu2025,
    avgNu2026,
    ratioAvg2024,
    ratioAvg2025,
    ratioAvg2026,
    avgAbo2024,
    avgAbo2025,
    avgAbo2026,
    janSum,
    junSum,
    nbEventsAvg2024,
    nbEventsAvg2025,
    nbEventsAvg2026,
    nb2024,
    nb2025,
    nb2026,
    nbDevicePres,
  ]);

  return (
    <>
      <header className={`fnl-header print:break-inside-avoid ${PRES_CONTAINER} py-8 print:shadow-none`}>
        <div className="fnl-header-inner max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-6">
            <img
              src="/fnl/logo-horizontal.svg"
              alt="F&L Media"
              width={220}
              height={48}
              className="h-10 w-auto"
            />
            <img
              src="/hn/logo.svg"
              alt="Historisch Nieuwsblad"
              width={221}
              height={72}
              className="h-10 w-auto"
            />
          </div>
          <p className="fnl-meta">Presentatie · Historisch Nieuwsblad</p>
          <h1 className="fnl-display mt-2 text-balance">
            Analyse online/digitale instroom Historisch Nieuwsblad
          </h1>
        </div>
      </header>

      <main className={`${PRES_CONTAINER} space-y-16 py-12 print:space-y-10 print:py-6`}>
        {loading && <p className="text-[var(--fnl-ink-3)]">Bezig met laden…</p>}
        {err && !loading && (
          <div className="fnl-callout border-[rgba(200,54,43,0.35)] bg-[rgba(240,244,248,0.95)]">
            <p className="text-sm text-[var(--fnl-ink-2)]">
              {err} — controleer het dashboard op{" "}
              <Link href="/historisch" className="fnl-link font-semibold">
                /historisch
              </Link>
              .
            </p>
          </div>
        )}

        <section
          id="pres-kader"
          className="scroll-mt-40 space-y-4 break-inside-avoid p-6 fnl-slide print:break-inside-avoid"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="fnl-slide-title">Introductie</h2>
          </div>
          <div className="max-w-prose text-pretty leading-relaxed text-[var(--fnl-ink-2)]">
            <p>
              <span className="font-bold text-[var(--fnl-ink)]">Achtergrond.</span> De instroom van de online en
              digitale abonnementen (HN Online en HN Digitaal) blijft sinds 2025 achter op het budget en daalt verder
              in 2026. We willen weten of dat komt door minder siteverkeer, door minder verkeer dat de paywall
              bereikt, door een slechtere conversie van paywall naar abonneren, of door iets anders. Ook willen we
              weten hoe het kan dat mensen zich minder snel inschrijven voor de nieuwsbrief.
            </p>
          </div>
        </section>

        <section
          id="pres-pv-pw"
          className="scroll-mt-40 space-y-4 break-inside-avoid p-6 fnl-slide"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="fnl-slide-title">1. Siteverkeer versus paywall-views</h2>
            <span className="fnl-meta inline-flex items-center rounded-full border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] px-2.5 py-0.5 tabular-nums">1 / 10</span>
          </div>
          <p className="fnl-lede">Zijn paywall-views even sterk gedaald als totale pageviews?</p>
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
                  chartTheme="fnl"
                />
              </div>
              <KpiCards
                items={[
                  { label: "Gem. aandeel paywall/view 2024", value: formatSharePct(share2024) },
                  { label: "Gem. aandeel paywall/view 2025", value: formatSharePct(share2025) },
                  { label: "Gem. aandeel paywall/view 2026", value: formatSharePct(share2026) },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-[var(--fnl-ink-3)]">Data niet beschikbaar (stap 2 en 3 nodig).</p>
          )}
          <p className="font-semibold text-[var(--fnl-ink)]">
            Totale pageviews stijgen juist licht (+10,5% over twee jaar), maar het aantal bezoekers dat de paywall
            tegenkomt is bijna gehalveerd.
          </p>
          <InsightList items={["Mogelijk minder paywall-blokken in artikelen"]} />
        </section>

        <section
          id="pres-nieuw-verkeer"
          className="scroll-mt-40 space-y-4 break-inside-avoid p-6 fnl-slide"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="fnl-slide-title">2. Nieuw verkeer</h2>
            <span className="fnl-meta inline-flex items-center rounded-full border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] px-2.5 py-0.5 tabular-nums">
              2 / 10
            </span>
          </div>
          <p className="fnl-lede">Blijft de instroom achter doordat er minder nieuwe gebruikers zijn?</p>
          {chart.hasCombined ? (
            <>
              <KpiCards
                items={[
                  { label: "Gemiddelde nieuwe gebruikers per maand in 2024", value: formatAvgNewUsersK(avgNu2024) },
                  { label: "Gemiddelde nieuwe gebruikers per maand in 2025", value: formatAvgNewUsersK(avgNu2025) },
                  { label: "Gemiddelde nieuwe gebruikers per maand in 2026", value: formatAvgNewUsersK(avgNu2026) },
                ]}
              />
              <div className="aspect-video w-full min-h-[320px] min-w-0 max-h-[420px]">
                <ChartBlockIndex
                  data3={chart.data3}
                  chartRef={refNieuwVerkeer}
                  chartHeight={CHART_H}
                  xTick={CHART_X}
                  title="Index: nieuwe gebruikers en paywall-views"
                  caption="Nieuwe gebruikers en paywall-views geïndexeerd; januari 2024 = 100 (combined, stap 4)."
                  onDownloadPng={() =>
                    void exportChartPng(refNieuwVerkeer.current, "presentatie-nieuw-verkeer-index.png")
                  }
                  downloadLabel={DL}
                  chartTheme="fnl"
                  legendLine1Name="Nieuwe gebruikers"
                  legendLine2Name="Paywall-views"
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--fnl-ink-3)]">Data niet beschikbaar (stap 2 en 3 nodig).</p>
          )}
          <p className="font-semibold text-[var(--fnl-ink)]">
            Nieuwe gebruikers blijven gemiddeld op peil, maar leveren minder vaak een paywall-view op.
          </p>
          <InsightList
            items={[
              newUsersVolumeBullet(avgNu2024, avgNu2025, avgNu2026),
              "Paywall-views dalen in dezelfde periode juist.",
            ]}
          />
        </section>

        <section
          id="pres-pw-abo"
          className="scroll-mt-40 space-y-4 break-inside-avoid p-6 fnl-slide"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="fnl-slide-title">3. Paywall-views en abonneerkliks</h2>
            <span className="fnl-meta inline-flex items-center rounded-full border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] px-2.5 py-0.5 tabular-nums">3 / 10</span>
          </div>
          <p className="fnl-lede">
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
                chartTheme="fnl"
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--fnl-ink-3)]">Data niet beschikbaar.</p>
          )}
          <p className="font-semibold text-[var(--fnl-ink)]">Paywall-views dalen sterker dan clicks op abonneren.</p>
          <InsightList
            items={[
              "Minder mensen zien de paywall.",
              "Wie de paywall ziet, klikt nog steeds relatief vaak door.",
              ...(avgAbo2024 != null && avgAbo2025 != null && avgAbo2026 != null
                ? [
                    `Abonneerkliks zijn over drie jaren stabiel (${formatEventAvgPerMonth(avgAbo2024)} → ${formatEventAvgPerMonth(avgAbo2025)} → ${formatEventAvgPerMonth(avgAbo2026)} per maand).`,
                  ]
                : []),
            ]}
          />
        </section>

        <section
          id="pres-ratio"
          className="scroll-mt-40 space-y-4 break-inside-avoid p-6 fnl-slide"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="fnl-slide-title">4. Paywallratio</h2>
            <span className="fnl-meta inline-flex items-center rounded-full border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] px-2.5 py-0.5 tabular-nums">4 / 10</span>
          </div>
          <p className="fnl-lede">Is de conversie vanuit de paywall verslechterd?</p>
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
                  caption="Abonneerkliks gedeeld door paywallweergaven, weergegeven als percentage (y-as en kerncijfers)."
                  onDownloadPng={() => void exportChartPng(refRatio.current, "presentatie-paywall-ratio.png")}
                  downloadLabel={DL}
                  chartTheme="fnl"
                />
              </div>
              <KpiCards
                items={[
                  { label: "Gemiddelde ratio 2024", value: formatRatioAsPct(ratioAvg2024) },
                  { label: "Gemiddelde ratio 2025", value: formatRatioAsPct(ratioAvg2025) },
                  { label: "Gemiddelde ratio 2026", value: formatRatioAsPct(ratioAvg2026) },
                ]}
              />
            </>
          ) : (
            <p className="text-sm text-[var(--fnl-ink-3)]">Data niet beschikbaar.</p>
          )}
          <p className="font-semibold text-[var(--fnl-ink)]">
            {ratioAvg2024 != null && ratioAvg2026 != null && ratioAvg2026 > ratioAvg2024
              ? `De conversie op de paywall is in 2026 gemiddeld hoger dan in 2024 (${formatRatioAsPct(ratioAvg2024)} → ${formatRatioAsPct(ratioAvg2026)}).`
              : "De paywall-abonneerratio verschuift met paywall-exposure — zie jaargemiddelden in de grafiek."}
          </p>
          <InsightList
            items={["Let op: paywall_abonneren is een klik naar de shop, geen bevestigd betaald abonnement."]}
          />
        </section>

        <section
          id="pres-abo-stabiel"
          className="scroll-mt-40 space-y-4 break-inside-avoid p-6 fnl-slide"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="fnl-slide-title">5. Kliks op &apos;abonneren&apos; bleven redelijk stabiel</h2>
            <span className="fnl-meta inline-flex items-center rounded-full border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] px-2.5 py-0.5 tabular-nums">
              5 / 10
            </span>
          </div>
          <p className="fnl-lede">Gemiddeld aantal paywall_abonneren per kalendermaand, uitgesplitst naar jaar.</p>
          {aboJaarBarData.length ? (
            <figure
              ref={refAboJaar}
              className="break-inside-avoid rounded-lg border border-[rgba(0,30,59,0.12)] bg-white p-4 shadow-[0_1px_2px_rgba(0,30,59,0.04),0_8px_24px_rgba(0,30,59,0.06)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <figcaption className="text-sm font-semibold text-[var(--fnl-ink)]">
                  Gemiddelde paywall_abonneren per maand (naar jaar)
                </figcaption>
                <button
                  type="button"
                  onClick={() => void exportChartPng(refAboJaar.current, "presentatie-shop-kliks-jaar.png")}
                  className="shrink-0 rounded border border-[#004077] bg-white px-2.5 py-1 text-xs font-semibold text-[#004077] transition-colors hover:bg-[#DCE7F0] active:translate-y-px print:hidden"
                >
                  {DL}
                </button>
              </div>
              <p className="mt-1 text-sm leading-snug text-[var(--fnl-ink-3)]">
                Gemiddelde over alle maanden met data binnen het kalenderjaar (2026: t/m de laatst beschikbare maand).
              </p>
              <div className="mx-auto mt-3 h-[360px] w-full max-w-3xl min-w-0 bg-white">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={aboJaarBarData}
                    margin={{ top: 32, right: 12, left: 8, bottom: 12 }}
                    barCategoryGap="32%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,30,59,0.12)" />
                    <XAxis dataKey="jaar" tick={{ fontSize: CHART_X }} />
                    <YAxis tick={{ fontSize: CHART_X }} tickFormatter={(v) => NlInt(Number(v))} width={44} />
                    <Tooltip
                      formatter={(v) => [NlInt(Math.round(Number(v))), "Gem. / mnd"]}
                      labelFormatter={(l) => `Jaar ${l}`}
                    />
                    <Bar dataKey="gem" name="paywall_abonneren" radius={[4, 4, 0, 0]} maxBarSize={72}>
                      {aboJaarBarData.map((d) => (
                        <Cell key={d.jaar} fill={d.fill} />
                      ))}
                      <LabelList dataKey="gem" position="top" content={ShopKlikJaarBarLabelContent as never} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </figure>
          ) : (
            <p className="text-sm text-[var(--fnl-ink-3)]">Data niet beschikbaar.</p>
          )}
          <InsightList
            items={[
              "Kliks naar shop blijven per maand relatief stabiel.",
              "Conversie op de pagina slechter, of een hoger opzegpercentage?",
            ]}
          />
        </section>

        <section
          id="pres-piek-art"
          className="scroll-mt-40 space-y-4 break-inside-avoid p-6 fnl-slide"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="fnl-slide-title">6. Wat verklaarde januari en juni 2024?</h2>
            <span className="fnl-meta inline-flex items-center rounded-full border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] px-2.5 py-0.5 tabular-nums">6 / 10</span>
          </div>
          <p className="fnl-lede">Welke artikelen zorgden voor de pieken?</p>
          {topArticles && !topArticles.fatalError ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--fnl-ink)]">Januari 2024 — top 5 op abonneerkliks</p>
                <TopFiveMiniTable rows={topArticles.january2024.topByAbonnement} />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--fnl-ink)]">Juni 2024 — top 5 op abonneerkliks</p>
                <TopFiveMiniTable rows={topArticles.june2024.topByAbonnement} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--fnl-ink-3)]">Data niet beschikbaar (stap 5).</p>
          )}
          <p className="font-semibold text-[var(--fnl-ink)]">
            Geen grote &apos;hit&apos;, maar een spreiding over actuele/duidende artikelen.
          </p>
        </section>

        <section
          id="pres-piek-kanaal"
          className="scroll-mt-40 space-y-4 break-inside-avoid p-6 fnl-slide"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="fnl-slide-title">7. Waar kwamen de piekartikelen vandaan?</h2>
            <span className="fnl-meta inline-flex items-center rounded-full border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] px-2.5 py-0.5 tabular-nums">7 / 10</span>
          </div>
          <p className="fnl-lede">
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
                  fill="#004077"
                  caption="Abonneerkliks op de top-25-artikelen naar standaardkanalen."
                  onDownloadPng={() => void exportChartPng(refChJan.current, "presentatie-kanaal-jan-2024.png")}
                  downloadLabel={DL}
                  chartTheme="fnl"
                />
                <ChartBlockChannelBarsSingle
                  data={chart.data6Jun}
                  chartRef={refChJun}
                  barHeight={BAR_H}
                  monthTitle="Juni 2024 — kanaal (topartikelen)"
                  fill="#C25621"
                  caption="Zelfde maatstaf voor juni."
                  onDownloadPng={() => void exportChartPng(refChJun.current, "presentatie-kanaal-jun-2024.png")}
                  downloadLabel={DL}
                  chartTheme="fnl"
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
            <p className="text-sm text-[var(--fnl-ink-3)]">Data niet beschikbaar (stap 6).</p>
          )}
          <p className="font-semibold text-[var(--fnl-ink)]">
            Nieuwsbrief was belangrijk in de piekmaanden; organisch zoeken had in juni ook een belangrijk aandeel.
          </p>
        </section>

        <section
          id="pres-nb-1k"
          className="scroll-mt-40 space-y-4 break-inside-avoid p-6 fnl-slide"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="fnl-slide-title">8. Nieuwsbriefblokken: minder resultaat per pageview</h2>
            <span className="fnl-meta inline-flex items-center rounded-full border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] px-2.5 py-0.5 tabular-nums">8 / 10</span>
          </div>
          <p className="fnl-lede">Waarom zien we weinig nieuwsbriefinschrijvingen?</p>
          {chart.hasNbA ? (
            <>
              <div className="aspect-video w-full min-h-[320px] min-w-0 max-h-[420px]">
                <ChartBlockNewsletter1k
                  data4={chart.data4}
                  chartRef={refNb1k}
                  chartHeight={CHART_H}
                  xTick={CHART_X}
                  title="Nieuwsbrief (artikel) per 1.000 paginaweergaven"
                  caption=""
                  onDownloadPng={() => void exportChartPng(refNb1k.current, "presentatie-nieuwsbrief-1k.png")}
                  downloadLabel={DL}
                  chartTheme="fnl"
                />
              </div>
              <div className="space-y-3">
                <KpiCards
                  items={[
                    {
                      label: "Gemiddelde nieuwsbrief per 1.000 paginaweergaven in 2024",
                      value: formatPer1k(nb2024),
                    },
                    {
                      label: "Gemiddelde nieuwsbrief per 1.000 paginaweergaven in 2025",
                      value: formatPer1k(nb2025),
                    },
                    {
                      label: "Gemiddelde nieuwsbrief per 1.000 paginaweergaven in 2026",
                      value: formatPer1k(nb2026),
                    },
                  ]}
                />
                <KpiCards
                  items={[
                    {
                      label: "Gemiddelde nieuwsbrief-events per maand in 2024",
                      value: formatEventAvgPerMonth(nbEventsAvg2024),
                    },
                    {
                      label: "Gemiddelde nieuwsbrief-events per maand in 2025",
                      value: formatEventAvgPerMonth(nbEventsAvg2025),
                    },
                    {
                      label: "Gemiddelde nieuwsbrief-events per maand in 2026",
                      value: formatEventAvgPerMonth(nbEventsAvg2026),
                    },
                  ]}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--fnl-ink-3)]">Data niet beschikbaar (stap 7 tabel A).</p>
          )}
          <p className="font-semibold text-[var(--fnl-ink)]">
            Bezoekers schrijven zich op HN minder snel in via het nieuwsbriefblok.
          </p>
          <InsightList
            items={[
              `Het potentieel is er nog: ${formatAvgNewUsersK(avgNu2024)}–${formatAvgNewUsersK(avgNu2026)} nieuwe gebruikers per maand. De daling ligt dus niet bij een verzadigde doelgroep.`,
            ]}
          />
        </section>

        <section
          id="pres-nb-device"
          className="scroll-mt-40 space-y-4 break-inside-avoid p-6 fnl-slide"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="fnl-slide-title">9. Nieuwsbrief mobiel versus desktop</h2>
            <span className="fnl-meta inline-flex items-center rounded-full border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] px-2.5 py-0.5 tabular-nums">9 / 10</span>
          </div>
          <p className="fnl-lede">Kan het aan device of zichtbaarheid liggen?</p>
          {chart.hasNbB && nbDevicePres ? (
            <>
              {nbDevicePres.hasBar ? (
                <figure
                  ref={refNbDev}
                  className="break-inside-avoid rounded-lg border border-[rgba(0,30,59,0.12)] bg-white p-4 shadow-[0_1px_2px_rgba(0,30,59,0.04),0_8px_24px_rgba(0,30,59,0.06)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <figcaption className="max-w-[85%] text-base font-semibold text-[var(--fnl-ink)]">
                      Jaargemiddelde nieuwsbrief per device (per 1.000 paginaweergaven)
                    </figcaption>
                    <button
                      type="button"
                      onClick={() => void exportChartPng(refNbDev.current, "presentatie-nieuwsbrief-device.png")}
                      className="shrink-0 rounded border border-[#004077] bg-white px-2.5 py-1 text-xs font-semibold text-[#004077] transition-colors hover:bg-[#DCE7F0] active:translate-y-px print:hidden"
                    >
                      {DL}
                    </button>
                  </div>
                  <div className="mx-auto mt-4 h-[300px] w-full max-w-3xl min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={nbDevicePres.barRows.map((r) => ({
                          device: r.device,
                          v2024: r.v2024 ?? undefined,
                          v2025: r.v2025 ?? undefined,
                          v2026: r.v2026 ?? undefined,
                        }))}
                        margin={{ top: 8, right: 16, left: 20, bottom: 8 }}
                        barGap={4}
                        barCategoryGap="24%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,30,59,0.12)" />
                        <XAxis dataKey="device" tick={{ fontSize: CHART_X + 2 }} />
                        <YAxis
                          tick={{ fontSize: CHART_X + 1 }}
                          width={56}
                          tickFormatter={(v) =>
                            typeof v === "number"
                              ? v.toLocaleString("nl-NL", { maximumFractionDigits: 2 })
                              : String(v)
                          }
                          label={{
                            value: "Nieuwsbrief-events per 1.000 pageviews",
                            angle: -90,
                            position: "insideLeft",
                            dx: -12,
                            style: { textAnchor: "middle", fill: "#2b3d52", fontSize: 12 },
                          }}
                        />
                        <Tooltip
                          formatter={(value, name) => {
                            const n = typeof value === "number" ? value : Number(value);
                            if (!Number.isFinite(n)) return ["—", String(name)];
                            return [formatPer1k2(n), String(name)];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 14, paddingTop: 10 }} />
                        <Bar
                          dataKey="v2024"
                          name="2024"
                          fill="#004077"
                          maxBarSize={52}
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="v2025"
                          name="2025"
                          fill="#C25621"
                          maxBarSize={52}
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="v2026"
                          name="2026"
                          fill="#287D52"
                          maxBarSize={52}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </figure>
              ) : (
                <p className="text-sm text-[var(--fnl-ink-3)]">
                  Onvoldoende gegevens in tabel B om jaargemiddelden per device te tonen.
                </p>
              )}

              <p className="text-sm leading-relaxed text-[var(--fnl-ink-2)]">
                {nbDevicePres.end.yearMonth ? (
                  <>
                    Van <span className="font-semibold text-[var(--fnl-ink)]">januari 2024</span> tot{" "}
                    <span className="font-semibold text-[var(--fnl-ink)]">{nbDevicePres.endColLabel}</span> zijn de
                    percentages bij de bullets een <span className="font-semibold">indicatieve</span> vergelijking
                    tussen twee losse maanden; de staafgrafiek hierboven toont{" "}
                    <span className="font-semibold">jaargemiddelden</span>.
                  </>
                ) : (
                  <>
                    Er is (nog) geen 2026-maand in tabel B om januari 2024 eenduidig mee te vergelijken; de
                    staafgrafiek toont <span className="font-semibold">jaargemiddelden</span> per device.
                  </>
                )}
              </p>

              <div className="rounded-lg border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] px-4 py-3">
                <ul className="list-inside list-disc space-y-2 text-base leading-snug text-[var(--fnl-ink-2)]">
                  {nbDevicePres.bullets.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>

              <p className="text-xs leading-relaxed text-[var(--fnl-ink-3)]">
                We meten hier nieuwsbrief_inschrijving_artikelen per 1.000 pageviews. Zonder aparte
                nieuwsbriefblok_view en nieuwsbriefblok_click is niet vast te stellen of de daling komt door lagere
                zichtbaarheid, lagere klikbereidheid of formulierfrictie.
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--fnl-ink-3)]">Data niet beschikbaar (stap 7 tabel B).</p>
          )}
        </section>

        <section
          id="pres-conclusie"
          className="scroll-mt-40 space-y-4 break-inside-avoid p-6 fnl-slide print:break-inside-avoid"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="fnl-slide-title">10. Belangrijkste conclusies</h2>
            <span className="fnl-meta inline-flex items-center rounded-full border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] px-2.5 py-0.5 tabular-nums">10 / 10</span>
          </div>
          <div className="mx-auto max-w-prose space-y-4">
            {conclusieItems.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-[var(--fnl-ink-12)] bg-[var(--fnl-blue-pale)] p-4 text-base leading-snug"
              >
                <p className="text-lg font-bold leading-tight text-[var(--fnl-ink)]">{item.title}</p>
                <p className="mt-2 leading-relaxed text-[var(--fnl-ink-2)]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
