import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { cachedWithRevalidate, NotConnectedError, TTL } from "@/lib/api-cache";
import { buildArtikelenPayload } from "@/lib/artikelen";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { listTitleIdsInOrder, type SiteTitleId } from "@/lib/site-titles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_DAYS = [7, 28, 90, 365] as const;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const brandRaw = sp.get("brand")?.trim() ?? "";
  const brand = (listTitleIdsInOrder() as string[]).includes(brandRaw)
    ? (brandRaw as SiteTitleId)
    : null;
  if (!brand) return NextResponse.json({ error: "Onbekend merk" }, { status: 400 });

  const daysRaw = parseInt(sp.get("days") ?? "28", 10);
  const days = (ALLOWED_DAYS as readonly number[]).includes(daysRaw) ? daysRaw : 28;
  const forceRefresh = sp.get("refresh") === "1";
  const cacheKey = `artikelen-v1-${brand}-${days}d`;

  const cookieStore = await cookies();
  try {
    const { data, cache } = await cachedWithRevalidate(
      cacheKey,
      days <= 7 ? TTL.MINUTES_30 : days <= 28 ? TTL.HOURS_2 : TTL.HOURS_6,
      () => getGoogleAccessToken(cookieStore),
      (accessToken) => buildArtikelenPayload(accessToken, brand, days),
      { force: forceRefresh }
    );
    return NextResponse.json(data, { headers: { "X-Cache": cache } });
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: "Niet verbonden met Google." }, { status: 401 });
    }
    console.error("artikelen", err);
    return NextResponse.json({ error: "Artikelen laden mislukt." }, { status: 500 });
  }
}
