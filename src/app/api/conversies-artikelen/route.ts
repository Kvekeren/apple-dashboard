import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { cachedWithRevalidate, NotConnectedError, TTL } from "@/lib/api-cache";
import { buildConversieArtikelen } from "@/lib/conversie-artikelen";
import { getGoogleAccessToken } from "@/lib/google-access-token";
import { listTitleIdsInOrder, type SiteTitleId } from "@/lib/site-titles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_DAYS = [7, 28, 90] as const;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const brandRaw = sp.get("brand")?.trim() ?? "";
  if (!(listTitleIdsInOrder() as string[]).includes(brandRaw)) {
    return NextResponse.json({ error: "Onbekend merk" }, { status: 400 });
  }
  const brand = brandRaw as SiteTitleId;
  const daysRaw = parseInt(sp.get("days") ?? "28", 10);
  const days = (ALLOWED_DAYS as readonly number[]).includes(daysRaw) ? daysRaw : 28;
  const cacheKey = `conversie-artikelen-v4-${brand}-${days}d`;

  const forceRefresh = sp.get("refresh") === "1";
  const cookieStore = await cookies();
  try {
    const { data, cache } = await cachedWithRevalidate(
      cacheKey,
      days <= 7 ? TTL.HOURS_2 : TTL.HOURS_6,
      () => getGoogleAccessToken(cookieStore),
      (accessToken) => buildConversieArtikelen(accessToken, brand, days),
      { force: forceRefresh }
    );
    return NextResponse.json(data, { headers: { "X-Cache": cache } });
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: "Niet verbonden met Google." }, { status: 401 });
    }
    console.error("conversies-artikelen", err);
    return NextResponse.json({ error: "Conversiedata laden mislukt." }, { status: 500 });
  }
}
