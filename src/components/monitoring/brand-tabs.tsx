"use client";

import { favIconUrl } from "@/lib/monitoring/shared";
import { APPLE_TITLE_TABS, type SiteTitleId } from "@/lib/site-titles";

export const BRAND_TAB_ITEMS: { id: SiteTitleId; label: string }[] = APPLE_TITLE_TABS.filter(
  (t): t is { id: SiteTitleId; label: string } => t.id !== "all"
);

/** Vijf merk-tabs (favicon + naam), scrollt horizontaal op smalle schermen. */
export function BrandTabs({
  value,
  onChange,
  ariaLabel = "Merk",
}: {
  value: SiteTitleId;
  onChange: (id: SiteTitleId) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="max-w-full overflow-x-auto [scrollbar-width:none]">
      <div className="fnl-segment" role="tablist" aria-label={ariaLabel}>
        {BRAND_TAB_ITEMS.map((tab) => {
          const fav = favIconUrl(tab.label);
          const active = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-active={active ? "true" : "false"}
              className="fnl-segment-item flex shrink-0 items-center gap-2 px-4 py-2 whitespace-nowrap"
              onClick={() => onChange(tab.id)}
            >
              {fav ? <img alt="" src={fav} className="size-4 rounded-[3px]" /> : null}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Kleine segment-schakelaar (bijv. periode of weergave). */
export function SegmentSwitch<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { id: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div className="fnl-segment" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          data-active={value === o.id ? "true" : "false"}
          className="fnl-segment-item whitespace-nowrap"
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
