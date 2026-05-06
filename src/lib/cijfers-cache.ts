import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const CACHE_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "cijfers-cache.json");
const TTL_MS = 24 * 60 * 60 * 1000; // 24 uur

export interface CachedCijfers {
  data: unknown;
  timestamp: number;
}

export async function getCachedCijfers(): Promise<unknown | null> {
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

export async function setCachedCijfers(data: unknown): Promise<void> {
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
