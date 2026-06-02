import type { ConversionDisplayFormat } from "@/lib/conversion-types";

export function formatDurationSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 s";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatConversionValue(
  value: number,
  format: ConversionDisplayFormat
): string {
  if (format === "duration") return formatDurationSeconds(value);
  if (format === "percent") return `${value.toFixed(2).replace(".", ",")}%`;
  if (format === "decimal") return value.toFixed(2).replace(".", ",");
  return value.toLocaleString("nl-NL");
}

export const CONVERSION_METRIC_ROW_PREFIX = "__metric:";

export function conversionMetricRowName(metricId: string): string {
  return `${CONVERSION_METRIC_ROW_PREFIX}${metricId}`;
}

export function isConversionMetricRow(eventName: string): boolean {
  return eventName.startsWith(CONVERSION_METRIC_ROW_PREFIX);
}

export function parseConversionMetricRowId(eventName: string): string | null {
  if (!isConversionMetricRow(eventName)) return null;
  return eventName.slice(CONVERSION_METRIC_ROW_PREFIX.length);
}
