import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchDiscoverTotals,
  fetchSearchTotals,
  fetchDiscoverDataByProperty,
  fetchSearchDataByProperty,
  getDateRange,
  SITE_URLS,
} from "@/lib/search-console";

const SITE_URL_TO_SOURCE: Record<string, string> = {
  "https://www.icreatemagazine.nl/": "iCreate",
  "https://www.gardenersworldmagazine.nl/": "Gardeners' World",
  "https://www.historischnieuwsblad.nl/": "Historisch Nieuwsblad",
  "https://www.autoreview.nl/": "Auto Review",
};

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
  }

  return accessToken ?? null;
}

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = await getAccessToken(cookieStore);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Niet verbonden. Log in via Search Console." },
      { status: 401 }
    );
  }

  const days = 7;
  const { startDate, endDate } = getDateRange(days);

  try {
    const [
      discoverTotals,
      searchTotals,
      discoverByProperty,
      searchByProperty,
    ] = await Promise.all([
      fetchDiscoverTotals(accessToken, startDate, endDate),
      fetchSearchTotals(accessToken, startDate, endDate),
      fetchDiscoverDataByProperty(accessToken, startDate, endDate),
      fetchSearchDataByProperty(accessToken, startDate, endDate),
    ]);

    const byDateDiscover = discoverTotals.map((t) => ({
      siteUrl: t.siteUrl,
      source: SITE_URL_TO_SOURCE[t.siteUrl] ?? "?",
      clicks: t.clicks,
    }));

    const byDateSearch = searchTotals.map((t) => ({
      siteUrl: t.siteUrl,
      source: SITE_URL_TO_SOURCE[t.siteUrl] ?? "?",
      clicks: t.clicks,
    }));

    const byPageDiscover = discoverByProperty.map(({ siteUrl, rows }) => ({
      siteUrl,
      source: SITE_URL_TO_SOURCE[siteUrl] ?? "?",
      clicks: rows.reduce((s, r) => s + r.clicks, 0),
      rowCount: rows.length,
    }));

    const byPageSearch = searchByProperty.map(({ siteUrl, rows }) => ({
      siteUrl,
      source: SITE_URL_TO_SOURCE[siteUrl] ?? "?",
      clicks: rows.reduce((s, r) => s + r.clicks, 0),
      rowCount: rows.length,
    }));

    return NextResponse.json({
      dateRange: { startDate, endDate },
      vergelijkMetGSC:
        "Check in GSC: Performance > Discover/Search, zelfde datumbereik",
      byDate: {
        discover: byDateDiscover,
        search: byDateSearch,
      },
      byPage: {
        discover: byPageDiscover,
        search: byPageSearch,
      },
      totalenByDate: {
        discover: byDateDiscover.reduce((s, x) => s + x.clicks, 0),
        search: byDateSearch.reduce((s, x) => s + x.clicks, 0),
      },
      totalenByPage: {
        discover: byPageDiscover.reduce((s, x) => s + x.clicks, 0),
        search: byPageSearch.reduce((s, x) => s + x.clicks, 0),
      },
      properties: Object.entries(SITE_URLS),
    });
  } catch (err) {
    console.error("Debug fetch error:", err);
    return NextResponse.json(
      { error: "Debug ophalen mislukt" },
      { status: 500 }
    );
  }
}
