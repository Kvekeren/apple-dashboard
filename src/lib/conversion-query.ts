import type { ConversionCompareMode, ConversionPeriodPreset } from "@/lib/conversion-types";

export function conversionApiQuery(params: {
  brand: string;
  preset: ConversionPeriodPreset;
  customStart: string;
  customEnd: string;
  compareMode: ConversionCompareMode;
  groupFilter: string;
}): string {
  const q = new URLSearchParams();
  q.set("brand", params.brand);
  q.set("group", params.groupFilter);
  q.set("compare", params.compareMode === "yoy" ? "yoy" : "previous");

  if (params.preset === "custom" && params.customStart && params.customEnd) {
    q.set("startDate", params.customStart);
    q.set("endDate", params.customEnd);
  } else if (params.preset === "today" || params.preset === "yesterday" || params.preset === "ytd") {
    q.set("preset", params.preset);
  } else if (params.preset === "28d") {
    q.set("days", "28");
  } else if (params.preset === "7d") {
    q.set("days", "7");
  } else {
    q.set("days", "7");
  }

  return q.toString();
}

export function conversionTrendApiQuery(params: {
  brand: string;
  eventName: string;
  granularity: "day" | "week" | "month";
  preset?: ConversionPeriodPreset;
}): string {
  const q = new URLSearchParams();
  q.set("brand", params.brand);
  q.set("event", params.eventName);
  q.set("granularity", params.granularity);
  q.set("preset", params.preset ?? "ytd");
  return q.toString();
}

export function conversionEventDetailApiQuery(params: {
  brand: string;
  eventName: string;
  preset: ConversionPeriodPreset;
  customStart: string;
  customEnd: string;
  compareMode?: ConversionCompareMode;
}): string {
  const base = conversionApiQuery({
    brand: params.brand,
    preset: params.preset,
    customStart: params.customStart,
    customEnd: params.customEnd,
    compareMode: params.compareMode ?? "previous",
    groupFilter: "all",
  });
  return `${base}&event=${encodeURIComponent(params.eventName)}`;
}

export function conversionMetricDetailApiQuery(params: {
  brand: string;
  metricId: string;
  preset: ConversionPeriodPreset;
  customStart: string;
  customEnd: string;
  compareMode?: ConversionCompareMode;
}): string {
  const base = conversionApiQuery({
    brand: params.brand,
    preset: params.preset,
    customStart: params.customStart,
    customEnd: params.customEnd,
    compareMode: params.compareMode ?? "previous",
    groupFilter: "all",
  });
  return `${base}&metric=${encodeURIComponent(params.metricId)}`;
}
