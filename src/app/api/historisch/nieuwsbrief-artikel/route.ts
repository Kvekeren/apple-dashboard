import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchHistorischNieuwsbriefArtikelReport } from "@/lib/ga4-historisch-nieuwsbrief-artikel";
import { fetchHistorischFunnelMonthly } from "@/lib/ga4-historisch-funnel";
import { getCached, setCached } from "@/lib/api-cache";
import type { HistorischFunnelMonthlyReport } from "@/lib/historisch-funnel-shared";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = "historisch-nieuwsbrief-artikel-v1";
const CACHE_KEY_FUNNEL = "historisch-funnel-monthly-v1";

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const cached = await getCached<Awaited<ReturnType<typeof fetchHistorischNieuwsbriefArtikelReport>>>(
      CACHE_KEY,
      CACHE_TTL_MS
    );
    if (cached) return NextResponse.json(cached);
  }

  const cookieStore = await cookies();
  let accessToken: string | undefined = cookieStore.get("gsc_access_token")?.value;
  const refreshToken = cookieStore.get("gsc_refresh_token")?.value;
  const expiry = cookieStore.get("gsc_token_expiry")?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json(
      { error: "Niet verbonden. Log in via Google (Search Console / Analytics scope)." },
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
      return NextResponse.json({ error: "OAuth niet geconfigureerd" }, { status: 500 });
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
        return NextResponse.json({ error: "Token vernieuwen mislukt" }, { status: 401 });
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
      return NextResponse.json({ error: "Token vernieuwen mislukt" }, { status: 401 });
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "Niet verbonden. Log in via Google (Search Console / Analytics scope)." },
      { status: 401 }
    );
  }

  try {
    let funnel: HistorischFunnelMonthlyReport | null = null;
    if (!forceRefresh) {
      funnel = await getCached<HistorischFunnelMonthlyReport>(CACHE_KEY_FUNNEL, CACHE_TTL_MS);
    }
    if (!funnel || forceRefresh) {
      funnel = await fetchHistorischFunnelMonthly(accessToken);
      await setCached(CACHE_KEY_FUNNEL, funnel);
    }

    const report = await fetchHistorischNieuwsbriefArtikelReport(accessToken, {
      stap2Rows: funnel.rows,
    });
    await setCached(CACHE_KEY, report);
    return NextResponse.json(report);
  } catch (err) {
    console.error("Historisch nieuwsbrief artikel error:", err);
    return NextResponse.json({ error: "Nieuwsbrief-artikelanalyse ophalen mislukt" }, { status: 500 });
  }
}
