import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const hasToken =
    !!cookieStore.get("gsc_access_token")?.value ||
    !!cookieStore.get("gsc_refresh_token")?.value;
  return NextResponse.json({ connected: hasToken });
}
