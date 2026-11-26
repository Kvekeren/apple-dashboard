import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const CACHE_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const CACHE_BASE = path.join(CACHE_DIR, "cijfers-cache-b5");
const TTL_MS = 24 * 60 * 60 * 1000; // 24 uur

export interface CachedCijfers {
  data: unknown;
  timestamp: number;
}

function cachePath(periodKey: string): string {
  const safe = periodKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
  return `${CACHE_BASE}-${safe}.json`;
}

export async function getCachedCijfers(periodKey: string): Promise<unknown | null> {
  const CACHE_FILE = cachePath(periodKey);
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = await readFile(CACHE_FILE, "utf-8");
    const cached: CachedCijfers = JSON.parse(raw);
    if (Date.now() - cached.timestamp > TTL_MS) return null;
    return cached.data;
  } catch {
    return null;
  }
}

export async function setCachedCijfers(data: unknown, periodKey: string): Promise<void> {
  const CACHE_FILE = cachePath(periodKey);
  try {
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }
    const cached: CachedCijfers = { data, timestamp: Date.now() };
    await writeFile(CACHE_FILE, JSON.stringify(cached));
  } catch {
    // ignore - e.g. read-only filesystem
  }
}
