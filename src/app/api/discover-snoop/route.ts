import { NextRequest, NextResponse } from "next/server";

import { getCached, setCached, TTL } from "@/lib/api-cache";
import {
  IDEEEN_CATEGORY_SECTIONS,
  IDEEEN_MAX,
  fetchDiscoverSnoopCategory,
  type IdeeenApiPayload,
  type IdeeenCategoryKey,
} from "@/lib/discover-snoop";

const CACHE_KEY = `discover-snoop-ideeen-top${IDEEEN_MAX}`;

async function loadIdeeenPayload(): Promise<IdeeenApiPayload> {
  const entries = await Promise.all(
    IDEEEN_CATEGORY_SECTIONS.map(async ({ key }) => {
      const data = await fetchDiscoverSnoopCategory(key, IDEEEN_MAX);
      return [
        key,
        {
          items: data.items ?? [],
          meta: {
            week: data.week ?? null,
            total: data.total ?? null,
          },
        },
      ] as const;
    })
  );

  const sections = Object.fromEntries(entries) as IdeeenApiPayload["sections"];

  return {
    sections,
    fetchedAt: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const cached = await getCached<IdeeenApiPayload>(CACHE_KEY, TTL.HOURS_2);
    if (cached) return NextResponse.json(cached);
  }

  try {
    const payload = await loadIdeeenPayload();
    await setCached(CACHE_KEY, payload);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("DiscoverSnoop fetch error:", err);
    return NextResponse.json(
      { error: "Discover-marktdata ophalen mislukt" },
      { status: 502 }
    );
  }
}
