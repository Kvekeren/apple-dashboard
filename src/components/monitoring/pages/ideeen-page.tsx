"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { IdeeenDashboard } from "@/components/monitoring/views/ideeen-dashboard";
import {
  IDEEEN_CATEGORY_SECTIONS,
  type IdeeenApiPayload,
  type IdeeenCategoryKey,
  type DiscoverSnoopArticle,
} from "@/lib/discover-snoop";

const EMPTY_SECTIONS: Record<IdeeenCategoryKey, DiscoverSnoopArticle[]> = {
  tel: [],
  electronics: [],
};

export function IdeeenPage() {
  const [sections, setSections] = useState(EMPTY_SECTIONS);
  const [week, setWeek] = useState<number | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataVersion, setDataVersion] = useState("0");

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setLoadErr(null);
    try {
      const u = refresh ? "/api/discover-snoop?refresh=1" : "/api/discover-snoop";
      const res = await fetch(u);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSections(EMPTY_SECTIONS);
        setWeek(null);
        setLoadErr(body.error ?? "Data laden mislukt");
        return;
      }
      const data = (await res.json()) as IdeeenApiPayload;
      const next: Record<IdeeenCategoryKey, DiscoverSnoopArticle[]> = { ...EMPTY_SECTIONS };
      let weekHint: number | null = null;
      for (const { key } of IDEEEN_CATEGORY_SECTIONS) {
        next[key] = data.sections[key]?.items ?? [];
        const w = data.sections[key]?.meta.week;
        if (w != null) weekHint = w;
      }
      setSections(next);
      setWeek(weekHint);
      setDataVersion(data.fetchedAt ?? String(Date.now()));
    } catch {
      setSections(EMPTY_SECTIONS);
      setWeek(null);
      setLoadErr("Data laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshPage = useCallback(() => load(true), [load]);
  useRegisterPageRefresh(refreshPage);

  const displaySections = useMemo(() => sections, [sections]);

  if (loading && !displaySections.tel.length && !displaySections.electronics.length) {
    return (
      <div className="flex justify-center py-16 text-sm text-muted-foreground">
        Ideeën laden…
      </div>
    );
  }

  return (
    <IdeeenDashboard
      sections={displaySections}
      week={week}
      loadErr={loadErr}
      dataVersion={dataVersion}
    />
  );
}
