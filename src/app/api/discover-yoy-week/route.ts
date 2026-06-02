import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getCached, setCached, TTL } from "@/lib/api-cache";
import { getSameIsoWeekLastYear, getCurrentIsoWeekRange } from "@/lib/iso-week-range";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { fetchDiscoverData } from "@/lib/search-console";

const TOP_LIMIT = 30;

async function loadPayload(accessToken: string) {
  const current = getCurrentIsoWeekRange();
  const range = getSameIsoWeekLastYear();
  const rows = await fetchDiscoverData(accessToken, range.startDate, range.endDate);

  const discoverByUrl = Object.fromEntries(
    rows
      .filter((r) => r.impressions > 0)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, TOP_LIMIT * 3)
      .map((r) => [r.url, { clicks: r.clicks, impressions: r.impressions }])
  );

  return {
    meta: {
      ...range,
      currentIsoWeek: current.isoWeek,
      currentIsoWeekYear: current.isoWeekYear,
    },
    discoverByUrl,
  };
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const range = getSameIsoWeekLastYear();
  const cacheKey = `discover-yoy-week-w${range.isoWeek}-${range.isoWeekYear}`;

  if (!forceRefresh) {
    const cached = await getCached<Awaited<ReturnType<typeof loadPayload>>>(cacheKey, TTL.HOURS_2);
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
    const payload = await loadPayload(accessToken);
    await setCached(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("Discover YoY week fetch error:", err);
    return NextResponse.json(
      { error: "Discover vorig jaar ophalen mislukt" },
      { status: 500 }
    );
  }
}
