"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDurationSeconds } from "@/lib/conversion-format";
import type { ConversionMetricValue } from "@/lib/conversion-types";

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 64;
  const h = 24;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="opacity-70" aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
        className="text-[var(--fnl-ink-3)]"
      />
    </svg>
  );
}

function formatMetricValue(
  value: number,
  format: "number" | "percent" | "currency" | "ratio" | "duration" | "decimal"
): string {
  if (format === "currency") {
    return value.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
  }
  if (format === "duration") return formatDurationSeconds(value);
  if (format === "decimal") return value.toFixed(2).replace(".", ",");
  if (format === "percent") {
    return `${value.toFixed(2).replace(".", ",")}%`;
  }
  return value.toLocaleString("nl-NL");
}

function KpiCard({
  label,
  format,
  metric,
  unavailable,
  unavailableReason,
}: {
  label: string;
  format: "number" | "percent" | "currency" | "ratio" | "duration" | "decimal";
  metric: ConversionMetricValue;
  unavailable?: boolean;
  unavailableReason?: string;
}) {
  if (unavailable) {
    return (
      <div className="fnl-card flex flex-col p-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-2 text-sm text-muted-foreground">
          {unavailableReason ?? "Niet beschikbaar voor dit merk"}
        </div>
      </div>
    );
  }

  const displayValue =
    format === "percent" && metric.ratio != null
      ? metric.ratio
      : format === "percent"
        ? metric.current > 0 && metric.ratio == null
          ? metric.current
          : (metric.ratio ?? metric.current)
        : metric.current;

  const positive = metric.change > 0;
  const negative = metric.change < 0;

  return (
    <div className="fnl-card-hover flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {metric.sparkline ? <MiniSparkline values={metric.sparkline} /> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {format === "percent" && metric.ratio != null
          ? formatMetricValue(metric.ratio, "percent")
          : formatMetricValue(displayValue, format === "ratio" ? "number" : format)}
      </div>
      {metric.ratioLabel && metric.ratio != null && format !== "percent" ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {`${metric.ratio.toLocaleString("nl-NL", {
            maximumFractionDigits: Math.abs(metric.ratio) < 1 ? 3 : 1,
          })} ${metric.ratioLabel}`}
        </div>
      ) : null}
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          Vorige:{" "}
          {format === "percent" && metric.ratioPrevious != null
            ? formatMetricValue(metric.ratioPrevious, "percent")
            : formatMetricValue(
                metric.previous,
                format === "ratio" ? "number" : format
              )}
        </span>
        {metric.changePercent != null ? (
          <span
            className={`text-sm font-semibold tabular-nums ${
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
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

export function ConversionKpiCards({
  kpis,
}: {
  kpis: import("@/lib/conversion-types").ConversionMetricCard[];
}) {
  if (kpis.length === 0) {
    return (
      <div className="fnl-card p-6 text-center text-sm text-muted-foreground">
        Geen KPI-data beschikbaar.
      </div>
    );
  }

  const gridCols =
    kpis.length <= 5
      ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className={`grid gap-3 ${gridCols}`}>
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.id}
          label={kpi.label}
          format={kpi.format}
          metric={kpi.metric}
          unavailable={kpi.unavailable}
          unavailableReason={kpi.unavailableReason}
        />
      ))}
    </div>
  );
}

export function ConversionSparklineChart({
  values,
  labels,
}: {
  values: number[];
  labels?: string[];
}) {
  const data = values.map((v, i) => ({
    label: labels?.[i] ?? String(i + 1),
    value: v,
  }));

  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke="#004077" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
