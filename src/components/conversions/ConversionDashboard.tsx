"use client";

import { useState } from "react";

import { ConversionBrandTab } from "@/components/conversions/ConversionBrandTab";
import {
  ConversionGroupFilter,
  ConversionPeriodFilter,
} from "@/components/conversions/ConversionFilters";
import { groupOptionsForBrand } from "@/components/conversions/ConversionEventsTable";
import type { ConversionGroupFilterId } from "@/config/conversion-events";
import type {
  ConversionCompareMode,
  ConversionPeriodPreset,
} from "@/lib/conversion-types";
import type { SiteTitleId } from "@/lib/site-titles";

const BRAND_TABS: { id: SiteTitleId; label: string }[] = [
  { id: "icreate", label: "iCreate" },
  { id: "iphoned", label: "iPhoned" },
  { id: "iculture", label: "iCulture" },
];

export function ConversionDashboard() {
  const [activeBrand, setActiveBrand] = useState<SiteTitleId>("icreate");
  const [periodPreset, setPeriodPreset] = useState<ConversionPeriodPreset>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [compareMode, setCompareMode] = useState<ConversionCompareMode>("previous");
  const [groupFilter, setGroupFilter] = useState<ConversionGroupFilterId>("all");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Conversies</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Inzicht in conversies, clicks, engagement, affiliate, advertenties en leads per
          Apple-merk.
        </p>
        <div className="mt-4 space-y-3">
          <ConversionPeriodFilter
            periodPreset={periodPreset}
            setPeriodPreset={setPeriodPreset}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
            compareMode={compareMode}
            setCompareMode={setCompareMode}
          />
          <ConversionGroupFilter
            value={groupFilter}
            onChange={(v) => setGroupFilter(v as ConversionGroupFilterId)}
            options={groupOptionsForBrand()}
          />
        </div>
      </header>

      <div className="fnl-segment w-full max-w-lg" role="tablist" aria-label="Merk">
        {BRAND_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeBrand === tab.id}
            data-active={activeBrand === tab.id ? "true" : "false"}
            className="fnl-segment-item flex-1 px-4 py-2 text-sm font-medium"
            onClick={() => setActiveBrand(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ConversionBrandTab
        key={`${activeBrand}-${periodPreset}-${customStart}-${customEnd}-${compareMode}-${groupFilter}`}
        brandId={activeBrand}
        periodPreset={periodPreset}
        customStart={customStart}
        customEnd={customEnd}
        compareMode={compareMode}
        groupFilter={groupFilter}
      />
    </div>
  );
}
