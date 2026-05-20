"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PeriodPreset } from "@/lib/monitoring/shared";

export function DashboardPeriodFilter({
  periodPreset,
  setPeriodPreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: {
  periodPreset: PeriodPreset;
  setPeriodPreset: (p: PeriodPreset) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="fnl-meta-label">Periode</span>
      <Select value={periodPreset} onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}>
        <SelectTrigger size="sm" className="h-8 w-[200px] rounded-[4px] border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Laatste 7 dagen</SelectItem>
          <SelectItem value="28d">Laatste 28 dagen</SelectItem>
          <SelectItem value="365d">Laatste 365 dagen</SelectItem>
          <SelectItem value="custom">Aangepast</SelectItem>
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
  );
}
