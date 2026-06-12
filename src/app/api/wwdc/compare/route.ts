import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import {
  WWDC_PERIOD_LABELS,
  type WwdcPeriodKey,
  wwdcPeriodDates,
} from "@/config/wwdc";
import { getWwdcCached, setWwdcCached } from "@/lib/wwdc-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { fetchDiscoverData, fetchSearchData } from "@/lib/search-console";
import type { SiteTitleId } from "@/lib/site-titles";
import { listTitleIdsInOrder } from "@/lib/site-titles";
import {
  fetchGA4WwdcBrandTotals,
  type WwdcBrandTotals,
} from "@/lib/wwdc-traffic";

const VALID_PERIODS = new Set<WwdcPeriodKey>(["weekBefore", "startWwdc", "afterWwdc"]);

function parsePeriod(raw: string | null): WwdcPeriodKey {
  if (raw && VALID_PERIODS.has(raw as WwdcPeriodKey)) return raw as WwdcPeriodKey;
  return "weekBefore";
}

type CompareBrandRow = {
  y2025: WwdcBrandTotals;
  y2026: WwdcBrandTotals;
};

export type WwdcComparePayload = {
  meta: {
    period: WwdcPeriodKey;
    periodLabel: string;
    dates2025: { startDate: string; endDate: string };
    dates2026: { startDate: string; endDate: string };
  };
  byBrand: Record<SiteTitleId, CompareBrandRow>;
};

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const cacheKey = `wwdc-compare-v1-${period}`;

  if (!forceRefresh) {
    const cached = await getWwdcCached<WwdcComparePayload>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { headers: { "X-Wwdc-Cache": "hit" } });
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
    const dates2025 = wwdcPeriodDates(period, 2025);
    const dates2026 = wwdcPeriodDates(period, 2026);
    const brands = listTitleIdsInOrder();

    const [discover2025, search2025, discover2026, search2026] = await Promise.all([
      fetchDiscoverData(accessToken, dates2025.startDate, dates2025.endDate),
      fetchSearchData(accessToken, dates2025.startDate, dates2025.endDate),
      fetchDiscoverData(accessToken, dates2026.startDate, dates2026.endDate),
      fetchSearchData(accessToken, dates2026.startDate, dates2026.endDate),
    ]);

    const brandResults = await Promise.all(
      brands.flatMap((id) => [
        fetchGA4WwdcBrandTotals(
          accessToken,
          id,
          dates2025.startDate,
          dates2025.endDate,
          discover2025,
          search2025
        ),
        fetchGA4WwdcBrandTotals(
          accessToken,
          id,
          dates2026.startDate,
          dates2026.endDate,
          discover2026,
          search2026
        ),
      ])
    );

    const byBrand = Object.fromEntries(
      brands.map((id, index) => [
        id,
        {
          y2025: brandResults[index * 2] as WwdcBrandTotals,
          y2026: brandResults[index * 2 + 1] as WwdcBrandTotals,
        },
      ])
    ) as Record<SiteTitleId, CompareBrandRow>;

    const payload: WwdcComparePayload = {
      meta: {
        period,
        periodLabel: WWDC_PERIOD_LABELS[period],
        dates2025,
        dates2026,
      },
      byBrand,
    };

    await setWwdcCached(cacheKey, payload);
    return NextResponse.json(payload, {
      headers: { "X-Wwdc-Cache": forceRefresh ? "refresh" : "miss" },
    });
  } catch (err) {
    console.error("WWDC compare error:", err);
    return NextResponse.json({ error: "WWDC-vergelijking ophalen mislukt" }, { status: 500 });
  }
}
