import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { WWDC_TOP_ARTICLES_MAX } from "@/config/wwdc";
import {
  isKeynotePeriod,
  KEYNOTE_PERIOD_LABELS,
  keynotePeriodRange,
  type KeynotePeriodKey,
} from "@/config/keynote";
import type { KeynoteDashboardPayload } from "@/lib/keynote-client-cache";
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
function parsePeriod(raw: string | null): KeynotePeriodKey {
  return isKeynotePeriod(raw) ? raw : "thisWeek";
}

function parseBrand(raw: string | null): SiteTitleId | null {
  if (!raw) return null;
  return VALID_BRANDS.has(raw as SiteTitleId) ? (raw as SiteTitleId) : null;
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const brand = parseBrand(request.nextUrl.searchParams.get("brand"));
  const { startDate, endDate, isoWeek, isoWeekYear } = keynotePeriodRange(period);
  // Historische week: data verandert niet meer, dus cache op de datums zelf.
  const cacheKey = `vorigjaar-v1-top${WWDC_TOP_ARTICLES_MAX}-${startDate}-${brand ?? "all"}`;

  if (!forceRefresh) {
    const cached = await getWwdcCached<KeynoteDashboardPayload>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-Keynote-Cache": "hit" },
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

    const payload: KeynoteDashboardPayload = {
      meta: {
        startDate,
        endDate,
        isoWeek,
        isoWeekYear,
        period,
        periodLabel: KEYNOTE_PERIOD_LABELS[period],
      },
      byBrand,
    };

    await setWwdcCached(cacheKey, payload);
    return NextResponse.json(payload, {
      headers: { "X-Keynote-Cache": forceRefresh ? "refresh" : "miss" },
    });
  } catch (err) {
    console.error("Keynote traffic error:", err);
    return NextResponse.json({ error: "Data van vorig jaar ophalen mislukt" }, { status: 500 });
  }
}
