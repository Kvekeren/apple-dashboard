import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getCached, setCached, TTL } from "@/lib/api-cache";
import {
  getCurrentIsoWeekRange,
  getSameIsoWeekLastYearForWeek,
} from "@/lib/iso-week-range";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { fetchDiscoverData } from "@/lib/search-console";

const TOP_LIMIT = 30;

function resolveReferenceIsoWeek(weekParam: string | null): number | null {
  if (weekParam == null || weekParam === "") {
    return getCurrentIsoWeekRange().isoWeek;
  }
  const parsed = Number.parseInt(weekParam, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 53) return null;
  return parsed;
}

async function loadPayload(accessToken: string, referenceIsoWeek: number) {
  const range = getSameIsoWeekLastYearForWeek(referenceIsoWeek);
  const rows = await fetchDiscoverData(accessToken, range.startDate, range.endDate);

  const discoverByUrl = Object.fromEntries(
    rows
      .filter((r) => r.impressions > 0)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, TOP_LIMIT * 3)
      .map((r) => [r.url, { clicks: r.clicks, impressions: r.impressions }])
  );

  const current = getCurrentIsoWeekRange();
  return {
    meta: {
      ...range,
      currentIsoWeek: referenceIsoWeek,
      currentIsoWeekYear: current.isoWeekYear,
    },
    discoverByUrl,
  };
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const referenceIsoWeek = resolveReferenceIsoWeek(
    request.nextUrl.searchParams.get("week")
  );

  if (referenceIsoWeek == null) {
    return NextResponse.json({ error: "Ongeldige week" }, { status: 400 });
  }

  const range = getSameIsoWeekLastYearForWeek(referenceIsoWeek);
  const cacheKey = `discover-yoy-week-ref${referenceIsoWeek}-w${range.isoWeek}-${range.isoWeekYear}`;

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
    const payload = await loadPayload(accessToken, referenceIsoWeek);
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
