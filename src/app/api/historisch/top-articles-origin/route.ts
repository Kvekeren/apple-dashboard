import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchHistorischTopArticlesOrigin } from "@/lib/ga4-historisch-top-articles-origin";
import { fetchHistorischTopArticles } from "@/lib/ga4-historisch-top-articles";
import { getCached, setCached } from "@/lib/api-cache";
import type { HistorischTopArticlesReport } from "@/lib/historisch-top-articles-shared";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY_ORIGIN = "historisch-top-articles-origin-v1";
const CACHE_KEY_STAP5 = "historisch-top-articles-v1";

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const cached = await getCached<Awaited<ReturnType<typeof fetchHistorischTopArticlesOrigin>>>(
      CACHE_KEY_ORIGIN,
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
    let stap5: HistorischTopArticlesReport | null = null;
    if (!forceRefresh) {
      stap5 = await getCached<HistorischTopArticlesReport>(CACHE_KEY_STAP5, CACHE_TTL_MS);
    }
    if (!stap5) {
      stap5 = await fetchHistorischTopArticles(accessToken);
      await setCached(CACHE_KEY_STAP5, stap5);
    }

    const report = await fetchHistorischTopArticlesOrigin(accessToken, { stap5 });
    await setCached(CACHE_KEY_ORIGIN, report);
    return NextResponse.json(report);
  } catch (err) {
    console.error("Historisch top articles origin error:", err);
    return NextResponse.json({ error: "Herkomst topartikelen ophalen mislukt" }, { status: 500 });
  }
}
