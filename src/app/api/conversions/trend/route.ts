import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  CONVERSION_CONFIG_VERSION,
  eventMetaForBrand,
  eventsForGroupFilter,
  getBrandConversionConfig,
  type ConversionGroupFilterId,
} from "@/config/conversion-events";
import { parseConversionRangeFromRequest } from "@/lib/conversion-date-range";
import {
  fetchGA4EventTrend,
  formatTrendKey,
} from "@/lib/ga4-conversions";
import { getCached, setCached, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import type { ConversionTrendPayload } from "@/lib/conversion-types";
import { getTitleById, type SiteTitleId } from "@/lib/site-titles";

function isoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const brandId = (sp.get("brand")?.trim() ?? "icreate") as SiteTitleId;
  const eventParam = sp.get("event")?.trim() ?? "";
  const groupParam = sp.get("group")?.trim() as ConversionGroupFilterId | undefined;
  const granularity = (sp.get("granularity")?.trim() ?? "day") as "day" | "week" | "month";

  const trendPreset = sp.get("preset")?.trim();
  let startDate: string;
  let endDate: string;

  if (trendPreset === "ytd" || !trendPreset) {
    const now = new Date();
    startDate = `${now.getFullYear()}-01-01`;
    endDate = isoDateLocal(now);
  } else {
    const range = parseConversionRangeFromRequest(request);
    startDate = range.startDate;
    endDate = range.endDate;
  }

  const cacheKey = `conversions-trend-v${CONVERSION_CONFIG_VERSION}-${brandId}-${eventParam}-${groupParam ?? ""}-${granularity}-${startDate}_${endDate}`;
  const forceRefresh = sp.get("refresh") === "1";

  const useCache = process.env.NODE_ENV !== "development";
  if (!forceRefresh && useCache) {
    const cached = await getCached<ConversionTrendPayload>(cacheKey, TTL.HOURS_24);
    if (cached) return NextResponse.json(cached);
  }

  const cookieStore = await cookies();
  const accessToken = await getGoogleAccessToken(cookieStore);
  if (!accessToken) {
    return NextResponse.json({ error: "Niet verbonden." }, { status: 401 });
  }

  const title = getTitleById(brandId);
  if (!title?.ga4PropertyId) {
    return NextResponse.json({ error: "GA4-property ontbreekt voor dit merk." }, { status: 404 });
  }

  let eventNames: string[] = [];
  let eventLabel = eventParam;

  if (groupParam && groupParam !== "all") {
    eventNames = eventsForGroupFilter(brandId, groupParam).map((e) => e.name);
    eventLabel = groupParam;
  } else if (eventParam) {
    eventNames = [eventParam];
    const meta = eventMetaForBrand(brandId);
    eventLabel = meta.get(eventParam)?.label ?? eventParam;
  } else {
    eventNames = getBrandConversionConfig(brandId).events.map((e) => e.name);
    eventLabel = "Alle conversies";
  }

  const rows = await fetchGA4EventTrend(
    accessToken,
    brandId,
    startDate,
    endDate,
    eventNames,
    granularity
  );

  const payload: ConversionTrendPayload = {
    meta: {
      brandId,
      brandLabel: title.label,
      eventName: eventParam || (groupParam ?? "all"),
      eventLabel,
      granularity,
      startDate,
      endDate,
    },
    points: rows.map((r) => ({
      date: formatTrendKey(r.key, granularity),
      eventCount: r.eventCount,
      pageviews: r.pageviews,
      ratioPer1000Pv: r.pageviews > 0 ? (r.eventCount / r.pageviews) * 1000 : null,
    })),
  };

  await setCached(cacheKey, payload);
  return NextResponse.json(payload);
}
