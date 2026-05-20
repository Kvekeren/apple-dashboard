import type { NextRequest } from "next/server";

import {
  getCurrentCalendarMonthRange,
  getDateRange,
  getDateRangeOffset,
} from "@/lib/search-console";

export interface ParsedDashboardRange {
  startDate: string;
  endDate: string;
  /** Sleutel voor cache-keys */
  periodKey: string;
  previous: { startDate: string; endDate: string };
}

/** Zelfde kalenderperiode één jaar eerder (voor YoY). */
export function samePeriodLastYear(
  startDate: string,
  endDate: string
): { startDate: string; endDate: string } {
  const shiftYear = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  };
  return { startDate: shiftYear(startDate), endDate: shiftYear(endDate) };
}

function withComparisonPeriod(
  base: ParsedDashboardRange,
  compareYoY: boolean
): ParsedDashboardRange {
  if (!compareYoY) return base;
  return {
    ...base,
    periodKey: `${base.periodKey}-yoy`,
    previous: samePeriodLastYear(base.startDate, base.endDate),
  };
}

/** Zelfde logica als `/api/search-console` voor tijdsvenster (preset / days / expliciete datums). */
export function parseDashboardRangeFromRequest(request: NextRequest): ParsedDashboardRange {
  const sp = request.nextUrl.searchParams;
  const compareYoY = sp.get("compare") === "yoy";
  const start = sp.get("startDate")?.trim();
  const end = sp.get("endDate")?.trim();
  if (start && end && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end) {
    const startD = new Date(start + "T12:00:00");
    const endD = new Date(end + "T12:00:00");
    const spanDays =
      Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    const prevEnd = new Date(startD);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (spanDays - 1));
    return withComparisonPeriod(
      {
        startDate: start,
        endDate: end,
        periodKey: `${start}_${end}`,
        previous: {
          startDate: prevStart.toISOString().slice(0, 10),
          endDate: prevEnd.toISOString().slice(0, 10),
        },
      },
      compareYoY
    );
  }

  const preset = sp.get("preset")?.trim();
  if (preset === "month") {
    const current = getCurrentCalendarMonthRange();
    const startD = new Date(`${current.startDate}T12:00:00`);
    const endD = new Date(`${current.endDate}T12:00:00`);
    const spanDays =
      Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    const prevEnd = new Date(startD);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (spanDays - 1));
    return withComparisonPeriod(
      {
        ...current,
        periodKey: `month-${current.startDate}_${current.endDate}`,
        previous: {
          startDate: prevStart.toISOString().slice(0, 10),
          endDate: prevEnd.toISOString().slice(0, 10),
        },
      },
      compareYoY
    );
  }

  const days = Math.min(366, Math.max(1, parseInt(sp.get("days") ?? "7", 10)));
  const current = getDateRange(days);
  const previousRange = getDateRangeOffset(days, days);
  return withComparisonPeriod(
    {
      ...current,
      periodKey: `${days}d`,
      previous: previousRange,
    },
    compareYoY
  );
}
