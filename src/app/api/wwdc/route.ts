import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import {
  WWDC_PERIOD_LABELS,
  WWDC_TOP_ARTICLES_MAX,
  type WwdcPeriodKey,
  wwdcPeriodDates,
} from "@/config/wwdc";
import { getWwdcCached, setWwdcCached } from "@/lib/wwdc-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { fetchDiscoverData, fetchSearchData } from "@/lib/search-console";
import type { SiteTitleId } from "@/lib/site-titles";
import { getTitleById, listTitleIdsInOrder } from "@/lib/site-titles";
import {
  buildGscClicksByUrlForBrand,
  fetchGA4WwdcArticleTraffic,
  mergeGscIntoWwdcRows,
  type WwdcArticleTrafficRow,
} from "@/lib/wwdc-traffic";

const VALID_BRANDS = new Set<SiteTitleId>(listTitleIdsInOrder());
const VALID_PERIODS = new Set<WwdcPeriodKey>(["weekBefore", "startWwdc", "afterWwdc"]);

function parsePeriod(raw: string | null): WwdcPeriodKey {
  if (raw && VALID_PERIODS.has(raw as WwdcPeriodKey)) return raw as WwdcPeriodKey;
  return "weekBefore";
}

function parseBrand(raw: string | null): SiteTitleId | null {
  if (!raw) return null;
  return VALID_BRANDS.has(raw as SiteTitleId) ? (raw as SiteTitleId) : null;
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const brand = parseBrand(request.nextUrl.searchParams.get("brand"));
  const { startDate, endDate } = wwdcPeriodDates(period);
  const cacheKey = `wwdc-2025-v9-top${WWDC_TOP_ARTICLES_MAX}-${period}-${brand ?? "all"}`;

  if (!forceRefresh) {
    const cached = await getWwdcCached<{
      meta: {
        startDate: string;
        endDate: string;
        period: WwdcPeriodKey;
        periodLabel: string;
      };
      byBrand: Record<SiteTitleId, WwdcArticleTrafficRow[]>;
    }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-Wwdc-Cache": "hit" },
      });
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
    const brands = brand ? [brand] : listTitleIdsInOrder();

    const [discoverRows, searchRows, ...ga4Results] = await Promise.all([
      fetchDiscoverData(accessToken, startDate, endDate),
      fetchSearchData(accessToken, startDate, endDate),
      ...brands.map(async (id) => ({
        id,
        rows: await fetchGA4WwdcArticleTraffic(
          accessToken,
          id,
          startDate,
          endDate,
          WWDC_TOP_ARTICLES_MAX
        ),
      })),
    ]);

    const byBrand = Object.fromEntries(
      ga4Results.map(({ id, rows }) => {
        const brandLabel = getTitleById(id)!.label;
        const discoverByUrl = buildGscClicksByUrlForBrand(discoverRows, brandLabel);
        const searchByUrl = buildGscClicksByUrlForBrand(searchRows, brandLabel);
        return [id, mergeGscIntoWwdcRows(rows, discoverByUrl, searchByUrl)];
      })
    ) as Record<SiteTitleId, WwdcArticleTrafficRow[]>;

    const payload = {
      meta: {
        startDate,
        endDate,
        period,
        periodLabel: WWDC_PERIOD_LABELS[period],
      },
      byBrand,
    };

    await setWwdcCached(cacheKey, payload);
    return NextResponse.json(payload, {
      headers: { "X-Wwdc-Cache": forceRefresh ? "refresh" : "miss" },
    });
  } catch (err) {
    console.error("WWDC traffic error:", err);
    return NextResponse.json({ error: "WWDC-data ophalen mislukt" }, { status: 500 });
  }
}
