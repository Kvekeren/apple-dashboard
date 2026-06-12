import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  fetchGA4TopPagesByScreenViews,
} from "@/lib/ga4";
import { getCached, setCached, TTL } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { parseDashboardRangeFromRequest } from "@/lib/dashboard-date-range";
import { SOURCE_LABELS } from "@/lib/monitoring/shared";
export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  const { startDate, endDate, periodKey } = parseDashboardRangeFromRequest(request);
  const cacheKey = `ga4-top-pages-v4-${periodKey}`;

  if (!forceRefresh) {
    const cached = await getCached<{ rows: Awaited<
      ReturnType<typeof fetchGA4TopPagesByScreenViews>
    >; meta: { startDate: string; endDate: string } }>(cacheKey, TTL.HOURS_24);
    if (cached) {
      const bySource = Object.fromEntries(
        SOURCE_LABELS.map((label) => [
          label,
          cached.rows.filter((r) => r.source === label).length,
        ])
      );
      const allSitesHaveData = SOURCE_LABELS.every((label) => (bySource[label] ?? 0) > 0);
      if (allSitesHaveData) {
        return NextResponse.json(cached);
      }
    }
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

    const bySource = Object.fromEntries(
      SOURCE_LABELS.map((label) => [label, rows.filter((r) => r.source === label).length])
    );
    const allSitesHaveData = SOURCE_LABELS.every((label) => (bySource[label] ?? 0) > 0);
    if (allSitesHaveData) {
      await setCached(cacheKey, payload);
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("GA4 top pages error:", err);
    return NextResponse.json(
      { error: "Top pagina ophalen mislukt" },
      { status: 500 }
    );
  }
}
