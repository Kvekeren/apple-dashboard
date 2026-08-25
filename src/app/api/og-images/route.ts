import { NextRequest, NextResponse } from "next/server";
import { fetchPageOgMeta } from "@/lib/og-meta";
import { getCachedOgImages, setCachedOgImage } from "@/lib/og-image-cache";

const MAX_URLS = 40;
const CONCURRENCY = 8;

function store(map: Record<string, string>, url: string, imageUrl: string) {
  map[url] = imageUrl;
  map[url.replace(/\/$/, "")] = imageUrl;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const urls = Array.isArray(body.urls) ? body.urls : [];
    const trimmed = urls
      .filter((u: unknown): u is string => typeof u === "string")
      .map((u: string) => u.trim())
      .filter(Boolean)
      .slice(0, MAX_URLS);

    if (!trimmed.length) return NextResponse.json({ images: {} });

    const images: Record<string, string> = { ...(await getCachedOgImages(trimmed)) };
    const missing = trimmed.filter((u) => !images[u] && !images[u.replace(/\/$/, "")]);

    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const batch = missing.slice(i, i + CONCURRENCY);
      const metas = await Promise.all(batch.map((url) => fetchPageOgMeta(url)));
      await Promise.all(
        batch.map(async (url, j) => {
          const imageUrl = metas[j]?.imageUrl;
          if (!imageUrl) return;
          store(images, url, imageUrl);
          await setCachedOgImage(url, imageUrl);
        })
      );
    }

    return NextResponse.json({ images });
  } catch (err) {
    console.error("og-images", err);
    return NextResponse.json({ images: {} }, { status: 500 });
  }
}
