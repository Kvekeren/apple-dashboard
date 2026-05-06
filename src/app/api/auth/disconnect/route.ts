import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("gsc_access_token");
  cookieStore.delete("gsc_refresh_token");
  cookieStore.delete("gsc_token_expiry");
  return NextResponse.json({ success: true });
}
