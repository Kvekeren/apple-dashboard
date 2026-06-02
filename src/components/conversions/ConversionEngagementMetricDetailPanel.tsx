"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatConversionValue } from "@/lib/conversion-format";
import type { ConversionEngagementMetricDetail } from "@/lib/conversion-types";

function formatPeriod(start: string, end: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export function ConversionEngagementMetricDetailPanel({
  detail,
  loading,
  onClose,
}: {
  detail: ConversionEngagementMetricDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!detail && !loading) return null;

  const compareLabel =
    detail?.compareMode === "yoy" ? "zelfde periode vorig jaar" : "vorige periode";

  return (
    <section className="fnl-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{detail?.label ?? "Metric laden…"}</h3>
          {detail ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Sessie-metric · GA4 property · {compareLabel}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Sluiten
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Detail laden…</p>
      ) : detail ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricBox
              label="Huidige periode"
              sub={formatPeriod(
                detail.periods.current.startDate,
                detail.periods.current.endDate
              )}
              value={formatConversionValue(detail.current, detail.format)}
            />
            <MetricBox
              label={detail.compareMode === "yoy" ? "Vorig jaar" : "Vorige periode"}
              sub={formatPeriod(
                detail.periods.previous.startDate,
                detail.periods.previous.endDate
              )}
              value={formatConversionValue(detail.previous, detail.format)}
            />
            <MetricBox
              label="Verschil"
              value={
                detail.changePercent != null
                  ? `${detail.change > 0 ? "+" : ""}${detail.changePercent}%`
                  : "—"
              }
              valueClassName={
                detail.changePercent != null
                  ? detail.change > 0
                    ? "text-[var(--fnl-success)]"
                    : detail.change < 0
                      ? "text-[var(--fnl-danger)]"
                      : undefined
                  : undefined
              }
            />
          </div>

          {detail.trend.length > 1 ? (
            <div>
              <h4 className="mb-2 text-sm font-medium">Trend per dag</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={detail.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DCE7F0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) =>
                      formatConversionValue(v, detail.format).replace(/\s/g, "")
                    }
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      formatConversionValue(value, detail.format),
                      detail.label,
                    ]}
                  />
                  <Line type="monotone" dataKey="value" stroke="#004077" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Onvoldoende data voor een trendlijn.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function MetricBox({
  label,
  sub,
  value,
  valueClassName,
}: {
  label: string;
  sub?: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[4px] border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
      <div className={`mt-1 text-lg font-semibold tabular-nums ${valueClassName ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
