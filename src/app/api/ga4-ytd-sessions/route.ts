import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchGA4WeeklySessionsYearToDateWithYoY, type GA4WeeklySessionsRow } from "@/lib/ga4";
import { getCached, setCached, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";

/**
 * YTD huidig jaar + zelfde segment vorig jaar — zie `@/lib/ga4`.
 * `rows` = pageviews (screenPageViews); `newsletter` = sessies met nieuwsbrief-herkomst (bron nieuwsbrief_*, medium email, kanaal Email).
 */
const CACHE_KEY = "ga4-ytd-v5-pageviews-newsletter";

export const maxDuration = 60;

type Payload = {
  rows: GA4WeeklySessionsRow[];
  rowsPreviousYear: GA4WeeklySessionsRow[];
  newsletter: { rows: GA4WeeklySessionsRow[]; rowsPreviousYear: GA4WeeklySessionsRow[] };
  meta: { year: number; previousYear: number };
};

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const cached = await getCached<Payload>(CACHE_KEY, TTL.HOURS_24);
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
    const [pageviews, newsletter] = await Promise.all([
      fetchGA4WeeklySessionsYearToDateWithYoY(accessToken, now, { metric: "screenPageViews" }),
      fetchGA4WeeklySessionsYearToDateWithYoY(accessToken, now, {
        metric: "sessions",
        newsletterOnly: true,
      }),
    ]);
    const year = now.getFullYear();
    const payload: Payload = {
      rows: pageviews.current,
      rowsPreviousYear: pageviews.previous,
      newsletter: { rows: newsletter.current, rowsPreviousYear: newsletter.previous },
      meta: { year, previousYear: year - 1 },
    };
    await setCached(CACHE_KEY, payload);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("GA4 YTD error:", err);
    return NextResponse.json(
      { error: "YTD-cijfers ophalen mislukt" },
      { status: 500 }
    );
  }
}
