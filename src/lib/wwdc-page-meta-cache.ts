import { WWDC_CLIENT_PERIODS, readWwdcClientCache } from "@/lib/wwdc-client-cache";

/** Versie — bump samen met wwdc-client-cache bij schema-wijzigingen. */
export const WWDC_PAGE_META_CACHE_VERSION = "v8-images";

const STORAGE_KEY = `wwdc-page-meta-${WWDC_PAGE_META_CACHE_VERSION}`;

function normalizeMetaUrl(url: string): string {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "") || "/";
    return `${u.protocol}//${u.hostname}${path}`;
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

function readStore(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota
  }
}

export function readWwdcPageMetaForUrls(urls: readonly string[]): Record<string, string> {
  const store = readStore();
  const out: Record<string, string> = {};
  for (const url of urls) {
    const key = normalizeMetaUrl(url);
    const img = store[key];
    if (!img) continue;
    out[url] = img;
    const normalized = url.replace(/\/$/, "");
    if (normalized !== url) out[normalized] = img;
  }
  return out;
}

export function mergeWwdcPageMetaCache(images: Record<string, string>): void {
  const store = readStore();
  for (const [url, imageUrl] of Object.entries(images)) {
    if (imageUrl) store[normalizeMetaUrl(url)] = imageUrl;
  }
  writeStore(store);
}

export function clearWwdcPageMetaCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Alle artikel-URL's uit gecachte WWDC-periodes (max ~225 unieke). */
export function collectWwdcArticleUrlsFromCache(): string[] {
  const urls = new Set<string>();
  for (const period of WWDC_CLIENT_PERIODS) {
    const payload = readWwdcClientCache(period);
    if (!payload) continue;
    for (const rows of Object.values(payload.byBrand)) {
      for (const row of rows) urls.add(row.url);
    }
  }
  return [...urls];
}

export async function fetchAndCacheWwdcPageImages(
  urls: readonly string[],
  force = false
): Promise<Record<string, string>> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (!unique.length) return readWwdcPageMetaForUrls(unique);

  const cached = force ? {} : readWwdcPageMetaForUrls(unique);
  const missing = unique.filter((u) => !cached[u] && !cached[u.replace(/\/$/, "")]);
  if (!missing.length && !force) return cached;

  const res = await fetch("/api/wwdc/page-meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: unique, refresh: force }),
  });

  if (!res.ok) return cached;

  const body = (await res.json()) as { images?: Record<string, string> };
  const fetched = body.images ?? {};
  mergeWwdcPageMetaCache(fetched);
  return { ...cached, ...fetched };
}
