import { NextResponse } from "next/server";

import { fetchDiscoverSnoopWeeks } from "@/lib/discover-snoop";

export async function GET() {
  try {
    const data = await fetchDiscoverSnoopWeeks();
    return NextResponse.json(data);
  } catch (err) {
    console.error("DiscoverSnoop weeks fetch error:", err);
    return NextResponse.json(
      { error: "Discover-weeks ophalen mislukt" },
      { status: 502 }
    );
  }
}
