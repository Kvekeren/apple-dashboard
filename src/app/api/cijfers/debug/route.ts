import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchDiscoverTotals,
  fetchSearchTotals,
  fetchDiscoverDataByProperty,
  fetchSearchDataByProperty,
  getDateRange,
} from "@/lib/search-console";
import { gscSiteUrlToLabel } from "@/lib/site-titles";
import { getGoogleAccessToken } from "@/lib/google-access-token";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = await getGoogleAccessToken(cookieStore);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Niet verbonden. Log in via Search Console." },
      { status: 401 }
    );
  }

  const days = 7;
  const { startDate, endDate } = getDateRange(days);

  try {
    const [discoverTotals, searchTotals, discoverByProperty, searchByProperty] = await Promise.all([
      fetchDiscoverTotals(accessToken, startDate, endDate),
      fetchSearchTotals(accessToken, startDate, endDate),
      fetchDiscoverDataByProperty(accessToken, startDate, endDate),
      fetchSearchDataByProperty(accessToken, startDate, endDate),
    ]);

    const byDateDiscover = discoverTotals.map((t) => ({
      siteUrl: t.siteUrl,
      source: gscSiteUrlToLabel(t.siteUrl) ?? "?",
      clicks: t.clicks,
    }));

    const byDateSearch = searchTotals.map((t) => ({
      siteUrl: t.siteUrl,
      source: gscSiteUrlToLabel(t.siteUrl) ?? "?",
      clicks: t.clicks,
    }));

    const byPageDiscover = discoverByProperty.map(({ siteUrl, rows }) => ({
      siteUrl,
      source: gscSiteUrlToLabel(siteUrl) ?? "?",
      clicks: rows.reduce((s, r) => s + r.clicks, 0),
      rowCount: rows.length,
    }));

    const byPageSearch = searchByProperty.map(({ siteUrl, rows }) => ({
      siteUrl,
      source: gscSiteUrlToLabel(siteUrl) ?? "?",
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
    });
  } catch (err) {
    console.error("Debug fetch error:", err);
    return NextResponse.json({ error: "Debug ophalen mislukt" }, { status: 500 });
  }
}
