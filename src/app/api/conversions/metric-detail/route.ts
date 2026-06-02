import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  CONVERSION_CONFIG_VERSION,
  getEngagementMetricDef,
} from "@/config/conversion-events";
import { parseConversionRangeFromRequest } from "@/lib/conversion-date-range";
import { engagementMetricValue } from "@/lib/conversion-metrics";
import {
  fetchGA4BaseMetrics,
  fetchGA4BaseMetricsDaily,
} from "@/lib/ga4-conversions";
import { getCached, setCached, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import type { ConversionEngagementMetricDetail } from "@/lib/conversion-types";
import { getTitleById, type SiteTitleId } from "@/lib/site-titles";

function formatTrendDate(iso: string): string {
  if (iso.length !== 8) return iso;
  return `${iso.slice(6, 8)}-${iso.slice(4, 6)}`;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const brandId = (sp.get("brand")?.trim() ?? "icreate") as SiteTitleId;
  const metricId = sp.get("metric")?.trim() ?? "";
  const forceRefresh = sp.get("refresh") === "1";

  if (!metricId) {
    return NextResponse.json({ error: "Metric-ID ontbreekt." }, { status: 400 });
  }

  const def = getEngagementMetricDef(brandId, metricId);
  if (!def) {
    return NextResponse.json({ error: "Onbekende engagement-metric." }, { status: 404 });
  }

  const range = parseConversionRangeFromRequest(request);
  const cacheKey = `conversions-metric-detail-v${CONVERSION_CONFIG_VERSION}-${brandId}-${metricId}-${range.periodKey}`;

  const useCache = process.env.NODE_ENV !== "development";
  if (!forceRefresh && useCache) {
    const cached = await getCached<ConversionEngagementMetricDetail>(cacheKey, TTL.HOURS_24);
    if (cached) return NextResponse.json(cached);
  }

  const cookieStore = await cookies();
  const accessToken = await getGoogleAccessToken(cookieStore);
  if (!accessToken) {
    return NextResponse.json({ error: "Niet verbonden." }, { status: 401 });
  }

  const title = getTitleById(brandId);
  if (!title?.ga4PropertyId) {
    return NextResponse.json({ error: "GA4-property ontbreekt." }, { status: 404 });
  }

  const [baseCurrent, basePrevious, daily] = await Promise.all([
    fetchGA4BaseMetrics(accessToken, brandId, range.startDate, range.endDate),
    fetchGA4BaseMetrics(
      accessToken,
      brandId,
      range.previous.startDate,
      range.previous.endDate
    ),
    fetchGA4BaseMetricsDaily(accessToken, brandId, range.startDate, range.endDate),
  ]);

  const current = engagementMetricValue(baseCurrent, def.metric);
  const previous = engagementMetricValue(basePrevious, def.metric);
  const change = current - previous;
  const changePercent = previous > 0 ? Math.round((change / previous) * 100) : null;

  const payload: ConversionEngagementMetricDetail = {
    metricId: def.id,
    label: def.label,
    format: def.format,
    current,
    previous,
    change,
    changePercent,
    compareMode: range.compareMode,
    periods: {
      current: { startDate: range.startDate, endDate: range.endDate },
      previous: range.previous,
    },
    trend: daily
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        date: formatTrendDate(row.date),
        value: engagementMetricValue(row, def.metric),
      })),
  };

  await setCached(cacheKey, payload);
  return NextResponse.json(payload);
}
