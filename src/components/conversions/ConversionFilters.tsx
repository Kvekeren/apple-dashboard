"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConversionCompareMode, ConversionPeriodPreset } from "@/lib/conversion-types";

const PRESET_LABELS: Record<ConversionPeriodPreset, string> = {
  today: "Vandaag",
  yesterday: "Gisteren",
  "7d": "Afgelopen 7 dagen",
  "28d": "Afgelopen 28 dagen",
  ytd: "Dit jaar",
  custom: "Aangepaste periode",
};

export function ConversionPeriodFilter({
  periodPreset,
  setPeriodPreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  compareMode,
  setCompareMode,
}: {
  periodPreset: ConversionPeriodPreset;
  setPeriodPreset: (p: ConversionPeriodPreset) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
  compareMode: ConversionCompareMode;
  setCompareMode: (m: ConversionCompareMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="fnl-meta-label">Periode</span>
        <Select
          value={periodPreset}
          onValueChange={(v) => setPeriodPreset(v as ConversionPeriodPreset)}
        >
          <SelectTrigger size="sm" className="h-8 w-[200px] rounded-[4px] border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PRESET_LABELS) as ConversionPeriodPreset[]).map((key) => (
              <SelectItem key={key} value={key}>
                {PRESET_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {periodPreset === "custom" && (
          <>
            <Input
              type="date"
              className="h-8 w-[145px] rounded-[4px]"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-muted-foreground">tot</span>
            <Input
              type="date"
              className="h-8 w-[145px] rounded-[4px]"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="fnl-meta-label">Vergelijk met</span>
        <Select
          value={compareMode}
          onValueChange={(v) => setCompareMode(v as ConversionCompareMode)}
        >
          <SelectTrigger size="sm" className="h-8 w-[220px] rounded-[4px] border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="previous">Vorige periode</SelectItem>
            <SelectItem value="yoy">Zelfde periode vorig jaar</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function ConversionGroupFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="fnl-meta-label">Eventgroep</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger size="sm" className="h-8 w-[220px] rounded-[4px] border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
