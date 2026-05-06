import { NextRequest, NextResponse } from "next/server";
import {
  getCachedTitle,
  setCachedTitle,
  getCachedTitles,
} from "@/lib/title-cache";

function extractTitle(html: string): string | null {
  const ogMatch =
    html.match(
      /<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i
    );
  if (ogMatch) return ogMatch[1].trim();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();

  return null;
}

async function fetchTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SEO-News-Monitor/1.0; +https://github.com)",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractTitle(html);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const urls = Array.isArray(body.urls) ? body.urls : [];
    if (urls.length === 0) return NextResponse.json({});

    const result: Record<string, string> = {};
    const toFetch: string[] = [];

    const cached = await getCachedTitles(urls);
    for (const url of urls) {
      const c = cached[url] ?? (await getCachedTitle(url));
      if (c) {
        result[url] = c;
      } else {
        toFetch.push(url);
      }
    }

    for (const url of toFetch) {
      const title = await fetchTitle(url);
      if (title) {
        result[url] = title;
        await setCachedTitle(url, title);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Fetch titles error:", err);
    return NextResponse.json({}, { status: 500 });
  }
}
