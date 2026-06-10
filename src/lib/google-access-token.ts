import { cookies } from "next/headers";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

let refreshInFlight: Promise<string | null> | null = null;
let refreshInFlightKey: string | null = null;

async function refreshGoogleAccessToken(
  cookieStore: CookieStore,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("Google token refresh mislukt: GOOGLE_CLIENT_ID of GOOGLE_CLIENT_SECRET ontbreekt");
    return null;
  }

  const refreshKey = `${clientId}:${refreshToken.slice(-8)}`;
  if (refreshInFlight && refreshInFlightKey === refreshKey) {
    return refreshInFlight;
  }

  refreshInFlightKey = refreshKey;
  refreshInFlight = (async () => {
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
      const err = await tokenResponse.text();
      console.error("Google token refresh mislukt:", err);
      return null;
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

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

    if (tokens.refresh_token) {
      cookieStore.set("gsc_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 180,
        path: "/",
      });
    }

    return tokens.access_token;
  })().finally(() => {
    refreshInFlight = null;
    refreshInFlightKey = null;
  });

  return refreshInFlight;
}

export async function getGoogleAccessToken(cookieStore: CookieStore): Promise<string | null> {
  let accessToken = cookieStore.get("gsc_access_token")?.value;
  const refreshToken = cookieStore.get("gsc_refresh_token")?.value;
  const expiry = cookieStore.get("gsc_token_expiry")?.value;

  if (accessToken && expiry && Date.now() > parseInt(expiry, 10) - 60000) {
    accessToken = undefined;
  }

  if (!accessToken && refreshToken) {
    accessToken = (await refreshGoogleAccessToken(cookieStore, refreshToken)) ?? undefined;
  }

  return accessToken ?? null;
}
