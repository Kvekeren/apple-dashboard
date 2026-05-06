import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchGA4EventsByPage } from "@/lib/ga4";
import { getDateRange } from "@/lib/search-console";
import { getCached, setCached, TTL } from "@/lib/api-cache";

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const days = Math.min(
    28,
    Math.max(1, parseInt(request.nextUrl.searchParams.get("days") ?? "28", 10))
  );

  if (!forceRefresh) {
    const cached = await getCached<Record<string, number>>(
      `ga4-events-by-page-${days}`,
      TTL.HOURS_24
    );
    if (cached) return NextResponse.json(cached);
  }

  const cookieStore = await cookies();
  let accessToken: string | undefined = cookieStore.get("gsc_access_token")?.value;
  const refreshToken = cookieStore.get("gsc_refresh_token")?.value;
  const expiry = cookieStore.get("gsc_token_expiry")?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json(
      { error: "Niet verbonden. Log in via Search Console." },
      { status: 401 }
    );
  }

  if (accessToken && expiry && Date.now() > parseInt(expiry, 10) - 60000) {
    accessToken = undefined;
  }

  if (!accessToken && refreshToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "OAuth niet geconfigureerd" },
        { status: 500 }
      );
    }

    try {
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

      if (!tokenResponse.ok) {
        return NextResponse.json(
          { error: "Token vernieuwen mislukt" },
          { status: 401 }
        );
      }

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
    } catch (err) {
      console.error("Token refresh error:", err);
      return NextResponse.json(
        { error: "Token vernieuwen mislukt" },
        { status: 401 }
      );
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "Niet verbonden. Log in via Search Console." },
      { status: 401 }
    );
  }

  try {
    const { startDate, endDate } = getDateRange(days);
    const events = await fetchGA4EventsByPage(accessToken, startDate, endDate);

    const urlToCount: Record<string, number> = {};
    for (const e of events) {
      const key = normalizeUrl(e.url);
      urlToCount[key] = (urlToCount[key] ?? 0) + e.count;
    }

    await setCached(`ga4-events-by-page-${days}`, urlToCount);

    return NextResponse.json(urlToCount);
  } catch (err) {
    console.error("GA4 events-by-page error:", err);
    return NextResponse.json(
      { error: "GA4 data ophalen mislukt" },
      { status: 500 }
    );
  }
}
