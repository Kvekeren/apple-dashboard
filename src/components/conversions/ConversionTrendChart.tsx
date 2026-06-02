"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConversionTrendPayload } from "@/lib/conversion-types";

export function ConversionTrendChart({
  data,
  loading,
  error,
  selectedEvent,
  selectedGroup,
  granularity,
  onEventChange,
  onGroupChange,
  onGranularityChange,
  eventOptions,
  groupOptions,
}: {
  data: ConversionTrendPayload | null;
  loading: boolean;
  error: string | null;
  selectedEvent: string;
  selectedGroup: string;
  granularity: "day" | "week" | "month";
  onEventChange: (event: string) => void;
  onGroupChange: (group: string) => void;
  onGranularityChange: (g: "day" | "week" | "month") => void;
  eventOptions: { name: string; label: string }[];
  groupOptions: { id: string; label: string }[];
}) {
  const chartData = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        label: p.date,
        events: p.eventCount,
        ratio: p.ratioPer1000Pv ?? 0,
      })),
    [data]
  );

  return (
    <section className="fnl-card p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="fnl-section-title">Verloop van conversie-event</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Standaard: dit jaar tot nu toe. Kies event of eventgroep.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedGroup} onValueChange={onGroupChange}>
            <SelectTrigger size="sm" className="h-8 w-[180px] rounded-[4px]">
              <SelectValue placeholder="Eventgroep" />
            </SelectTrigger>
            <SelectContent>
              {groupOptions.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedEvent}
            onValueChange={onEventChange}
            disabled={selectedGroup !== "all"}
          >
            <SelectTrigger size="sm" className="h-8 w-[200px] rounded-[4px]">
              <SelectValue placeholder="Event" />
            </SelectTrigger>
            <SelectContent>
              {eventOptions.map((e) => (
                <SelectItem key={e.name} value={e.name}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={granularity}
            onValueChange={(v) => onGranularityChange(v as "day" | "week" | "month")}
          >
            <SelectTrigger size="sm" className="h-8 w-[120px] rounded-[4px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Dag</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Maand</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Trend laden…
        </div>
      ) : error ? (
        <div className="flex h-64 items-center justify-center text-sm text-[var(--fnl-danger)]">
          {error}
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Onvoldoende data voor trendanalyse.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DCE7F0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--fnl-ink-3)", fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "var(--fnl-ink-3)", fontSize: 11 }}
              tickFormatter={(v) => Number(v).toLocaleString("nl-NL")}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "var(--fnl-ink-3)", fontSize: 11 }}
            />
            <Tooltip
              formatter={(value, name) => [
                typeof value === "number" ? value.toLocaleString("nl-NL") : String(value),
                String(name),
              ]}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="events"
              name="Aantal events"
              stroke="#004077"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="ratio"
              name="Per 1.000 pageviews"
              stroke="#F97D23"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
