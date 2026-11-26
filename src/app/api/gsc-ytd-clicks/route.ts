import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchGscWeeklyClicksYearToDateWithYoY } from "@/lib/search-console";
import { cachedWithRevalidate, NotConnectedError, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";

const CACHE_KEY = "gsc-ytd-clicks-v1-weekly-yoy";

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  const cookieStore = await cookies();
  try {
    const { data, cache } = await cachedWithRevalidate(
      CACHE_KEY,
      TTL.HOURS_24,
      () => getGoogleAccessToken(cookieStore),
      async (accessToken) => {
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
      return payload;
      },
      { force: forceRefresh }
    );
    return NextResponse.json(data, { headers: { "X-Cache": cache } });
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: "Niet verbonden met Google." }, { status: 401 });
    }
    console.error("GSC YTD clicks error:", err);
    return NextResponse.json(
      { error: "GSC YTD-clicks ophalen mislukt" },
      { status: 500 }
    );
  }
}
