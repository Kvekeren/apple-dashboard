import { createHash } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { gunzipSync, gzipSync } from "zlib";

import { getCache } from "@vercel/functions";

/**
 * Gedeelde key-value-cache voor alle API-routes.
 *
 * - Op Vercel: de Runtime Cache, gedeeld door alle functie-instanties in de regio. (Vroeger
 *   schreven we naar /tmp, maar dat is per instantie, waardoor de cache vaak gemist werd.)
 * - Lokaal: één JSON-bestand per sleutel in data/kv/ (staat in .gitignore).
 *
 * Waarden worden gzip-gecomprimeerd opgeslagen: grote GA4/GSC-payloads (alle URL's) worden zo
 * ±10× kleiner, wat binnen de itemlimiet van de Runtime Cache blijft.
 */

export type CacheEntry<T> = { data: T; timestamp: number };

const ON_VERCEL = Boolean(process.env.VERCEL);
const NAMESPACE = "apple-dashboard";
/** Hoe lang de Runtime Cache een item maximaal bewaart; versheid bepalen we zelf met `timestamp`. */
const DEFAULT_MAX_AGE_SEC = 14 * 24 * 60 * 60;

const LOCAL_DIR = path.join(process.cwd(), "data", "kv");

function localPath(key: string): string {
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 16);
  const readable = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return path.join(LOCAL_DIR, `${readable}-${hash}.json.gz`);
}

function encode(entry: CacheEntry<unknown>): string {
  return gzipSync(Buffer.from(JSON.stringify(entry))).toString("base64");
}

function decode<T>(raw: unknown): CacheEntry<T> | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(gunzipSync(Buffer.from(raw, "base64")).toString("utf-8")) as CacheEntry<T>;
  } catch {
    return null;
  }
}

/** Kleine per-instantie geheugencache voor herhaalde reads binnen dezelfde functie. */
const memory = new Map<string, CacheEntry<unknown>>();
const MEMORY_MAX = 2000;

function remember(key: string, entry: CacheEntry<unknown>) {
  if (memory.size >= MEMORY_MAX) memory.delete(memory.keys().next().value as string);
  memory.set(key, entry);
}

export async function kvGet<T>(key: string): Promise<CacheEntry<T> | null> {
  const mem = memory.get(key);
  if (mem) return mem as CacheEntry<T>;
  try {
    let entry: CacheEntry<T> | null = null;
    if (ON_VERCEL) {
      entry = decode<T>(await getCache({ namespace: NAMESPACE }).get(key));
    } else {
      const file = localPath(key);
      if (existsSync(file)) entry = decode<T>((await readFile(file)).toString("utf-8"));
    }
    if (entry) remember(key, entry);
    return entry;
  } catch (err) {
    console.warn(`cache get mislukt (${key}):`, String(err).slice(0, 160));
    return null;
  }
}

export async function kvSet(key: string, data: unknown, maxAgeSec = DEFAULT_MAX_AGE_SEC): Promise<void> {
  const entry: CacheEntry<unknown> = { data, timestamp: Date.now() };
  remember(key, entry);
  try {
    const encoded = encode(entry);
    if (ON_VERCEL) {
      await getCache({ namespace: NAMESPACE }).set(key, encoded, { ttl: maxAgeSec, name: key.slice(0, 120) });
    } else {
      if (!existsSync(LOCAL_DIR)) await mkdir(LOCAL_DIR, { recursive: true });
      await writeFile(localPath(key), encoded);
    }
  } catch (err) {
    console.warn(`cache set mislukt (${key}):`, String(err).slice(0, 160));
  }
}

/** Meerdere sleutels tegelijk (parallel). */
export async function kvGetMany<T>(keys: string[]): Promise<Map<string, CacheEntry<T>>> {
  const unique = [...new Set(keys)];
  const results = await Promise.all(unique.map((k) => kvGet<T>(k)));
  const out = new Map<string, CacheEntry<T>>();
  unique.forEach((k, i) => {
    const r = results[i];
    if (r) out.set(k, r);
  });
  return out;
}
