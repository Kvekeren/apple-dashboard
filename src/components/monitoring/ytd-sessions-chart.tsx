"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SiteTitleLabel } from "@/lib/site-titles";
import { parseIsoYearIsoWeek } from "@/lib/iso-week-range";

export type YtdSessionsChartProps = {
  data: Record<string, string | number | null>[];
  brandFilter: "all" | SiteTitleLabel;
  barKeys: SiteTitleLabel[];
  showPriorYearLine: boolean;
  year: number | null;
  previousYear: number | null;
  lineColors: Record<string, string>;
  priorYearDataKey: string;
};

export function YtdSessionsChart({
  data,
  brandFilter,
  barKeys,
  showPriorYearLine,
  year,
  previousYear,
  lineColors,
  priorYearDataKey,
}: YtdSessionsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 52 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#DCE7F0" vertical={false} />
        <XAxis
          dataKey="weekLabel"
          tick={{ fill: "var(--fnl-ink-3)", fontSize: 10 }}
          angle={-38}
          textAnchor="end"
          height={52}
          interval={0}
        />
        <YAxis
          tick={{ fill: "var(--fnl-ink-3)", fontSize: 11 }}
          tickFormatter={(v) => Number(v).toLocaleString("nl-NL")}
          width={64}
        />
        <Tooltip
          formatter={(value, name) => {
            const v = value as number | string | undefined | null;
            if (v == null) return ["geen data", String(name ?? "")];
            const num = typeof v === "number" ? v : Number(v ?? 0);
            return [
              Number.isFinite(num) ? num.toLocaleString("nl-NL") : String(v ?? ""),
              String(name ?? ""),
            ];
          }}
          labelFormatter={(_, payload) => {
            const row = payload?.[0]?.payload as { weekKey?: string } | undefined;
            const iso = row?.weekKey;
            const parsed = iso ? parseIsoYearIsoWeek(iso) : null;
            if (parsed) {
              return `Week ${parsed.isoWeek}, ${parsed.isoYear}`;
            }
            return iso ?? "";
          }}
        />
        {brandFilter === "all" || showPriorYearLine ? <Legend /> : null}
        {barKeys.map((lbl) => (
          <Bar
            key={lbl}
            name={brandFilter === "all" ? lbl : String(year ?? "")}
            dataKey={lbl}
            stackId={brandFilter === "all" ? "ytd" : undefined}
            fill={lineColors[lbl] ?? "#8B97A4"}
            radius={
              brandFilter === "all"
                ? [0, 0, 0, 0]
                : ([4, 4, 0, 0] as [number, number, number, number])
            }
            maxBarSize={48}
          />
        ))}
        {showPriorYearLine ? (
          <Line
            type="monotone"
            dataKey={priorYearDataKey}
            name={String(previousYear)}
            stroke="#475569"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            legendType="line"
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
