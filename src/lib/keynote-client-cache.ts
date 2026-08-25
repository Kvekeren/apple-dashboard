import type { KeynotePeriodKey } from "@/config/keynote";
import type { SiteTitleId } from "@/lib/site-titles";
import type { WwdcArticleTrafficRow } from "@/lib/wwdc-traffic";

export type KeynoteDashboardPayload = {
  meta: {
    year: 2025;
    startDate: string;
    endDate: string;
    period: KeynotePeriodKey;
    periodLabel: string;
  };
  byBrand: Record<SiteTitleId, WwdcArticleTrafficRow[]>;
};

const KEYNOTE_CLIENT_CACHE_VERSION = "v1";
const STORAGE_KEY = `keynote-dashboard-${KEYNOTE_CLIENT_CACHE_VERSION}`;

type StoredShape = Partial<Record<KeynotePeriodKey, KeynoteDashboardPayload>>;

function readStore(): StoredShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredShape;
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
  writeStore(store);
}

export function clearKeynoteClientCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const KEYNOTE_CLIENT_PERIODS: KeynotePeriodKey[] = [
  "weekBefore",
  "startWwdc",
  "afterWwdc",
];
