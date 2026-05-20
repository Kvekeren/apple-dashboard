import { NextRequest, NextResponse } from "next/server";
import {
  getCachedTitle,
  setCachedTitle,
  getCachedTitles,
} from "@/lib/title-cache";
import {
  getCachedOgImage,
  setCachedOgImage,
  getCachedOgImages,
} from "@/lib/og-image-cache";
import { fetchPageOgMeta } from "@/lib/og-meta";

const MAX_URLS = 48;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const urls = Array.isArray(body.urls) ? body.urls : [];
    if (urls.length === 0) {
      return NextResponse.json({ titles: {}, images: {} });
    }

    const trimmed = urls
      .filter((u: unknown): u is string => typeof u === "string")
      .map((u: string) => u.trim())
      .filter(Boolean)
      .slice(0, MAX_URLS);

    const titlesOut: Record<string, string> = {};
    const imagesOut: Record<string, string> = {};
    const needFetch = new Set<string>();

    const cachedTitles = await getCachedTitles(trimmed);
    const cachedImages = await getCachedOgImages(trimmed);

    for (const url of trimmed) {
      const t = cachedTitles[url] ?? (await getCachedTitle(url));
      const img = cachedImages[url] ?? (await getCachedOgImage(url));
      if (t) titlesOut[url] = t;
      if (img) imagesOut[url] = img;
      if (!t || !img) needFetch.add(url);
    }

    for (const url of needFetch) {
      const meta = await fetchPageOgMeta(url);
      if (meta.title) {
        titlesOut[url] = meta.title;
        await setCachedTitle(url, meta.title);
      }
      if (meta.imageUrl) {
        imagesOut[url] = meta.imageUrl;
        await setCachedOgImage(url, meta.imageUrl);
      }
    }

    return NextResponse.json({ titles: titlesOut, images: imagesOut });
  } catch (err) {
    console.error("Fetch titles error:", err);
    return NextResponse.json({ titles: {}, images: {} }, { status: 500 });
  }
}
