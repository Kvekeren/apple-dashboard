import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchGA4ActiveUsers,
  fetchGA4RealtimeTopPages,
} from "@/lib/ga4";

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

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = await getAccessToken(cookieStore);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Niet verbonden. Log in via Search Console." },
      { status: 401 }
    );
  }

  try {
    const [data, topPages] = await Promise.all([
      fetchGA4ActiveUsers(accessToken),
      fetchGA4RealtimeTopPages(accessToken, 3),
    ]);
    return NextResponse.json({ data, topPages });
  } catch (err) {
    console.error("GA4 realtime fetch error:", err);
    return NextResponse.json(
      { error: "Realtime data ophalen mislukt" },
      { status: 500 }
    );
  }
}
