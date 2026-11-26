import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { fetchAgendaFeed } from "@/lib/agenda-feed";
import { agendaUrlKey } from "@/lib/agenda-url";
import { getCached, setCached, TTL } from "@/lib/api-cache";
import { parseDashboardRangeFromRequest } from "@/lib/dashboard-date-range";
import { fetchGA4PageviewsForUrls, fetchGA4TopPagesByScreenViews } from "@/lib/ga4";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { fetchDiscoverData, fetchSearchData } from "@/lib/search-console";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type AgendaMetricRow = {
  pageviews?: number;
  discoverClicks: number;
  organicClicks: number;
};

type Payload = {
  connected: boolean;
  meta: { startDate: string; endDate: string };
  byUrl: Record<string, AgendaMetricRow>;
};

function bump(
  map: Record<string, AgendaMetricRow>,
  url: string,
  patch: Partial<AgendaMetricRow>
) {
  const key = agendaUrlKey(url);
  if (!key) return;
  const prev = map[key] ?? { discoverClicks: 0, organicClicks: 0 };
  map[key] = {
    pageviews:
      patch.pageviews != null ? (prev.pageviews ?? 0) + patch.pageviews : prev.pageviews,
    discoverClicks: prev.discoverClicks + (patch.discoverClicks ?? 0),
    organicClicks: prev.organicClicks + (patch.organicClicks ?? 0),
  };
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const url = request.nextUrl.clone();
  if (!url.searchParams.get("days") && !url.searchParams.get("startDate") && !url.searchParams.get("preset")) {
    url.searchParams.set("days", "28");
  }
  const { startDate, endDate, periodKey } = parseDashboardRangeFromRequest({
    nextUrl: url,
  } as NextRequest);
  const cacheKey = `agenda-metrics-v2-${periodKey}`;

  if (!forceRefresh) {
    const cached = await getCached<Payload>(cacheKey, TTL.HOURS_2);
    if (cached?.connected) return NextResponse.json(cached);
  }

  const cookieStore = await cookies();
  const accessToken = await getGoogleAccessToken(cookieStore);

  if (!accessToken) {
    return NextResponse.json({
      connected: false,
      meta: { startDate, endDate },
      byUrl: {},
    } satisfies Payload);
  }

  try {
    const [ga4Rows, discoverRows, searchRows, feed] = await Promise.all([
      fetchGA4TopPagesByScreenViews(accessToken, startDate, endDate, 400),
      fetchDiscoverData(accessToken, startDate, endDate),
      fetchSearchData(accessToken, startDate, endDate),
      fetchAgendaFeed().catch((err) => {
        console.error("agenda-metrics feed", err);
        return { articles: [] as { url: string }[] };
      }),
    ]);

    const byUrl: Record<string, AgendaMetricRow> = {};
    for (const row of ga4Rows) bump(byUrl, row.url, { pageviews: row.screenPageViews });
    for (const row of discoverRows) bump(byUrl, row.url, { discoverClicks: row.clicks });
    for (const row of searchRows) bump(byUrl, row.url, { organicClicks: row.clicks });

    const missingUrls: string[] = [];
    const seenMissing = new Set<string>();
    for (const article of feed.articles) {
      if (!article.url) continue;
      const key = agendaUrlKey(article.url);
      if (!key || seenMissing.has(key) || byUrl[key]?.pageviews != null) continue;
      seenMissing.add(key);
      missingUrls.push(article.url);
    }

    if (missingUrls.length) {
      const extra = await fetchGA4PageviewsForUrls(accessToken, startDate, endDate, missingUrls);
      for (const row of extra) bump(byUrl, row.url, { pageviews: row.screenPageViews });
    }

    const payload: Payload = {
      connected: true,
      meta: { startDate, endDate },
      byUrl,
    };
    await setCached(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("agenda-metrics", err);
    return NextResponse.json(
      { connected: false, meta: { startDate, endDate }, byUrl: {}, error: "metrics_failed" },
      { status: 500 }
    );
  }
}
