import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { getCached, setCached, TTL } from "@/lib/api-cache";
import { buildArtikelenPayload, type ArtikelenPayload } from "@/lib/artikelen";
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

  if (!forceRefresh) {
    const cached = await getCached<ArtikelenPayload>(
      cacheKey,
      days <= 7 ? TTL.MINUTES_30 : days <= 28 ? TTL.HOURS_2 : TTL.HOURS_6
    );
    if (cached) return NextResponse.json(cached);
  }

  const accessToken = await getGoogleAccessToken(await cookies());
  if (!accessToken) {
    return NextResponse.json({ error: "Niet verbonden met Google." }, { status: 401 });
  }

  try {
    const payload = await buildArtikelenPayload(accessToken, brand, days);
    await setCached(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("artikelen", err);
    return NextResponse.json({ error: "Artikelen laden mislukt." }, { status: 500 });
  }
}
