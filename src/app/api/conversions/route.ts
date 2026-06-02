import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  CONVERSION_CONFIG_VERSION,
  eventNamesForBrand,
  eventsForGroupFilter,
  getBrandConversionConfig,
  type ConversionGroupFilterId,
} from "@/config/conversion-events";
import { assembleConversionSummary } from "@/lib/conversion-metrics";
import { parseConversionRangeFromRequest } from "@/lib/conversion-date-range";
import {
  EMPTY_GA4_BASE_METRICS,
  fetchGA4BaseMetrics,
  fetchGA4BaseMetricsDaily,
  fetchGA4EventsByName,
  fetchGA4EventsByPage,
  fetchGA4EventsDaily,
  fetchGA4PageviewsByPage,
} from "@/lib/ga4-conversions";
import { getCached, setCached, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import type { ConversionSummaryPayload } from "@/lib/conversion-types";
import { getTitleById, type SiteTitleId } from "@/lib/site-titles";

const VALID_BRANDS: SiteTitleId[] = ["icreate", "iphoned", "iculture"];
const VALID_GROUPS: ConversionGroupFilterId[] = [
  "all",
  "engagement",
  "affiliate",
  "advertenties",
  "leads",
  "paywall",
  "search",
  "intern",
  "uitgaand",
];

function parseBrand(sp: URLSearchParams): SiteTitleId {
  const raw = sp.get("brand")?.trim() ?? "icreate";
  return VALID_BRANDS.includes(raw as SiteTitleId) ? (raw as SiteTitleId) : "icreate";
}

function parseGroup(sp: URLSearchParams): ConversionGroupFilterId {
  const raw = sp.get("group")?.trim() ?? "all";
  return VALID_GROUPS.includes(raw as ConversionGroupFilterId)
    ? (raw as ConversionGroupFilterId)
    : "all";
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const brandId = parseBrand(request.nextUrl.searchParams);
  const groupFilter = parseGroup(request.nextUrl.searchParams);
  const range = parseConversionRangeFromRequest(request);
  const cacheKey = `conversions-v${CONVERSION_CONFIG_VERSION}-${brandId}-${groupFilter}-${range.periodKey}`;

  const useCache = process.env.NODE_ENV !== "development";
  if (!forceRefresh && useCache) {
    const cached = await getCached<ConversionSummaryPayload>(cacheKey, TTL.HOURS_24);
    if (cached) return NextResponse.json(cached);
  }

  const cookieStore = await cookies();
  const accessToken = await getGoogleAccessToken(cookieStore);
  if (!accessToken) {
    return NextResponse.json(
      { error: "Niet verbonden. Log in via Search Console." },
      { status: 401 }
    );
  }

  const title = getTitleById(brandId);
  const hasGa4Property = Boolean(title?.ga4PropertyId);

  if (!hasGa4Property) {
    const empty: ConversionSummaryPayload = {
      meta: {
        brandId,
        brandLabel: title?.label ?? brandId,
        hasGa4Property: false,
        compareMode: range.compareMode,
        groupFilter,
        periods: {
          current: { startDate: range.startDate, endDate: range.endDate },
          previous: range.previous,
        },
      },
      baseMetrics: {
        pageviews: { current: 0, previous: 0, change: 0, changePercent: null },
        sessions: { current: 0, previous: 0, change: 0, changePercent: null },
      },
      kpis: [],
      events: [],
      funnels: [],
      topPages: [],
    };
    return NextResponse.json(empty);
  }

  const allEventNames = eventNamesForBrand(brandId);
  const filteredNames = eventsForGroupFilter(brandId, groupFilter).map((e) => e.name);
  const pageEventNames = [...new Set([...allEventNames, ...filteredNames])];
  const needsBaseDaily =
    (getBrandConversionConfig(brandId).engagementMetrics?.length ?? 0) > 0;

  const [
    baseCurrent,
    basePrevious,
    currentRows,
    previousRows,
    dailyRows,
    baseDaily,
    pageEventRows,
    prevPageEventRows,
    pageviewRows,
  ] = await Promise.all([
    fetchGA4BaseMetrics(accessToken, brandId, range.startDate, range.endDate),
    fetchGA4BaseMetrics(accessToken, brandId, range.previous.startDate, range.previous.endDate),
    fetchGA4EventsByName(accessToken, brandId, range.startDate, range.endDate, allEventNames),
    fetchGA4EventsByName(
      accessToken,
      brandId,
      range.previous.startDate,
      range.previous.endDate,
      allEventNames
    ),
    fetchGA4EventsDaily(accessToken, brandId, range.startDate, range.endDate, filteredNames),
    needsBaseDaily
      ? fetchGA4BaseMetricsDaily(accessToken, brandId, range.startDate, range.endDate)
      : Promise.resolve([]),
    fetchGA4EventsByPage(accessToken, brandId, range.startDate, range.endDate, pageEventNames, 300),
    fetchGA4EventsByPage(
      accessToken,
      brandId,
      range.previous.startDate,
      range.previous.endDate,
      pageEventNames,
      300
    ),
    fetchGA4PageviewsByPage(accessToken, brandId, range.startDate, range.endDate, 300),
  ]);

  const payload = assembleConversionSummary(
    brandId,
    title!.label,
    hasGa4Property,
    range.compareMode,
    groupFilter,
    {
      current: { startDate: range.startDate, endDate: range.endDate },
      previous: range.previous,
    },
    currentRows,
    previousRows,
    dailyRows,
    baseCurrent,
    basePrevious,
    baseDaily,
    pageEventRows,
    prevPageEventRows,
    pageviewRows
  );

  await setCached(cacheKey, payload);
  return NextResponse.json(payload);
}
