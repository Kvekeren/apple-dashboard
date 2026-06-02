import type { NextRequest } from "next/server";

import {
  parseDashboardRangeFromRequest,
  samePeriodLastYear,
  type ParsedDashboardRange,
} from "@/lib/dashboard-date-range";
import type { ConversionCompareMode, ConversionPeriodPreset } from "@/lib/conversion-types";

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function previousPeriod(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const startD = new Date(`${startDate}T12:00:00`);
  const endD = new Date(`${endDate}T12:00:00`);
  const spanDays =
    Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const prevEnd = new Date(startD);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (spanDays - 1));
  return {
    startDate: isoDateLocal(prevStart),
    endDate: isoDateLocal(prevEnd),
  };
}

export interface ParsedConversionRange extends ParsedDashboardRange {
  preset: ConversionPeriodPreset;
  compareMode: ConversionCompareMode;
}

export function parseConversionRangeFromRequest(request: NextRequest): ParsedConversionRange {
  const sp = request.nextUrl.searchParams;
  const compareMode: ConversionCompareMode = sp.get("compare") === "yoy" ? "yoy" : "previous";
  const presetParam = sp.get("preset")?.trim() as ConversionPeriodPreset | undefined;

  if (presetParam === "today") {
    const today = isoDateLocal(new Date());
    const base = {
      startDate: today,
      endDate: today,
      periodKey: `today-${today}`,
      previous: previousPeriod(today, today),
    };
    return {
      ...base,
      previous: compareMode === "yoy" ? samePeriodLastYear(today, today) : base.previous,
      periodKey: compareMode === "yoy" ? `${base.periodKey}-yoy` : base.periodKey,
      preset: "today",
      compareMode,
    };
  }

  if (presetParam === "yesterday") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = isoDateLocal(d);
    const base = {
      startDate: yesterday,
      endDate: yesterday,
      periodKey: `yesterday-${yesterday}`,
      previous: previousPeriod(yesterday, yesterday),
    };
    return {
      ...base,
      previous: compareMode === "yoy" ? samePeriodLastYear(yesterday, yesterday) : base.previous,
      periodKey: compareMode === "yoy" ? `${base.periodKey}-yoy` : base.periodKey,
      preset: "yesterday",
      compareMode,
    };
  }

  if (presetParam === "ytd") {
    const now = new Date();
    const startDate = `${now.getFullYear()}-01-01`;
    const endDate = isoDateLocal(now);
    const base = {
      startDate,
      endDate,
      periodKey: `ytd-${startDate}_${endDate}`,
      previous: previousPeriod(startDate, endDate),
    };
    return {
      ...base,
      previous: compareMode === "yoy" ? samePeriodLastYear(startDate, endDate) : base.previous,
      periodKey: compareMode === "yoy" ? `${base.periodKey}-yoy` : base.periodKey,
      preset: "ytd",
      compareMode,
    };
  }

  const parsed = parseDashboardRangeFromRequest(request);
  const preset: ConversionPeriodPreset =
    presetParam === "28d"
      ? "28d"
      : presetParam === "7d"
        ? "7d"
        : sp.get("startDate") && sp.get("endDate")
          ? "custom"
          : "7d";

  return {
    ...parsed,
    previous:
      compareMode === "yoy"
        ? samePeriodLastYear(parsed.startDate, parsed.endDate)
        : parsed.previous,
    periodKey: compareMode === "yoy" ? `${parsed.periodKey}-yoy` : parsed.periodKey,
    preset,
    compareMode,
  };
}
