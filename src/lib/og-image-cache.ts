import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const CACHE_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "og-image-cache.json");

let memoryCache: Record<string, string> = {};

async function loadCache(): Promise<Record<string, string>> {
  if (Object.keys(memoryCache).length > 0) return memoryCache;
  try {
    if (existsSync(CACHE_FILE)) {
      const data = await readFile(CACHE_FILE, "utf-8");
      memoryCache = JSON.parse(data);
    }
  } catch {
    // ignore
  }
  return memoryCache;
}

async function saveCache(cache: Record<string, string>): Promise<void> {
  memoryCache = cache;
  try {
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }
    await writeFile(CACHE_FILE, JSON.stringify(cache, null, 0));
  } catch {
    // ignore
  }
}

export async function getCachedOgImage(url: string): Promise<string | null> {
  const cache = await loadCache();
  const normalized = url.replace(/\/$/, "");
  const img = cache[normalized] ?? cache[url];
  return img ?? null;
}

export async function setCachedOgImage(url: string, imageUrl: string): Promise<void> {
  const cache = await loadCache();
  const normalized = url.replace(/\/$/, "");
  cache[normalized] = imageUrl;
  await saveCache(cache);
}

export async function getCachedOgImages(urls: string[]): Promise<Record<string, string>> {
  const cache = await loadCache();
  const result: Record<string, string> = {};
  for (const url of urls) {
    const normalized = url.replace(/\/$/, "");
    const img = cache[normalized] ?? cache[url];
    if (img) result[url] = img;
  }
  return result;
}
