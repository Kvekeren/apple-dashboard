import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const CACHE_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");

function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getCachePath(key: string): string {
  return path.join(CACHE_DIR, `cache-${safeKey(key)}.json`);
}

export async function getCached<T>(
  key: string,
  ttlMs: number
): Promise<T | null> {
  try {
    const filePath = getCachePath(key);
    if (!existsSync(filePath)) return null;
    const raw = await readFile(filePath, "utf-8");
    const cached = JSON.parse(raw) as { data: T; timestamp: number };
    if (Date.now() - cached.timestamp > ttlMs) return null;
    return cached.data;
  } catch {
    return null;
  }
}

export async function setCached(key: string, data: unknown): Promise<void> {
  try {
    if (!existsSync(CACHE_DIR)) {
      await mkdir(CACHE_DIR, { recursive: true });
    }
    const filePath = getCachePath(key);
    const cached = { data, timestamp: Date.now() };
    await writeFile(filePath, JSON.stringify(cached));
  } catch {
    // ignore
  }
}

export const TTL = {
  HOURS_2: 2 * 60 * 60 * 1000,
  HOURS_24: 24 * 60 * 60 * 1000,
} as const;
