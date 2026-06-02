import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

/** Permanente file-cache — alleen gebruikt door /api/wwdc (historische WWDC 2025-data). */
const WWDC_CACHE_DIR = process.env.VERCEL
  ? path.join("/tmp", "wwdc-cache")
  : path.join(process.cwd(), "data", "wwdc-cache");

function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getCachePath(key: string): string {
  return path.join(WWDC_CACHE_DIR, `cache-${safeKey(key)}.json`);
}

export async function getWwdcCached<T>(key: string): Promise<T | null> {
  try {
    const filePath = getCachePath(key);
    if (!existsSync(filePath)) return null;
    const raw = await readFile(filePath, "utf-8");
    const cached = JSON.parse(raw) as { data: T; timestamp: number };
    return cached.data;
  } catch {
    return null;
  }
}

export async function setWwdcCached(key: string, data: unknown): Promise<void> {
  try {
    if (!existsSync(WWDC_CACHE_DIR)) {
      await mkdir(WWDC_CACHE_DIR, { recursive: true });
    }
    const filePath = getCachePath(key);
    const cached = { data, timestamp: Date.now() };
    await writeFile(filePath, JSON.stringify(cached));
  } catch {
    // ignore
  }
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
