"use client";

import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { DashboardPeriodFilter } from "@/components/monitoring/period-filter";
import { RealtimeBlock } from "@/components/monitoring/views/realtime-block";
import { TopArticlesSourceGrid } from "@/components/monitoring/views/top-articles-source-grid";
import { YoYSummaryCards } from "@/components/monitoring/views/yoy-summary";
import {
  type CijfersData,
  type PeriodPreset,
  type SiteCfg,
  type TopTenMetricFilter,
  type WeeklyTopArticleRow,
} from "@/lib/monitoring/shared";

export function HomeDashboard({
  gscMeta,
  topErr,
  topMeta,
  periodPreset,
  setPeriodPreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  yoyPeriodPreset,
  setYoyPeriodPreset,
  yoyCustomStart,
  setYoyCustomStart,
  yoyCustomEnd,
  setYoyCustomEnd,
  topTenMetric,
  setTopTenMetric,
  weeklyTopAllBySource,
  topArticlesVisible,
  hasMoreTopArticles,
  onLoadMoreTopArticles,
  pageOgImages,
  siteCfg,
  rtLoad,
  rt,
  onRefreshRt,
  cjfYoy,
}: {
  gscMeta: { startDate: string; endDate: string } | null;
  topErr: string | null;
  topMeta: { startDate: string; endDate: string } | null;
  periodPreset: PeriodPreset;
  setPeriodPreset: (p: PeriodPreset) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
  yoyPeriodPreset: PeriodPreset;
  setYoyPeriodPreset: (p: PeriodPreset) => void;
  yoyCustomStart: string;
  setYoyCustomStart: (v: string) => void;
  yoyCustomEnd: string;
  setYoyCustomEnd: (v: string) => void;
  topTenMetric: TopTenMetricFilter;
  setTopTenMetric: (m: TopTenMetricFilter) => void;
  weeklyTopAllBySource: Record<string, WeeklyTopArticleRow[]>;
  topArticlesVisible: number;
  hasMoreTopArticles: boolean;
  onLoadMoreTopArticles: () => void;
  pageOgImages: Record<string, string>;
  siteCfg: SiteCfg[] | null;
  rtLoad: boolean;
  rt: {
    data: { source: string; activeUsers: number }[];
    topPages: { source: string; url: string; pageTitle: string; screenPageViews: number }[];
  } | null;
  onRefreshRt: () => void;
  cjfYoy: CijfersData | null;
}) {
  const topDateRange = topMeta ?? gscMeta;

  return (
    <div className="mb-10 space-y-10">
      <section>
        <h2 className="fnl-section-title mb-3">Realtime (GA4)</h2>
        <RealtimeBlock rtLoad={rtLoad} rt={rt} cfg={siteCfg} onRefresh={onRefreshRt} />
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="fnl-section-title">
              Meest gelezen artikelen
              {topDateRange ? (
                <span className="ml-2 font-normal text-sm text-muted-foreground">
                  {format(parseISO(topDateRange.startDate), "d MMMM", { locale: nl })} –{" "}
                  {format(parseISO(topDateRange.endDate), "d MMMM", { locale: nl })}
                </span>
              ) : null}
            </h2>
            <div className="mt-2">
              <DashboardPeriodFilter
                periodPreset={periodPreset}
                setPeriodPreset={setPeriodPreset}
                customStart={customStart}
                setCustomStart={setCustomStart}
                customEnd={customEnd}
                setCustomEnd={setCustomEnd}
              />
            </div>
          </div>
          <div className="flex w-full max-w-xl min-w-0 gap-1 rounded-[8px] border border-border bg-muted p-1 sm:max-w-none sm:w-fit sm:shrink-0">
            {(
              [
                ["ga4", "Pageviews"],
                ["gsc-discover", "Discover"],
                ["gsc-web", "Google Search"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-active={topTenMetric === value ? "true" : "false"}
                onClick={() => setTopTenMetric(value)}
                className="fnl-segment-item min-w-0 flex-1 px-2 py-2 text-center leading-tight sm:flex-none sm:px-3 sm:text-left"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {topTenMetric === "ga4" && topErr ? (
          <p className="mb-2 text-sm text-[var(--fnl-danger)]">{topErr}</p>
        ) : null}
        <TopArticlesSourceGrid
          weeklyTopAllBySource={weeklyTopAllBySource}
          topArticlesVisible={topArticlesVisible}
          hasMoreTopArticles={hasMoreTopArticles}
          onLoadMoreTopArticles={onLoadMoreTopArticles}
          pageOgImages={pageOgImages}
          siteCfg={siteCfg}
          showGa4Warning={topTenMetric === "ga4"}
        />
      </section>

      <YoYSummaryCards
        cjfYoy={cjfYoy}
        periodPreset={yoyPeriodPreset}
        setPeriodPreset={setYoyPeriodPreset}
        customStart={yoyCustomStart}
        setCustomStart={setYoyCustomStart}
        customEnd={yoyCustomEnd}
        setCustomEnd={setYoyCustomEnd}
      />
    </div>
  );
}
