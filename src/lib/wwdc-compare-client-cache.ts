import type { WwdcPeriodKey } from "@/config/wwdc";
import type { WwdcComparePayload } from "@/app/api/wwdc/compare/route";

const WWDC_COMPARE_CACHE_VERSION = "v1";

const STORAGE_KEY = `wwdc-compare-${WWDC_COMPARE_CACHE_VERSION}`;

type StoredShape = Partial<Record<WwdcPeriodKey, WwdcComparePayload>>;

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

export function readWwdcCompareClientCache(period: WwdcPeriodKey): WwdcComparePayload | null {
  return readStore()[period] ?? null;
}

export function writeWwdcCompareClientCache(
  period: WwdcPeriodKey,
  payload: WwdcComparePayload
): void {
  const store = readStore();
  store[period] = payload;
  writeStore(store);
}

export function clearWwdcCompareClientCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const WWDC_COMPARE_PERIODS: WwdcPeriodKey[] = ["weekBefore", "startWwdc", "afterWwdc"];
