import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  fetchGA4ActiveUsers,
  fetchGA4RealtimeTopPages,
} from "@/lib/ga4";
import { getCached, setCached } from "@/lib/api-cache";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { REALTIME_TOP_PAGES_TOTAL } from "@/lib/monitoring/shared";

export const maxDuration = 60;

/** Realtime: 60 s gedeeld cachen, zodat meerdere gebruikers/tabbladen niet elk GA4 bevragen. */
const CACHE_KEY = "ga4-realtime-v1";
const TTL_MS = 60 * 1000;

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = await getGoogleAccessToken(cookieStore);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Niet verbonden. Log in via Search Console." },
      { status: 401 }
    );
  }

  const cached = await getCached<unknown>(CACHE_KEY, TTL_MS);
  if (cached) return NextResponse.json(cached, { headers: { "X-Cache": "hit" } });

  try {
    const [data, topPages] = await Promise.all([
      fetchGA4ActiveUsers(accessToken),
      fetchGA4RealtimeTopPages(accessToken, REALTIME_TOP_PAGES_TOTAL),
    ]);
    const payload = { data, topPages };
    await setCached(CACHE_KEY, payload);
    return NextResponse.json(payload, { headers: { "X-Cache": "miss" } });
  } catch (err) {
    console.error("GA4 realtime fetch error:", err);
    return NextResponse.json(
      { error: "Realtime data ophalen mislukt" },
      { status: 500 }
    );
  }
}
