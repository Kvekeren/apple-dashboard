"use client";

import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { DashboardPeriodFilter } from "@/components/monitoring/period-filter";
import { badgeClassForLabel } from "@/lib/site-titles";
import {
  SOURCE_LABELS,
  YOY_DASHBOARD_KPIS,
  favIconUrl,
  formatDashboardPeriod,
  type CijfersData,
  type CijfersMetricValue,
  type PeriodPreset,
} from "@/lib/monitoring/shared";

function YoYMetricRow({
  label,
  metric,
  previousYear,
}: {
  label: string;
  metric: CijfersMetricValue | undefined;
  previousYear: number;
}) {
  if (!metric) {
    return (
      <div className="border-b border-border py-3 last:border-b-0 last:pb-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm text-muted-foreground">Geen data</div>
      </div>
    );
  }

  const positive = metric.change > 0;
  const negative = metric.change < 0;

  return (
    <div className="border-b border-border py-3 last:border-b-0 last:pb-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {metric.current.toLocaleString("nl-NL")}
        </span>
        {metric.changePercent != null ? (
          <span
            className={`shrink-0 text-sm font-semibold tabular-nums ${
              positive
                ? "text-[var(--fnl-success)]"
                : negative
                  ? "text-[var(--fnl-danger)]"
                  : "text-muted-foreground"
            }`}
          >
            {positive ? "+" : ""}
            {metric.changePercent}%
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted-foreground">— vs {previousYear}</span>
        )}
      </div>
      <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
        {previousYear}: {metric.previous.toLocaleString("nl-NL")}
      </div>
    </div>
  );
}

export function YoYSummaryCards({
  cjfYoy,
  periodPreset,
  setPeriodPreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: {
  cjfYoy: CijfersData | null;
  periodPreset: PeriodPreset;
  setPeriodPreset: (p: PeriodPreset) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
}) {
  if (!cjfYoy) {
    return (
      <section>
        <h2 className="fnl-section-title mb-2">Prestaties vs vorig jaar</h2>
        <div className="mb-4">
          <DashboardPeriodFilter
            periodPreset={periodPreset}
            setPeriodPreset={setPeriodPreset}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {SOURCE_LABELS.map((src) => (
            <div key={src} className="fnl-card flex h-52 items-center justify-center p-4">
              <span className="text-sm text-muted-foreground">{src} laden…</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const { current, previous } = cjfYoy.periods;
  const previousYear = parseISO(previous.startDate).getFullYear();

  return (
    <section>
      <h2 className="fnl-section-title mb-2">Prestaties vs vorig jaar</h2>
      <div className="mb-3">
        <DashboardPeriodFilter
          periodPreset={periodPreset}
          setPeriodPreset={setPeriodPreset}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
        />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {formatDashboardPeriod(current.startDate, current.endDate)} vergeleken met dezelfde periode in{" "}
        {previousYear} ({formatDashboardPeriod(previous.startDate, previous.endDate)})
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {SOURCE_LABELS.map((src) => {
          const sourceRow = cjfYoy.sources.find((s) => s.source === src);
          const fav = favIconUrl(src);
          return (
            <div key={src} className="fnl-card-hover flex flex-col p-4">
              <div className="flex flex-col items-center border-b border-border pb-3">
                {fav ? <img alt="" src={fav} className="mb-1.5 size-8 rounded-[8px]" /> : null}
                <Badge variant="outline" className={badgeClassForLabel(src)}>
                  {src}
                </Badge>
              </div>
              <div className="mt-1">
                {YOY_DASHBOARD_KPIS.map(({ key, label }) => (
                  <YoYMetricRow
                    key={key}
                    label={label}
                    metric={sourceRow?.metrics[key]}
                    previousYear={previousYear}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
