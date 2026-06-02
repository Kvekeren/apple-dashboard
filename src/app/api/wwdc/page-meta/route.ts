import { NextRequest, NextResponse } from "next/server";

import {
  getWwdcPageMetaStore,
  mergeWwdcPageMetaStore,
  normalizeWwdcMetaUrl,
} from "@/lib/wwdc-cache";
import { fetchPageOgMeta } from "@/lib/og-meta";

const MAX_URLS = 200;
const FETCH_CONCURRENCY = 6;

async function fetchImagesParallel(urls: string[]): Promise<Record<string, string>> {
  const found: Record<string, string> = {};

  for (let i = 0; i < urls.length; i += FETCH_CONCURRENCY) {
    const batch = urls.slice(i, i + FETCH_CONCURRENCY);
    await Promise.all(
      batch.map(async (url) => {
        const meta = await fetchPageOgMeta(url);
        if (meta.imageUrl) {
          found[normalizeWwdcMetaUrl(url)] = meta.imageUrl;
        }
      })
    );
  }

  return found;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const urls = Array.isArray(body.urls) ? body.urls : [];
    const forceRefresh = body.refresh === true;

    const trimmed = [
      ...new Set(
        urls
          .filter((u: unknown): u is string => typeof u === "string")
          .map((u) => u.trim())
          .filter(Boolean)
      ),
    ].slice(0, MAX_URLS);

    if (!trimmed.length) {
      return NextResponse.json({ images: {} });
    }

    const store = forceRefresh ? {} : await getWwdcPageMetaStore();
    const imagesOut: Record<string, string> = {};
    const needFetch: string[] = [];

    for (const url of trimmed) {
      const key = normalizeWwdcMetaUrl(url);
      const cached = store[key];
      if (cached && !forceRefresh) {
        imagesOut[url] = cached;
        const normalized = url.replace(/\/$/, "");
        if (normalized !== url) imagesOut[normalized] = cached;
      } else {
        needFetch.push(url);
      }
    }

    if (needFetch.length) {
      const fetched = await fetchImagesParallel(needFetch);
      const merged = await mergeWwdcPageMetaStore(fetched);
      for (const url of needFetch) {
        const key = normalizeWwdcMetaUrl(url);
        const img = fetched[key] ?? merged[key];
        if (img) {
          imagesOut[url] = img;
          const normalized = url.replace(/\/$/, "");
          if (normalized !== url) imagesOut[normalized] = img;
        }
      }
    }

    return NextResponse.json(
      { images: imagesOut },
      { headers: { "X-Wwdc-Meta-Cache": needFetch.length ? "partial-miss" : "hit" } }
    );
  } catch (err) {
    console.error("WWDC page-meta error:", err);
    return NextResponse.json({ images: {} }, { status: 500 });
  }
}
