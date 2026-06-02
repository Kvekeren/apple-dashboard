"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { getISOWeek, getISOWeekYear } from "date-fns";

import {
  normalizeIsoYearIsoWeek,
  parseIsoYearIsoWeek,
  toIsoYearIsoWeek,
} from "@/lib/iso-week-range";
import type { SiteTitleLabel } from "@/lib/site-titles";
import {
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

function useBrandChartData(
  ytdWeeklyRows: YtdWeeklySessionRow[],
  ytdWeeklyRowsPrevious: YtdWeeklySessionRow[],
  ytdYear: number | null,
  ytdPreviousYear: number | null
) {
  const ytdThroughWeek =
    ytdYear != null && ytdYear === getISOWeekYear(new Date())
      ? getISOWeek(new Date())
      : null;

  return useMemo(() => {
    const byBrand = new Map<SiteTitleLabel, Record<string, string | number>[]>();
    for (const brand of SOURCE_LABELS) {
      byBrand.set(
        brand,
        buildBrandYtdRows(
          brand,
          ytdWeeklyRows,
          ytdWeeklyRowsPrevious,
          ytdYear,
          ytdPreviousYear,
          ytdThroughWeek
        )
      );
    }
    return byBrand;
  }, [
    ytdWeeklyRows,
    ytdWeeklyRowsPrevious,
    ytdPreviousYear,
    ytdThroughWeek,
    ytdYear,
  ]);
}

function YtdMetricSection({
  title,
  ytdWeeklyRows,
  ytdWeeklyRowsPrevious,
  ytdYear,
  ytdPreviousYear,
  emptyHint,
}: {
  title: string;
  ytdWeeklyRows: YtdWeeklySessionRow[];
  ytdWeeklyRowsPrevious: YtdWeeklySessionRow[];
  ytdYear: number | null;
  ytdPreviousYear: number | null;
  emptyHint: string;
}) {
  const brandChartData = useBrandChartData(
    ytdWeeklyRows,
    ytdWeeklyRowsPrevious,
    ytdYear,
    ytdPreviousYear
  );

  const hasAnyRows = SOURCE_LABELS.some(
    (brand) => (brandChartData.get(brand)?.length ?? 0) > 0
  );

  return (
    <section className="mb-12">
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
        {title}
        {ytdYear != null ? ` · ${ytdYear}` : ""}
      </h2>
      {!hasAnyRows ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="flex flex-col gap-8">
          {SOURCE_LABELS.map((brand) => {
            const rows = brandChartData.get(brand) ?? [];
            const showPriorYearLine = hasPriorYearData(
              brand,
              ytdWeeklyRowsPrevious,
              ytdPreviousYear
            );
            return (
              <div key={brand} className="flex flex-col gap-3">
                <h3 className="fnl-section-title">{brand}</h3>
                {!rows.length ? (
                  <p className="text-sm text-muted-foreground">Geen data voor {brand}.</p>
                ) : (
                  <div className="fnl-card h-[280px] p-4 pt-2">
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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function JaarcijfersDashboard({
  pageviewsRows,
  pageviewsRowsPrevious,
  discoverRows,
  discoverRowsPrevious,
  searchRows,
  searchRowsPrevious,
  ytdPreviousYear,
  ytdYear,
}: {
  pageviewsRows: YtdWeeklySessionRow[];
  pageviewsRowsPrevious: YtdWeeklySessionRow[];
  discoverRows: YtdWeeklySessionRow[];
  discoverRowsPrevious: YtdWeeklySessionRow[];
  searchRows: YtdWeeklySessionRow[];
  searchRowsPrevious: YtdWeeklySessionRow[];
  ytdPreviousYear: number | null;
  ytdYear: number | null;
}) {
  return (
    <div className="mb-10">
      <YtdMetricSection
        title="Pageviews"
        ytdWeeklyRows={pageviewsRows}
        ytdWeeklyRowsPrevious={pageviewsRowsPrevious}
        ytdYear={ytdYear}
        ytdPreviousYear={ytdPreviousYear}
        emptyHint="Geen data — GA4 .env?"
      />
      <YtdMetricSection
        title="Discover"
        ytdWeeklyRows={discoverRows}
        ytdWeeklyRowsPrevious={discoverRowsPrevious}
        ytdYear={ytdYear}
        ytdPreviousYear={ytdPreviousYear}
        emptyHint="Geen Discover-data — GSC-verbinding of rechten?"
      />
      <YtdMetricSection
        title="Google Search"
        ytdWeeklyRows={searchRows}
        ytdWeeklyRowsPrevious={searchRowsPrevious}
        ytdYear={ytdYear}
        ytdPreviousYear={ytdPreviousYear}
        emptyHint="Geen Search-data — GSC-verbinding of rechten?"
      />
    </div>
  );
}
