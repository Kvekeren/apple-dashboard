"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { getISOWeek, getISOWeekYear } from "date-fns";

import {
  normalizeIsoYearIsoWeek,
  parseIsoYearIsoWeek,
  toIsoYearIsoWeek,
} from "@/lib/iso-week-range";
import type { SiteTitleLabel } from "@/lib/site-titles";
import { SegmentSwitch } from "@/components/monitoring/brand-tabs";
import {
  favIconUrl,
  LINE_COLORS,
  SOURCE_LABELS,
  YTD_PRIOR_SESSIONS_DATAKEY,
  formatIsoYearIsoWeekAxis,
  type YtdWeeklySessionRow,
} from "@/lib/monitoring/shared";

const YtdSessionsChartLazy = dynamic(
  () =>
    import("@/components/monitoring/ytd-sessions-chart").then((m) => ({
      default: m.YtdSessionsChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[304px] items-center justify-center text-sm text-muted-foreground">
        Grafiek laden…
      </div>
    ),
  }
);

function buildBrandYtdRows(
  brand: SiteTitleLabel,
  ytdWeeklyRows: YtdWeeklySessionRow[],
  ytdWeeklyRowsPrevious: YtdWeeklySessionRow[],
  ytdYear: number | null,
  ytdPreviousYear: number | null,
  ytdThroughWeek: number | null
): Record<string, string | number>[] {
  if (ytdYear == null) return [];

  const sessionMap = new Map<string, number>();
  for (const r of ytdWeeklyRows) {
    if (r.source !== brand) continue;
    const key = normalizeIsoYearIsoWeek(r.isoYearIsoWeek);
    if (!key) continue;
    const parsed = parseIsoYearIsoWeek(key);
    if (!parsed || parsed.isoYear !== ytdYear) continue;
    sessionMap.set(key, r.sessions);
  }

  const prevMap = new Map<string, number>();
  if (ytdPreviousYear != null) {
    for (const r of ytdWeeklyRowsPrevious) {
      if (r.source !== brand) continue;
      const key = normalizeIsoYearIsoWeek(r.isoYearIsoWeek);
      if (!key) continue;
      const parsed = parseIsoYearIsoWeek(key);
      if (!parsed || parsed.isoYear !== ytdPreviousYear) continue;
      prevMap.set(key, r.sessions);
    }
  }

  const weekNumbers = new Set<number>();
  for (const key of sessionMap.keys()) {
    const parsed = parseIsoYearIsoWeek(key);
    if (parsed) weekNumbers.add(parsed.isoWeek);
  }
  if (ytdThroughWeek != null) {
    for (let w = 1; w <= ytdThroughWeek; w++) weekNumbers.add(w);
  }
  if (!weekNumbers.size) return [];

  return [...weekNumbers].sort((a, b) => a - b).map((isoWeek) => {
    const iso = toIsoYearIsoWeek(ytdYear, isoWeek);
    const prevIso =
      ytdPreviousYear != null ? toIsoYearIsoWeek(ytdPreviousYear, isoWeek) : null;
    return {
      weekKey: iso,
      weekLabel: formatIsoYearIsoWeekAxis(iso),
      [brand]: sessionMap.get(iso) ?? 0,
      [YTD_PRIOR_SESSIONS_DATAKEY]:
        prevIso != null ? (prevMap.get(prevIso) ?? 0) : 0,
    };
  });
}

function hasPriorYearData(
  brand: SiteTitleLabel,
  ytdWeeklyRowsPrevious: YtdWeeklySessionRow[],
  ytdPreviousYear: number | null
): boolean {
  return (
    ytdPreviousYear != null &&
    ytdWeeklyRowsPrevious.some((r) => {
      if (r.source !== brand) return false;
      const parsed = parseIsoYearIsoWeek(r.isoYearIsoWeek);
      return parsed?.isoYear === ytdPreviousYear;
    })
  );
}

export type JaarMetricKey = "pageviews" | "discover" | "organisch" | "nieuwsbrief";

export type JaarMetricSeries = {
  rows: YtdWeeklySessionRow[];
  rowsPrevious: YtdWeeklySessionRow[];
};

const METRIC_TABS: readonly { id: JaarMetricKey; label: string }[] = [
  { id: "pageviews", label: "Pageviews" },
  { id: "discover", label: "Discover" },
  { id: "organisch", label: "Organisch" },
  { id: "nieuwsbrief", label: "Nieuwsbrief" },
];

const METRIC_INFO: Record<JaarMetricKey, { unit: string; source: string }> = {
  pageviews: { unit: "pageviews", source: "GA4 · paginaweergaven" },
  discover: { unit: "klikken", source: "Search Console · Discover-klikken" },
  organisch: { unit: "klikken", source: "Search Console · klikken uit Google Zoeken" },
  nieuwsbrief: { unit: "sessies", source: "GA4 · sessies vanuit de nieuwsbrief (bron/medium/campagne)" },
};

function ytdTotals(
  brand: SiteTitleLabel,
  series: JaarMetricSeries,
  ytdYear: number | null,
  ytdPreviousYear: number | null
): { current: number; previous: number } {
  let current = 0;
  let previous = 0;
  for (const r of series.rows) {
    if (r.source !== brand) continue;
    const p = parseIsoYearIsoWeek(normalizeIsoYearIsoWeek(r.isoYearIsoWeek) ?? "");
    if (p && p.isoYear === ytdYear) current += r.sessions;
  }
  for (const r of series.rowsPrevious) {
    if (r.source !== brand) continue;
    const p = parseIsoYearIsoWeek(normalizeIsoYearIsoWeek(r.isoYearIsoWeek) ?? "");
    if (p && p.isoYear === ytdPreviousYear) previous += r.sessions;
  }
  return { current, previous };
}

function BrandYearCard({
  brand,
  metric,
  onMetricChange,
  series,
  ytdYear,
  ytdPreviousYear,
  loading,
}: {
  brand: SiteTitleLabel;
  metric: JaarMetricKey;
  onMetricChange: (m: JaarMetricKey) => void;
  series: JaarMetricSeries;
  ytdYear: number | null;
  ytdPreviousYear: number | null;
  loading: boolean;
}) {
  const ytdThroughWeek =
    ytdYear != null && ytdYear === getISOWeekYear(new Date()) ? getISOWeek(new Date()) : null;

  const rows = useMemo(
    () =>
      buildBrandYtdRows(
        brand,
        series.rows,
        series.rowsPrevious,
        ytdYear,
        ytdPreviousYear,
        ytdThroughWeek
      ),
    [brand, series, ytdYear, ytdPreviousYear, ytdThroughWeek]
  );
  const hasData = rows.some((r) => Number(r[brand] ?? 0) > 0);
  const showPriorYearLine = hasPriorYearData(brand, series.rowsPrevious, ytdPreviousYear);
  const totals = ytdTotals(brand, series, ytdYear, ytdPreviousYear);
  const change =
    totals.previous > 0 ? Math.round(((totals.current - totals.previous) / totals.previous) * 1000) / 10 : null;
  const fav = favIconUrl(brand);
  const info = METRIC_INFO[metric];

  return (
    <section className="fnl-card p-4" aria-label={brand}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          {fav ? <img alt="" src={fav} className="size-7 rounded-[6px]" /> : null}
          <div>
            <h2 className="text-base font-semibold text-foreground">{brand}</h2>
            <p className="text-[11px] text-muted-foreground">{info.source}</p>
          </div>
        </div>
        <SegmentSwitch value={metric} onChange={onMetricChange} options={METRIC_TABS} ariaLabel={`Metriek ${brand}`} />
      </div>

      {hasData ? (
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {totals.current.toLocaleString("nl-NL")}
          </span>
          <span className="text-xs text-muted-foreground">
            {info.unit} in {ytdYear} t/m deze week
          </span>
          {change != null ? (
            <span
              className={`text-sm font-semibold tabular-nums ${
                change > 0
                  ? "text-[var(--fnl-success)]"
                  : change < 0
                    ? "text-[var(--fnl-danger)]"
                    : "text-muted-foreground"
              }`}
            >
              {change > 0 ? "+" : ""}
              {change.toLocaleString("nl-NL")}% vs {ytdPreviousYear} (
              {totals.previous.toLocaleString("nl-NL")})
            </span>
          ) : null}
        </div>
      ) : null}

      {loading && !hasData ? (
        <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
          Laden…
        </div>
      ) : !hasData ? (
        <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
          Geen {METRIC_TABS.find((m) => m.id === metric)?.label.toLowerCase()}-data voor {brand}.
        </div>
      ) : (
        <div className="h-[280px] pt-1">
          <YtdSessionsChartLazy
            data={rows}
            brandFilter={brand}
            barKeys={[brand]}
            showPriorYearLine={showPriorYearLine}
            year={ytdYear}
            previousYear={ytdPreviousYear ?? null}
            lineColors={LINE_COLORS}
            priorYearDataKey={YTD_PRIOR_SESSIONS_DATAKEY}
          />
        </div>
      )}
    </section>
  );
}

export function JaarcijfersDashboard({
  series,
  ytdPreviousYear,
  ytdYear,
  loading,
}: {
  series: Record<JaarMetricKey, JaarMetricSeries>;
  ytdPreviousYear: number | null;
  ytdYear: number | null;
  loading: boolean;
}) {
  const [allMetric, setAllMetric] = useState<JaarMetricKey>("pageviews");
  const [perBrand, setPerBrand] = useState<Record<string, JaarMetricKey>>({});

  // Kiezen bovenaan zet alle titels op dezelfde metriek.
  const chooseAll = (m: JaarMetricKey) => {
    setAllMetric(m);
    setPerBrand({});
  };

  return (
    <div className="mb-10 space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Jaarcijfers{ytdYear != null ? ` ${ytdYear}` : ""}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Per week, met de lijn van dezelfde week in {ytdPreviousYear ?? "vorig jaar"}. Wissel per
            titel van metriek, of zet ze hiernaast allemaal tegelijk om.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Alle titels:</span>
          <SegmentSwitch value={allMetric} onChange={chooseAll} options={METRIC_TABS} ariaLabel="Metriek alle titels" />
        </div>
      </header>
      {SOURCE_LABELS.map((brand) => {
        const metric = perBrand[brand] ?? allMetric;
        return (
          <BrandYearCard
            key={brand}
            brand={brand}
            metric={metric}
            onMetricChange={(m) => setPerBrand((p) => ({ ...p, [brand]: m }))}
            series={series[metric]}
            ytdYear={ytdYear}
            ytdPreviousYear={ytdPreviousYear}
            loading={loading}
          />
        );
      })}
    </div>
  );
}
