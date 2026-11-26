import type { KeynotePeriodKey } from "@/config/keynote";
import type { SiteTitleId } from "@/lib/site-titles";
import type { WwdcArticleTrafficRow } from "@/lib/wwdc-traffic";

export type KeynoteDashboardPayload = {
  meta: {
    startDate: string;
    endDate: string;
    isoWeek: number;
    isoWeekYear: number;
    period: KeynotePeriodKey;
    periodLabel: string;
  };
  byBrand: Record<SiteTitleId, WwdcArticleTrafficRow[]>;
};

const KEYNOTE_CLIENT_CACHE_VERSION = "v2";
const STORAGE_KEY = `keynote-dashboard-${KEYNOTE_CLIENT_CACHE_VERSION}`;

/** Per dag opgeslagen: "volgende week" schuift elke maandag op. */
type StoredShape = { day?: string } & Partial<Record<KeynotePeriodKey, KeynoteDashboardPayload>>;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readStore(): StoredShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredShape;
    return parsed.day === todayKey() ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: StoredShape): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}

export function readKeynoteClientCache(
  period: KeynotePeriodKey
): KeynoteDashboardPayload | null {
  return readStore()[period] ?? null;
}

export function writeKeynoteClientCache(
  period: KeynotePeriodKey,
  payload: KeynoteDashboardPayload
): void {
  const store = readStore();
  store[period] = payload;
  store.day = todayKey();
  writeStore(store);
}

export function clearKeynoteClientCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const KEYNOTE_CLIENT_PERIODS: KeynotePeriodKey[] = ["prevWeek", "thisWeek", "nextWeek"];
