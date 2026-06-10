import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGoogleAccessToken } from "@/lib/google-access-token";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = await getGoogleAccessToken(cookieStore);
  return NextResponse.json({ connected: Boolean(accessToken) });
}
