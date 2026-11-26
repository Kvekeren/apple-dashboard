import { NextResponse } from "next/server";

import { fetchAgendaFeed } from "@/lib/agenda-feed";

export const revalidate = 300;

export async function GET() {
  try {
    const payload = await fetchAgendaFeed();
    return NextResponse.json(payload);
  } catch (err) {
    console.error("agenda-feed", err);
    return NextResponse.json({ articles: [], error: "feed_failed" }, { status: 500 });
  }
}
