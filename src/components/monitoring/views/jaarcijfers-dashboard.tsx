"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function JaarcijfersDashboard({
  ytdWeeklyRows,
  ytdWeeklyRowsPrevious,
  ytdPreviousYear,
  ytdYear,
}: {
  ytdWeeklyRows: YtdWeeklySessionRow[];
  ytdWeeklyRowsPrevious: YtdWeeklySessionRow[];
  ytdPreviousYear: number | null;
  ytdYear: number | null;
}) {
  const [ytdBrandFilter, setYtdBrandFilter] = useState<"all" | SiteTitleLabel>("all");

  const ytdChartRows = useMemo(() => {
    const yearPrefix = ytdYear != null ? String(ytdYear) : null;
    const filteredRows = yearPrefix
      ? ytdWeeklyRows.filter((r) => r.isoYearIsoWeek.startsWith(yearPrefix))
      : ytdWeeklyRows;
    const weeks = [...new Set(filteredRows.map((r) => r.isoYearIsoWeek))].sort();
    const sessionMap = new Map<string, number>();
    for (const r of filteredRows) {
      sessionMap.set(`${r.isoYearIsoWeek}\0${r.source}`, r.sessions);
    }

    if (ytdBrandFilter === "all") {
      return weeks.map((iso) => {
        const row: Record<string, string | number> = {
          weekKey: iso,
          weekLabel: formatIsoYearIsoWeekAxis(iso),
        };
        for (const lbl of SOURCE_LABELS) {
          row[lbl] = sessionMap.get(`${iso}\0${lbl}`) ?? 0;
        }
        return row;
      });
    }

    const brand = ytdBrandFilter;
    const prevPrefix = ytdPreviousYear != null ? String(ytdPreviousYear) : null;
    const prevFiltered =
      prevPrefix != null
        ? ytdWeeklyRowsPrevious.filter(
            (r) => r.source === brand && r.isoYearIsoWeek.startsWith(prevPrefix)
          )
        : [];
    const prevWeeks = [...new Set(prevFiltered.map((r) => r.isoYearIsoWeek))].sort();
    const prevMap = new Map<string, number>();
    for (const r of prevFiltered) {
      prevMap.set(`${r.isoYearIsoWeek}\0${r.source}`, r.sessions);
    }

    return weeks.map((iso, i) => {
      const prevIso = prevWeeks[i];
      const prevVal = prevIso != null ? (prevMap.get(`${prevIso}\0${brand}`) ?? 0) : 0;
      return {
        weekKey: iso,
        weekLabel: formatIsoYearIsoWeekAxis(iso),
        [brand]: sessionMap.get(`${iso}\0${brand}`) ?? 0,
        [YTD_PRIOR_SESSIONS_DATAKEY]: prevVal,
      };
    });
  }, [ytdBrandFilter, ytdWeeklyRows, ytdWeeklyRowsPrevious, ytdPreviousYear, ytdYear]);

  const ytdShowPriorYearLine =
    ytdBrandFilter !== "all" &&
    ytdPreviousYear != null &&
    ytdWeeklyRowsPrevious.some(
      (r) =>
        r.source === ytdBrandFilter &&
        r.isoYearIsoWeek.startsWith(String(ytdPreviousYear))
    );

  const ytdBarKeys: SiteTitleLabel[] =
    ytdBrandFilter === "all" ? [...SOURCE_LABELS] : [ytdBrandFilter];

  return (
    <div className="mb-10">
      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="fnl-section-title shrink-0">
            YTD-sessies (GA4) {ytdYear != null ? `· ${ytdYear}` : ""}
            <span className="mt-1 block font-normal text-sm text-muted-foreground sm:mt-0 sm:ml-2 sm:inline">
              per ISO-week
              {ytdShowPriorYearLine && ytdPreviousYear != null
                ? ` · lijn = ${ytdPreviousYear} (zelfde periode)`
                : ""}
            </span>
          </h2>
          <Select
            value={ytdBrandFilter}
            onValueChange={(v) => setYtdBrandFilter(v as "all" | SiteTitleLabel)}
          >
            <SelectTrigger className="h-9 w-full rounded-[4px] sm:w-[min(100%,260px)]">
              <SelectValue placeholder="Merk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle merken</SelectItem>
              {SOURCE_LABELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!ytdChartRows.length ? (
          <p className="text-sm text-muted-foreground">Geen data — GA4 .env?</p>
        ) : (
          <div className="fnl-card h-[340px] p-4 pt-2">
            <YtdSessionsChartLazy
              data={ytdChartRows}
              brandFilter={ytdBrandFilter}
              barKeys={ytdBarKeys}
              showPriorYearLine={ytdShowPriorYearLine}
              year={ytdYear}
              previousYear={ytdPreviousYear ?? null}
              lineColors={LINE_COLORS}
              priorYearDataKey={YTD_PRIOR_SESSIONS_DATAKEY}
            />
          </div>
        )}
      </section>
    </div>
  );
}
