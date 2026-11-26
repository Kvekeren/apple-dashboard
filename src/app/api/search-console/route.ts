import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchDiscoverData,
  fetchGscSummariesByTitle,
  fetchSearchData,
} from "@/lib/search-console";
import { cachedWithRevalidate, NotConnectedError, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { parseDashboardRangeFromRequest } from "@/lib/dashboard-date-range";

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const { startDate, endDate, periodKey } = parseDashboardRangeFromRequest(request);

  const cacheName = `search-console-v3-${periodKey}`;

  const cookieStore = await cookies();
  try {
    const { data, cache } = await cachedWithRevalidate(
      cacheName,
      TTL.HOURS_2,
      () => getGoogleAccessToken(cookieStore),
      async (accessToken) => {
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

      return payload;
      },
      { force: forceRefresh }
    );
    return NextResponse.json(data, { headers: { "X-Cache": cache } });
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: "Niet verbonden met Google." }, { status: 401 });
    }
    console.error("Search Console fetch error:", err);
    return NextResponse.json(
      { error: "Search Console data ophalen mislukt" },
      { status: 500 }
    );
  }
}
