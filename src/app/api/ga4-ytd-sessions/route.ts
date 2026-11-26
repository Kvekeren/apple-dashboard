import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchGA4WeeklySessionsYearToDateWithYoY, type GA4WeeklySessionsRow } from "@/lib/ga4";
import { cachedWithRevalidate, NotConnectedError, TTL } from "@/lib/api-cache";
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

  const cookieStore = await cookies();
  try {
    const { data, cache } = await cachedWithRevalidate(
      CACHE_KEY,
      TTL.HOURS_24,
      () => getGoogleAccessToken(cookieStore),
      async (accessToken) => {
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
      return payload;
      },
      { force: forceRefresh }
    );
    return NextResponse.json(data, { headers: { "X-Cache": cache } });
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: "Niet verbonden met Google." }, { status: 401 });
    }
    console.error("GA4 YTD error:", err);
    return NextResponse.json(
      { error: "YTD-cijfers ophalen mislukt" },
      { status: 500 }
    );
  }
}
