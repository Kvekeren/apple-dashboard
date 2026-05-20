import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchDiscoverData,
  fetchSearchData,
} from "@/lib/search-console";
import { fetchGA4PageviewsByPage } from "@/lib/ga4";
import { getCachedCijfers, setCachedCijfers } from "@/lib/cijfers-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { titleLabelFromPageUrl, listTitleLabelsInOrder } from "@/lib/site-titles";
import { parseDashboardRangeFromRequest } from "@/lib/dashboard-date-range";

const SOURCES = listTitleLabelsInOrder();

function getSourceFromUrl(url: string): string {
  const lbl = titleLabelFromPageUrl(url);
  return lbl === "Overig" ? "Overig" : lbl;
}

function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "") || "/";
    return `${host}${path}`;
  } catch {
    return url.replace(/\/$/, "");
  }
}

export interface MetricValue {
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
}

export interface CijfersSource {
  source: string;
  metrics: Record<string, MetricValue>;
}

export interface CijfersResponse {
  periods: {
    current: { startDate: string; endDate: string };
    previous: { startDate: string; endDate: string };
  };
  sources: CijfersSource[];
}

function toMetricValue(current: number, previous: number): MetricValue {
  const change = current - previous;
  const changePercent =
    previous > 0 ? Math.round((change / previous) * 100) : null;
  return { current, previous, change, changePercent };
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const { startDate: cStart, endDate: cEnd, previous: pRange, periodKey } =
    parseDashboardRangeFromRequest(request);

  if (!forceRefresh) {
    const cached = await getCachedCijfers(periodKey);
    if (cached) {
      return NextResponse.json(cached);
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
    const [
      discoverCurrent,
      discoverPrevious,
      searchCurrent,
      searchPrevious,
      pageviewsCurrent,
      pageviewsPrevious,
    ] = await Promise.all([
      fetchDiscoverData(accessToken, cStart, cEnd),
      fetchDiscoverData(accessToken, pRange.startDate, pRange.endDate),
      fetchSearchData(accessToken, cStart, cEnd),
      fetchSearchData(accessToken, pRange.startDate, pRange.endDate),
      fetchGA4PageviewsByPage(accessToken, cStart, cEnd),
      fetchGA4PageviewsByPage(accessToken, pRange.startDate, pRange.endDate),
    ]);

    function sumBySourceDeduped(
      rows: { url: string; clicks: number }[]
    ): Map<string, number> {
      const byCanonical = new Map<string, { source: string; clicks: number }>();
      for (const r of rows) {
        const src = getSourceFromUrl(r.url);
        if (!SOURCES.includes(src as (typeof SOURCES)[number])) continue;
        const canon = canonicalUrl(r.url);
        const existing = byCanonical.get(canon);
        if (!existing || r.clicks > existing.clicks) {
          byCanonical.set(canon, { source: src, clicks: r.clicks });
        }
      }
      const map = new Map<string, number>();
      for (const { source, clicks } of byCanonical.values()) {
        map.set(source, (map.get(source) ?? 0) + clicks);
      }
      return map;
    }

    const discoverBySourceCurrent = sumBySourceDeduped(
      discoverCurrent.map((r) => ({ url: r.url, clicks: r.clicks }))
    );
    const discoverBySourcePrevious = sumBySourceDeduped(
      discoverPrevious.map((r) => ({ url: r.url, clicks: r.clicks }))
    );
    const searchBySourceCurrent = sumBySourceDeduped(
      searchCurrent.map((r) => ({ url: r.url, clicks: r.clicks }))
    );
    const searchBySourcePrevious = sumBySourceDeduped(
      searchPrevious.map((r) => ({ url: r.url, clicks: r.clicks }))
    );

    const pageviewsBySourceCurrent = new Map<string, number>();
    const pageviewsBySourcePrevious = new Map<string, number>();
    for (const r of pageviewsCurrent) {
      pageviewsBySourceCurrent.set(
        r.source,
        (pageviewsBySourceCurrent.get(r.source) ?? 0) + r.count
      );
    }
    for (const r of pageviewsPrevious) {
      pageviewsBySourcePrevious.set(
        r.source,
        (pageviewsBySourcePrevious.get(r.source) ?? 0) + r.count
      );
    }

    const sources: CijfersSource[] = SOURCES.map((source) => {
      const pvCur = pageviewsBySourceCurrent.get(source) ?? 0;
      const pvPrev = pageviewsBySourcePrevious.get(source) ?? 0;
      const discCur = discoverBySourceCurrent.get(source) ?? 0;
      const discPrev = discoverBySourcePrevious.get(source) ?? 0;
      const searchCur = searchBySourceCurrent.get(source) ?? 0;
      const searchPrev = searchBySourcePrevious.get(source) ?? 0;

      const metrics: Record<string, MetricValue> = {
        pageviews: toMetricValue(pvCur, pvPrev),
        discoverClicks: toMetricValue(discCur, discPrev),
        searchClicks: toMetricValue(searchCur, searchPrev),
        searchConsoleTotal: toMetricValue(
          discCur + searchCur,
          discPrev + searchPrev
        ),
      };

      return { source, metrics };
    });

    const response: CijfersResponse = {
      periods: {
        current: { startDate: cStart, endDate: cEnd },
        previous: pRange,
      },
      sources,
    };

    await setCachedCijfers(response, periodKey);

    return NextResponse.json(response);
  } catch (err) {
    console.error("Cijfers fetch error:", err);
    return NextResponse.json(
      { error: "Cijfers ophalen mislukt" },
      { status: 500 }
    );
  }
}
