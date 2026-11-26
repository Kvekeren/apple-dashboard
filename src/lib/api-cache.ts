import { after } from "next/server";

import { kvGet, kvSet } from "@/lib/shared-cache";

/**
 * Cache voor API-payloads (gedeeld tussen alle serverinstanties, zie shared-cache.ts).
 * Verhoog BRAND_SET_VERSION bij een andere merkenset zodat oude payloads zonder die merken vervallen.
 */
const BRAND_SET_VERSION = "b5";

function fullKey(key: string): string {
  return `api-${BRAND_SET_VERSION}-${key}`;
}

export async function getCached<T>(key: string, ttlMs: number): Promise<T | null> {
  const entry = await kvGet<T>(fullKey(key));
  if (!entry || Date.now() - entry.timestamp > ttlMs) return null;
  return entry.data;
}

export async function setCached(key: string, data: unknown): Promise<void> {
  await kvSet(fullKey(key), data);
}

export const TTL = {
  MINUTES_30: 30 * 60 * 1000,
  HOURS_2: 2 * 60 * 60 * 1000,
  HOURS_6: 6 * 60 * 60 * 1000,
  HOURS_24: 24 * 60 * 60 * 1000,
} as const;

/** Bij te oude data (bijv. na een week) niet meer stale serveren maar opnieuw laten wachten. */
const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

/** Lopende achtergrond-verversingen per instantie, zodat we dezelfde sleutel niet dubbel ophalen. */
const refreshing = new Set<string>();

export class NotConnectedError extends Error {
  constructor() {
    super("Niet verbonden met Google");
  }
}

/**
 * Stale-while-revalidate:
 * - vers in de cache → direct teruggeven;
 * - verlopen maar < 7 dagen oud → direct de oude data teruggeven en ná het antwoord op de
 *   achtergrond verversen (Next `after`);
 * - niets bruikbaars (of `force`) → nu ophalen, opslaan en teruggeven.
 *
 * Het Google-token wordt altijd eerst, tijdens het verzoek, opgehaald (`getToken`): zonder login
 * geen data (ook niet uit de cache), en een token-refresh schrijft cookies, wat na het antwoord
 * niet meer kan.
 */
export async function cachedWithRevalidate<T>(
  key: string,
  ttlMs: number,
  getToken: () => Promise<string | null>,
  compute: (accessToken: string) => Promise<T>,
  opts: { force?: boolean; isUsable?: (data: T) => boolean; shouldStore?: (data: T) => boolean } = {}
): Promise<{ data: T; cache: "hit" | "stale" | "miss" }> {
  const k = fullKey(key);
  const store = async (data: T) => {
    if (!opts.shouldStore || opts.shouldStore(data)) await kvSet(k, data);
  };
  // Ook gecachete data alleen voor ingelogde gebruikers (de cache is gedeeld).
  const token = await getToken();
  if (!token) throw new NotConnectedError();

  if (!opts.force) {
    const entry = await kvGet<T>(k);
    if (entry && (!opts.isUsable || opts.isUsable(entry.data))) {
      const age = Date.now() - entry.timestamp;
      if (age <= ttlMs) return { data: entry.data, cache: "hit" };
      if (age <= MAX_STALE_MS) {
        if (!refreshing.has(k)) {
          refreshing.add(k);
          after(async () => {
            try {
              await store(await compute(token));
            } catch (err) {
              console.error(`verversen ${key} mislukt`, err);
            } finally {
              refreshing.delete(k);
            }
          });
        }
        return { data: entry.data, cache: "stale" };
      }
    }
  }
  const data = await compute(token);
  await store(data);
  return { data, cache: "miss" };
}
