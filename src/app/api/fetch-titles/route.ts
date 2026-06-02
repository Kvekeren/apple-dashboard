import { NextRequest, NextResponse } from "next/server";
import {
  getCachedDatePublished,
  setCachedDatePublished,
  getCachedDatesPublished,
} from "@/lib/date-published-cache";
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
      return NextResponse.json({ titles: {}, images: {}, dates: {} });
    }

    const trimmed = urls
      .filter((u: unknown): u is string => typeof u === "string")
      .map((u: string) => u.trim())
      .filter(Boolean)
      .slice(0, MAX_URLS);

    const titlesOut: Record<string, string> = {};
    const imagesOut: Record<string, string> = {};
    const datesOut: Record<string, string> = {};
    const needFetch = new Set<string>();

    const cachedTitles = await getCachedTitles(trimmed);
    const cachedImages = await getCachedOgImages(trimmed);
    const cachedDates = await getCachedDatesPublished(trimmed);

    for (const url of trimmed) {
      const t = cachedTitles[url] ?? (await getCachedTitle(url));
      const img = cachedImages[url] ?? (await getCachedOgImage(url));
      const date = cachedDates[url] ?? (await getCachedDatePublished(url));
      if (t) titlesOut[url] = t;
      if (img) imagesOut[url] = img;
      if (date) datesOut[url] = date;
      if (!t || !img || !date) needFetch.add(url);
    }

    function storeTitle(url: string, title: string) {
      const normalized = url.replace(/\/$/, "");
      titlesOut[url] = title;
      if (normalized !== url) titlesOut[normalized] = title;
    }

    function storeImage(url: string, imageUrl: string) {
      const normalized = url.replace(/\/$/, "");
      imagesOut[url] = imageUrl;
      if (normalized !== url) imagesOut[normalized] = imageUrl;
    }

    function storeDate(url: string, dateLabel: string) {
      const normalized = url.replace(/\/$/, "");
      datesOut[url] = dateLabel;
      if (normalized !== url) datesOut[normalized] = dateLabel;
    }

    for (const url of needFetch) {
      const meta = await fetchPageOgMeta(url);
      if (meta.title) {
        storeTitle(url, meta.title);
        await setCachedTitle(url, meta.title);
      }
      if (meta.imageUrl) {
        storeImage(url, meta.imageUrl);
        await setCachedOgImage(url, meta.imageUrl);
      }
      if (meta.dateLabel) {
        storeDate(url, meta.dateLabel);
        await setCachedDatePublished(url, meta.dateLabel);
      }
    }

    return NextResponse.json({ titles: titlesOut, images: imagesOut, dates: datesOut });
  } catch (err) {
    console.error("Fetch titles error:", err);
    return NextResponse.json({ titles: {}, images: {}, dates: {} }, { status: 500 });
  }
}
