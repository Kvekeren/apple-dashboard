"use client";

import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardPeriodFilter } from "@/components/monitoring/period-filter";
import { RealtimeBlock } from "@/components/monitoring/views/realtime-block";
import { YoYSummaryCards } from "@/components/monitoring/views/yoy-summary";
import { badgeClassForLabel } from "@/lib/site-titles";
import {
  SOURCE_LABELS,
  favIconUrl,
  normArticleUrl,
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

  function resolveTopRowOgImage(url: string): string | undefined {
    const n = normArticleUrl(url);
    return pageOgImages[n] ?? pageOgImages[url];
  }

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
        <div className="grid gap-3 sm:grid-cols-3">
          {SOURCE_LABELS.map((src) => {
            const lacksGa4 =
              topTenMetric === "ga4" &&
              siteCfg?.some((c) => c.label === src && !c.hasGa4Property);
            const allRows = weeklyTopAllBySource[src] ?? [];
            const rows = allRows.slice(0, topArticlesVisible);
            const fav = favIconUrl(src);
            return (
              <div key={src} className="fnl-card-hover flex flex-col p-4">
                <div className="flex flex-col items-center border-b border-border pb-2.5">
                  {fav ? <img alt="" src={fav} className="mb-1.5 size-8 rounded-[8px]" /> : null}
                  <Badge variant="outline" className={badgeClassForLabel(src)}>
                    {src}
                  </Badge>
                  {lacksGa4 ? (
                    <p className="mt-2 text-center text-xs font-medium text-[var(--fnl-warning)]">
                      GA4 .env?
                    </p>
                  ) : null}
                </div>
                {!rows.length ? (
                  <p className="mt-3 flex-1 text-center text-sm text-muted-foreground">Geen data</p>
                ) : (
                  <div className="mt-3 flex flex-1 flex-col gap-2">
                    {rows.map((r, i) => {
                      const imgSrc = resolveTopRowOgImage(r.url);
                      return (
                        <div
                          key={`${src}-${i}-${r.pageTitle.slice(0, 48)}`}
                          className="flex gap-2.5 border-b border-border pb-2.5 last:border-b-0 last:pb-0"
                        >
                          <div className="w-[100px] shrink-0 sm:w-[112px]">
                            {imgSrc ? (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img
                                  alt=""
                                  src={imgSrc}
                                  className="aspect-video w-full rounded-[3px] border border-border object-cover"
                                />
                              </a>
                            ) : (
                              <div
                                className="aspect-video w-full rounded-[3px] border border-dashed border-border bg-muted/50"
                                aria-hidden
                              />
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 gap-1.5 leading-snug">
                            <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
                              {i + 1}.
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-w-0 flex-1 text-xs leading-snug text-foreground underline-offset-2 hover:text-primary hover:underline"
                                >
                                  {r.pageTitle}
                                </a>
                                <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground sm:pt-px">
                                  {r.metricValue.toLocaleString("nl-NL")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {hasMoreTopArticles ? (
          <div className="mt-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-[4px] text-primary hover:bg-[var(--fnl-blue-pale)]"
              onClick={onLoadMoreTopArticles}
            >
              <ChevronDown className="size-4" />
              Meer laden
            </Button>
          </div>
        ) : null}
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
