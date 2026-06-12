import type { WwdcPeriodKey, WwdcYear } from "@/config/wwdc";
import type { SiteTitleId } from "@/lib/site-titles";
import type { WwdcArticleTrafficRow } from "@/lib/wwdc-traffic";

export type WwdcDashboardPayload = {
  meta: {
    year: WwdcYear;
    startDate: string;
    endDate: string;
    period: WwdcPeriodKey;
    periodLabel: string;
  };
  byBrand: Record<SiteTitleId, WwdcArticleTrafficRow[]>;
};

/** Versie — bump bij schema-/filterwijzigingen zodat oude browser-cache vervalt. */
const WWDC_CLIENT_CACHE_VERSION = "v10-multi-year";

function storageKey(year: WwdcYear): string {
  return `wwdc-dashboard-${WWDC_CLIENT_CACHE_VERSION}-${year}`;
}

type StoredShape = Partial<Record<WwdcPeriodKey, WwdcDashboardPayload>>;

function readStore(year: WwdcYear): StoredShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(year));
    if (!raw) return {};
    return JSON.parse(raw) as StoredShape;
  } catch {
    return {};
  }
}

function writeStore(year: WwdcYear, store: StoredShape): void {
  try {
    localStorage.setItem(storageKey(year), JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}

export function readWwdcClientCache(
  year: WwdcYear,
  period: WwdcPeriodKey
): WwdcDashboardPayload | null {
  return readStore(year)[period] ?? null;
}

export function writeWwdcClientCache(
  year: WwdcYear,
  period: WwdcPeriodKey,
  payload: WwdcDashboardPayload
): void {
  const store = readStore(year);
  store[period] = payload;
  writeStore(year, store);
}

export function clearWwdcClientCache(year: WwdcYear): void {
  try {
    localStorage.removeItem(storageKey(year));
  } catch {
    // ignore
  }
}

export const WWDC_CLIENT_PERIODS: WwdcPeriodKey[] = ["weekBefore", "startWwdc", "afterWwdc"];

export function wwdcClientCacheComplete(year: WwdcYear): boolean {
  const store = readStore(year);
  return WWDC_CLIENT_PERIODS.every((p) => Boolean(store[p]));
}
