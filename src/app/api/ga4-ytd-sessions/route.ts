import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchGA4WeeklySessionsYearToDateWithYoY } from "@/lib/ga4";
import { getCached, setCached, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";

/** YTD huidig jaar + zelfde segment vorig jaar — zie `@/lib/ga4`. */
const CACHE_KEY = "ga4-ytd-sessions-v4-weekly-yoy";

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const cached = await getCached<{
      rows: Awaited<ReturnType<typeof fetchGA4WeeklySessionsYearToDateWithYoY>>["current"];
      rowsPreviousYear: Awaited<ReturnType<typeof fetchGA4WeeklySessionsYearToDateWithYoY>>["previous"];
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
    const { current, previous } = await fetchGA4WeeklySessionsYearToDateWithYoY(accessToken, now);
    const year = now.getFullYear();
    const payload = {
      rows: current,
      rowsPreviousYear: previous,
      meta: { year, previousYear: year - 1 },
    };
    await setCached(CACHE_KEY, payload);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("GA4 YTD error:", err);
    return NextResponse.json(
      { error: "YTD-sessies ophalen mislukt" },
      { status: 500 }
    );
  }
}
