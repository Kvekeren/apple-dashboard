import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchDiscoverData,
  fetchGscSummariesByTitle,
  fetchSearchData,
} from "@/lib/search-console";
import { getCached, setCached, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { parseDashboardRangeFromRequest } from "@/lib/dashboard-date-range";

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const { startDate, endDate, periodKey } = parseDashboardRangeFromRequest(request);

  const cacheName = `search-console-v3-${periodKey}`;

  if (!forceRefresh) {
    const cached = await getCached<{
      discoverByUrl: Record<string, { clicks: number; impressions: number }>;
      searchWebByUrl: Record<string, { clicks: number; impressions: number }>;
      gscByTitle: Record<
        string,
        { web: { clicks: number; impressions: number }; discover: { clicks: number; impressions: number } }
      >;
      meta: { startDate: string; endDate: string };
    }>(cacheName, TTL.HOURS_2);
    if (cached) return NextResponse.json(cached);
  }

  const cookieStore = await cookies();
  const accessToken = await getGoogleAccessToken(cookieStore);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Niet verbonden met Search Console" },
      { status: 401 }
    );
  }

  try {
    const [discoverRows, searchRows, { byTitle }] = await Promise.all([
      fetchDiscoverData(accessToken, startDate, endDate),
      fetchSearchData(accessToken, startDate, endDate),
      fetchGscSummariesByTitle(accessToken, startDate, endDate),
    ]);

    const discoverByUrl = Object.fromEntries(
      discoverRows.map((r) => [r.url, { clicks: r.clicks, impressions: r.impressions }])
    );

    const searchWebByUrl = Object.fromEntries(
      searchRows.map((r) => [r.url, { clicks: r.clicks, impressions: r.impressions }])
    );

    const payload = {
      discoverByUrl,
      searchWebByUrl,
      gscByTitle: byTitle,
      meta: { startDate, endDate },
    };

    await setCached(cacheName, payload);

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Search Console fetch error:", err);
    return NextResponse.json(
      { error: "Search Console data ophalen mislukt" },
      { status: 500 }
    );
  }
}
