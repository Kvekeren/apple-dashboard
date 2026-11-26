import { kvGet, kvGetMany, kvSet } from "@/lib/shared-cache";

/** Paginatitels (og:title). Per URL in de gedeelde cache (lang houdbaar). */
const MAX_AGE_SEC = 60 * 24 * 60 * 60;

function norm(url: string): string {
  return url.replace(/\/$/, "");
}

function key(url: string): string {
  return `title-${norm(url)}`;
}

export async function getCachedTitle(url: string): Promise<string | null> {
  return (await kvGet<string>(key(url)))?.data ?? null;
}

export async function setCachedTitle(url: string, title: string): Promise<void> {
  await kvSet(key(url), title, MAX_AGE_SEC);
}

export async function getCachedTitles(urls: string[]): Promise<Record<string, string>> {
  const found = await kvGetMany<string>(urls.map(key));
  const result: Record<string, string> = {};
  for (const url of urls) {
    const hit = found.get(key(url));
    if (hit?.data) result[url] = hit.data;
  }
  return result;
}
