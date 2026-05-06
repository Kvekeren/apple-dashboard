import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const REDIRECT_URI = "/api/auth/google/callback";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/monitoring?gsc_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/monitoring?gsc_error=no_code`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}/monitoring?gsc_error=config`
    );
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${baseUrl}${REDIRECT_URI}`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error("Token exchange failed:", err);
      return NextResponse.redirect(
        `${baseUrl}/monitoring?gsc_error=token_failed`
      );
    }

    const tokens = await tokenResponse.json();
    const cookieStore = await cookies();

    cookieStore.set("gsc_access_token", tokens.access_token, {
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

    cookieStore.set("gsc_token_expiry", String(Date.now() + tokens.expires_in * 1000), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });

    return NextResponse.redirect(`${baseUrl}/monitoring?gsc_connected=1`);
  } catch (err) {
    console.error("Auth callback error:", err);
    return NextResponse.redirect(
      `${baseUrl}/monitoring?gsc_error=unknown`
    );
  }
}
