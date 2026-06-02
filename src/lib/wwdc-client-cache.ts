import type { WwdcPeriodKey } from "@/config/wwdc";
import type { SiteTitleId } from "@/lib/site-titles";
import type { WwdcArticleTrafficRow } from "@/lib/wwdc-traffic";

export type WwdcDashboardPayload = {
  meta: {
    startDate: string;
    endDate: string;
    period: WwdcPeriodKey;
    periodLabel: string;
  };
  byBrand: Record<SiteTitleId, WwdcArticleTrafficRow[]>;
};

/** Versie — bump bij schema-/filterwijzigingen zodat oude browser-cache vervalt. */
const WWDC_CLIENT_CACHE_VERSION = "v8-images";

const STORAGE_KEY = `wwdc-dashboard-${WWDC_CLIENT_CACHE_VERSION}`;

type StoredShape = Partial<Record<WwdcPeriodKey, WwdcDashboardPayload>>;

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

export function readWwdcClientCache(period: WwdcPeriodKey): WwdcDashboardPayload | null {
  return readStore()[period] ?? null;
}

export function writeWwdcClientCache(period: WwdcPeriodKey, payload: WwdcDashboardPayload): void {
  const store = readStore();
  store[period] = payload;
  writeStore(store);
}

export function clearWwdcClientCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const WWDC_CLIENT_PERIODS: WwdcPeriodKey[] = ["weekBefore", "startWwdc", "afterWwdc"];

export function wwdcClientCacheComplete(): boolean {
  const store = readStore();
  return WWDC_CLIENT_PERIODS.every((p) => Boolean(store[p]));
}
