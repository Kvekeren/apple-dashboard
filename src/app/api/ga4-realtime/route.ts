import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchGA4ActiveUsers,
  fetchGA4RealtimeTopPages,
} from "@/lib/ga4";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { REALTIME_TOP_PAGES_TOTAL } from "@/lib/monitoring/shared";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = await getGoogleAccessToken(cookieStore);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Niet verbonden. Log in via Search Console." },
      { status: 401 }
    );
  }

  try {
    const [data, topPages] = await Promise.all([
      fetchGA4ActiveUsers(accessToken),
      fetchGA4RealtimeTopPages(accessToken, REALTIME_TOP_PAGES_TOTAL),
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
