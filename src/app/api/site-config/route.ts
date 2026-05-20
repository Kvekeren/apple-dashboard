import { NextResponse } from "next/server";

import { resolveSiteTitles } from "@/lib/site-titles";

/** Publieke samenvatting (geen geheimen) voor lege-states in de UI. */
export async function GET() {
  const titles = resolveSiteTitles().map((t) => ({
    id: t.id,
    label: t.label,
    hasGa4Property: Boolean(t.ga4PropertyId),
    gscSiteUrl: t.gscSiteUrl ?? null,
    primaryDomain: t.primaryDomain,
  }));

  return NextResponse.json({ titles });
}
