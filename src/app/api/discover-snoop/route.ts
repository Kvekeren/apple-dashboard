import { NextRequest, NextResponse } from "next/server";

import { getCached, setCached, TTL } from "@/lib/api-cache";
import {
  IDEEEN_CATEGORY_SECTIONS,
  IDEEEN_MAX,
  fetchDiscoverSnoopCategory,
  fetchDiscoverSnoopWeeks,
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

async function loadIdeeenPayload(week: number): Promise<IdeeenApiPayload> {
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

async function resolveRequestedWeek(weekParam: string | null): Promise<number | null> {
  if (weekParam == null || weekParam === "") {
    return resolveLatestDiscoverWeek();
  }
  const parsed = Number.parseInt(weekParam, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;

  const { weeks } = await fetchDiscoverSnoopWeeks();
  if (!weeks.includes(parsed)) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const weekParam = request.nextUrl.searchParams.get("week");

  let week: number | null = null;
  try {
    week = await resolveRequestedWeek(weekParam);
  } catch (err) {
    console.error("DiscoverSnoop weeks error:", err);
    return NextResponse.json(
      { error: "Discover-weeks ophalen mislukt" },
      { status: 502 }
    );
  }

  if (week == null) {
    const invalidParam = weekParam != null && weekParam !== "";
    return NextResponse.json(
      {
        error: invalidParam
          ? "Week niet beschikbaar in DiscoverSnoop"
          : "Geen week beschikbaar in DiscoverSnoop",
      },
      { status: invalidParam ? 400 : 502 }
    );
  }

  if (!forceRefresh) {
    const cached = await getCached<IdeeenApiPayload>(cacheKey(week), TTL.HOURS_2);
    if (cached) return NextResponse.json(cached);
  }

  try {
    const payload = await loadIdeeenPayload(week);
    await setCached(cacheKey(week), payload);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("DiscoverSnoop fetch error:", err);
    return NextResponse.json(
      { error: "Discover-marktdata ophalen mislukt" },
      { status: 502 }
    );
  }
}
