import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchDiscoverData,
  fetchSearchData,
  getDateRange,
  getDateRangeOffset,
} from "@/lib/search-console";
import {
  fetchGA4PageviewsByPage,
  fetchGA4EventsByPage,
} from "@/lib/ga4";
import { getCachedCijfers, setCachedCijfers } from "@/lib/cijfers-cache";

const SOURCES = [
  "iCreate",
  "Gardeners' World",
  "Historisch Nieuwsblad",
  "Auto Review",
] as const;

const DOMAIN_TO_SOURCE: Record<string, string> = {
  "icreatemagazine.nl": "iCreate",
  "www.icreatemagazine.nl": "iCreate",
  "gardenersworldmagazine.nl": "Gardeners' World",
  "www.gardenersworldmagazine.nl": "Gardeners' World",
  "historischnieuwsblad.nl": "Historisch Nieuwsblad",
  "www.historischnieuwsblad.nl": "Historisch Nieuwsblad",
  "autoreview.nl": "Auto Review",
  "www.autoreview.nl": "Auto Review",
};

function getSourceFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return (
      DOMAIN_TO_SOURCE[host] ??
      DOMAIN_TO_SOURCE[host.replace(/^www\./, "")] ??
      "Overig"
    );
  } catch {
    return "Overig";
  }
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

async function getAccessToken(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  let accessToken = cookieStore.get("gsc_access_token")?.value;
  const refreshToken = cookieStore.get("gsc_refresh_token")?.value;
  const expiry = cookieStore.get("gsc_token_expiry")?.value;

  if (accessToken && expiry && Date.now() > parseInt(expiry, 10) - 60000) {
    accessToken = undefined;
  }

  if (!accessToken && refreshToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) return null;

    const tokens = await tokenResponse.json();
    accessToken = tokens.access_token;

    cookieStore.set("gsc_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });
    cookieStore.set("gsc_token_expiry", String(Date.now() + tokens.expires_in * 1000), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });
  }

  return accessToken ?? null;
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const cached = await getCachedCijfers();
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  const cookieStore = await cookies();
  const accessToken = await getAccessToken(cookieStore);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Niet verbonden. Log in via Search Console." },
      { status: 401 }
    );
  }

  const days = 7;
  const currentRange = getDateRange(days);
  const previousRange = getDateRangeOffset(days, days);

  try {
    const [
      discoverCurrent,
      discoverPrevious,
      searchCurrent,
      searchPrevious,
      pageviewsCurrent,
      pageviewsPrevious,
      newsletterCurrent,
      newsletterPrevious,
    ] = await Promise.all([
      fetchDiscoverData(accessToken, currentRange.startDate, currentRange.endDate),
      fetchDiscoverData(accessToken, previousRange.startDate, previousRange.endDate),
      fetchSearchData(accessToken, currentRange.startDate, currentRange.endDate),
      fetchSearchData(accessToken, previousRange.startDate, previousRange.endDate),
      fetchGA4PageviewsByPage(accessToken, currentRange.startDate, currentRange.endDate),
      fetchGA4PageviewsByPage(accessToken, previousRange.startDate, previousRange.endDate),
      fetchGA4EventsByPage(accessToken, currentRange.startDate, currentRange.endDate),
      fetchGA4EventsByPage(accessToken, previousRange.startDate, previousRange.endDate),
    ]);

    // Zelfde by-page data als Discover-tab; totalen = som per bron met URL-deduplicatie.
    // Neem per canonical URL het max (zelfde pagina kan als meerdere URL-varianten terugkomen).
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
      pageviewsBySourceCurrent.set(r.source, (pageviewsBySourceCurrent.get(r.source) ?? 0) + r.count);
    }
    for (const r of pageviewsPrevious) {
      pageviewsBySourcePrevious.set(r.source, (pageviewsBySourcePrevious.get(r.source) ?? 0) + r.count);
    }

    const newsletterBySourceCurrent = new Map<string, number>();
    const newsletterBySourcePrevious = new Map<string, number>();
    for (const r of newsletterCurrent) {
      newsletterBySourceCurrent.set(r.source, (newsletterBySourceCurrent.get(r.source) ?? 0) + r.count);
    }
    for (const r of newsletterPrevious) {
      newsletterBySourcePrevious.set(r.source, (newsletterBySourcePrevious.get(r.source) ?? 0) + r.count);
    }

    const sources: CijfersSource[] = SOURCES.map((source) => {
      const pvCur = pageviewsBySourceCurrent.get(source) ?? 0;
      const pvPrev = pageviewsBySourcePrevious.get(source) ?? 0;
      const discCur = discoverBySourceCurrent.get(source) ?? 0;
      const discPrev = discoverBySourcePrevious.get(source) ?? 0;
      const searchCur = searchBySourceCurrent.get(source) ?? 0;
      const searchPrev = searchBySourcePrevious.get(source) ?? 0;
      const nlCur = newsletterBySourceCurrent.get(source) ?? 0;
      const nlPrev = newsletterBySourcePrevious.get(source) ?? 0;

      // Search Console: Discover en Search zijn aparte rapporten in GSC.
      // Sommige API-implementaties geven web-data terug voor type "discover".
      // Als Discover-clicks te hoog lijken (vergelijkbaar met Search), vergelijk dan met
      // GSC Discover-tab (typisch lager) vs Search-tab.
      const metrics: Record<string, MetricValue> = {
        pageviews: toMetricValue(pvCur, pvPrev),
        discoverClicks: toMetricValue(discCur, discPrev),
        searchClicks: toMetricValue(searchCur, searchPrev),
        searchConsoleTotal: toMetricValue(discCur + searchCur, discPrev + searchPrev),
        newsletterSignups: toMetricValue(nlCur, nlPrev),
      };

      return { source, metrics };
    });

    const response: CijfersResponse = {
      periods: {
        current: currentRange,
        previous: previousRange,
      },
      sources,
    };

    await setCachedCijfers(response);

    return NextResponse.json(response);
  } catch (err) {
    console.error("Cijfers fetch error:", err);
    return NextResponse.json(
      { error: "Cijfers ophalen mislukt" },
      { status: 500 }
    );
  }
}
