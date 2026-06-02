import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchGscWeeklyClicksYearToDateWithYoY,
  type GscWeeklyClicksRow,
} from "@/lib/search-console";
import { getCached, setCached, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";

const CACHE_KEY = "gsc-ytd-clicks-v1-weekly-yoy";

type ChannelPayload = {
  rows: GscWeeklyClicksRow[];
  rowsPreviousYear: GscWeeklyClicksRow[];
};

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const cached = await getCached<{
      discover: ChannelPayload;
      search: ChannelPayload;
      meta: { year: number; previousYear: number };
    }>(CACHE_KEY, TTL.HOURS_24);
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

  try {
    const now = new Date();
    const year = now.getFullYear();
    const [discover, search] = await Promise.all([
      fetchGscWeeklyClicksYearToDateWithYoY(accessToken, "discover", now),
      fetchGscWeeklyClicksYearToDateWithYoY(accessToken, "web", now),
    ]);

    const payload = {
      discover: {
        rows: discover.current,
        rowsPreviousYear: discover.previous,
      },
      search: {
        rows: search.current,
        rowsPreviousYear: search.previous,
      },
      meta: { year, previousYear: year - 1 },
    };
    await setCached(CACHE_KEY, payload);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("GSC YTD clicks error:", err);
    return NextResponse.json(
      { error: "GSC YTD-clicks ophalen mislukt" },
      { status: 500 }
    );
  }
}
