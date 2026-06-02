import { NextRequest, NextResponse } from "next/server";

import { getCached, setCached, TTL } from "@/lib/api-cache";
import {
  IDEEEN_CATEGORY_SECTIONS,
  IDEEEN_MAX,
  fetchDiscoverSnoopCategory,
  resolveLatestDiscoverWeek,
  type IdeeenApiPayload,
  type IdeeenCategoryKey,
  type IdeeenCategoryPayload,
} from "@/lib/discover-snoop";

function cacheKey(week: number): string {
  return `discover-snoop-ideeen-w${week}-top${IDEEEN_MAX}`;
}

async function loadCategoryFeeds(
  key: IdeeenCategoryKey,
  week: number
): Promise<IdeeenCategoryPayload> {
  const [nl, worldwide] = await Promise.all([
    fetchDiscoverSnoopCategory(key, IDEEEN_MAX, { week }),
    fetchDiscoverSnoopCategory(key, IDEEEN_MAX, { week, worldwide: true }),
  ]);
  return {
    nl: {
      items: nl.items ?? [],
      meta: { total: nl.total ?? null },
    },
    worldwide: {
      items: worldwide.items ?? [],
      meta: { total: worldwide.total ?? null },
    },
  };
}

async function loadIdeeenPayload(): Promise<IdeeenApiPayload> {
  const week = await resolveLatestDiscoverWeek();
  if (week == null) {
    throw new Error("Geen week beschikbaar in DiscoverSnoop");
  }

  const entries = await Promise.all(
    IDEEEN_CATEGORY_SECTIONS.map(async ({ key }) => {
      const feeds = await loadCategoryFeeds(key, week);
      return [key, feeds] as const;
    })
  );

  return {
    week,
    sections: Object.fromEntries(entries) as IdeeenApiPayload["sections"],
    fetchedAt: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  let weekForCache: number | null = null;
  if (!forceRefresh) {
    weekForCache = await resolveLatestDiscoverWeek();
    if (weekForCache != null) {
      const cached = await getCached<IdeeenApiPayload>(cacheKey(weekForCache), TTL.HOURS_2);
      if (cached) return NextResponse.json(cached);
    }
  }

  try {
    const payload = await loadIdeeenPayload();
    if (payload.week != null) {
      await setCached(cacheKey(payload.week), payload);
    }
    return NextResponse.json(payload);
  } catch (err) {
    console.error("DiscoverSnoop fetch error:", err);
    return NextResponse.json(
      { error: "Discover-marktdata ophalen mislukt" },
      { status: 502 }
    );
  }
}
