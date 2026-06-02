import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { conversionEventGroupForName } from "@/lib/conversion-metrics";
import { parseConversionRangeFromRequest } from "@/lib/conversion-date-range";
import {
  fetchGA4BaseMetrics,
  fetchGA4EventBreakdown,
  fetchGA4EventsByName,
  fetchGA4EventsByPage,
  fetchGA4EventTrend,
  formatTrendKey,
} from "@/lib/ga4-conversions";
import { getCached, setCached, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import type { ConversionEventDetail } from "@/lib/conversion-types";
import { getTitleById, type SiteTitleId } from "@/lib/site-titles";
import { CONVERSION_CONFIG_VERSION, eventMetaForBrand } from "@/config/conversion-events";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const brandId = (sp.get("brand")?.trim() ?? "icreate") as SiteTitleId;
  const eventName = sp.get("event")?.trim() ?? "";
  const forceRefresh = sp.get("refresh") === "1";

  if (!eventName) {
    return NextResponse.json({ error: "Eventnaam ontbreekt." }, { status: 400 });
  }

  const range = parseConversionRangeFromRequest(request);
  const cacheKey = `conversions-detail-v${CONVERSION_CONFIG_VERSION}-${brandId}-${eventName}-${range.periodKey}`;

  const useCache = process.env.NODE_ENV !== "development";
  if (!forceRefresh && useCache) {
    const cached = await getCached<ConversionEventDetail>(cacheKey, TTL.HOURS_24);
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

  const meta = eventMetaForBrand(brandId);
  const eventLabel = meta.get(eventName)?.label ?? eventName;

  const [eventRows, baseMetrics, pageRows, trendRows, sources, devices] = await Promise.all([
    fetchGA4EventsByName(accessToken, brandId, range.startDate, range.endDate, [eventName]),
    fetchGA4BaseMetrics(accessToken, brandId, range.startDate, range.endDate),
    fetchGA4EventsByPage(accessToken, brandId, range.startDate, range.endDate, [eventName], 15),
    fetchGA4EventTrend(
      accessToken,
      brandId,
      range.startDate,
      range.endDate,
      [eventName],
      "day"
    ),
    fetchGA4EventBreakdown(
      accessToken,
      brandId,
      range.startDate,
      range.endDate,
      eventName,
      "sessionSourceMedium"
    ),
    fetchGA4EventBreakdown(
      accessToken,
      brandId,
      range.startDate,
      range.endDate,
      eventName,
      "deviceCategory"
    ),
  ]);

  const row = eventRows[0];
  const eventCount = row?.eventCount ?? 0;
  const totalUsers = row?.totalUsers ?? 0;
  const totalDeviceEvents = devices.reduce((s, d) => s + d.eventCount, 0);

  const payload: ConversionEventDetail = {
    eventName,
    eventLabel,
    eventGroup: conversionEventGroupForName(brandId, eventName),
    eventCount,
    totalUsers,
    eventsPerUser: totalUsers > 0 ? eventCount / totalUsers : null,
    conversionRate:
      baseMetrics.sessions > 0 ? (eventCount / baseMetrics.sessions) * 100 : null,
    revenue: row?.revenue ?? 0,
    trend: trendRows.map((r) => ({
      date: formatTrendKey(r.key, "day"),
      eventCount: r.eventCount,
      pageviews: r.pageviews,
      ratioPer1000Pv: r.pageviews > 0 ? (r.eventCount / r.pageviews) * 1000 : null,
    })),
    topPages: pageRows.map((p) => ({
      url: p.pageLocation,
      pageTitle: p.pageTitle,
      eventCount: p.eventCount,
    })),
    topSources: sources.map((s) => ({
      source: s.dimension,
      eventCount: s.eventCount,
    })),
    devices: devices.map((d) => ({
      device: d.dimension,
      eventCount: d.eventCount,
      share: totalDeviceEvents > 0 ? (d.eventCount / totalDeviceEvents) * 100 : 0,
    })),
  };

  await setCached(cacheKey, payload);
  return NextResponse.json(payload);
}
