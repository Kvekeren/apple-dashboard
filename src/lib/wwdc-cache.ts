import { kvGet, kvSet } from "@/lib/shared-cache";

/** Permanente cache (historische data verandert niet) — gedeeld via shared-cache. */
const MAX_AGE_SEC = 60 * 24 * 60 * 60;

export async function getWwdcCached<T>(key: string): Promise<T | null> {
  return (await kvGet<T>(`wwdc-${key}`))?.data ?? null;
}

export async function setWwdcCached(key: string, data: unknown): Promise<void> {
  await kvSet(`wwdc-${key}`, data, MAX_AGE_SEC);
}

const PAGE_META_CACHE_KEY = "page-meta-images";

export function normalizeWwdcMetaUrl(url: string): string {
  try {
    const u = new URL(url.includes("://") ? url : `https://${url}`);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "") || "/";
    return `${u.protocol}//${u.hostname}${path}`;
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

export async function getWwdcPageMetaStore(): Promise<Record<string, string>> {
  return (await getWwdcCached<Record<string, string>>(PAGE_META_CACHE_KEY)) ?? {};
}

export async function mergeWwdcPageMetaStore(
  images: Record<string, string>
): Promise<Record<string, string>> {
  const store = await getWwdcPageMetaStore();
  for (const [url, imageUrl] of Object.entries(images)) {
    if (imageUrl) store[normalizeWwdcMetaUrl(url)] = imageUrl;
  }
  await setWwdcCached(PAGE_META_CACHE_KEY, store);
  return store;
}
