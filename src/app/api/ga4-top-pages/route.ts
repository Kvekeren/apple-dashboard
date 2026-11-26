import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  fetchGA4TopPagesByScreenViews,
} from "@/lib/ga4";
import { cachedWithRevalidate, NotConnectedError, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { parseDashboardRangeFromRequest } from "@/lib/dashboard-date-range";
import { SOURCE_LABELS } from "@/lib/monitoring/shared";
export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  const { startDate, endDate, periodKey } = parseDashboardRangeFromRequest(request);
  const cacheKey = `ga4-top-pages-v4-${periodKey}`;

  const cookieStore = await cookies();
  const allSitesHaveData = (rows: { source: string }[]) =>
    SOURCE_LABELS.every((label) => rows.some((r) => r.source === label));
  try {
    const { data, cache } = await cachedWithRevalidate(
      cacheKey,
      TTL.HOURS_24,
      () => getGoogleAccessToken(cookieStore),
      async (accessToken) => {
    const rows = await fetchGA4TopPagesByScreenViews(
      accessToken,
      startDate,
      endDate,
      200
    );

    const payload = {
      meta: { startDate, endDate },
      rows,
    };

    return payload;
      },
      {
        force: forceRefresh,
        // Alleen complete resultaten (alle titels met data) bewaren en serveren.
        isUsable: (p) => allSitesHaveData(p.rows),
        shouldStore: (p) => allSitesHaveData(p.rows),
      }
    );
    return NextResponse.json(data, { headers: { "X-Cache": cache } });
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: "Niet verbonden met Google." }, { status: 401 });
    }
    console.error("GA4 top pages error:", err);
    return NextResponse.json(
      { error: "Top pagina ophalen mislukt" },
      { status: 500 }
    );
  }
}
