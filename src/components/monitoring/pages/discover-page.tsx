"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { DiscoverDashboard } from "@/components/monitoring/views/discover-dashboard";
import {
  SOURCE_LABELS,
  sourceFromArticleUrl,
  type GscPayload,
} from "@/lib/monitoring/shared";

const DISCOVER_RANGE_QS = "days=28";

export function DiscoverPage() {
  const { gscConnected } = useMonitoringAuth();
  const [discRows, setDiscRows] = useState<
    { url: string; clicks: number; impressions: number; source: string }[]
  >([]);
  const [discTit, setDiscTit] = useState<Record<string, string>>({});
  const [discExp, setDiscExp] = useState<Record<string, number>>({});

  const norm = (u: string) => u.replace(/\/$/, "");

  const bySrcDisc = useMemo(() => {
    const g: Record<string, typeof discRows> = {};
    for (const l of SOURCE_LABELS) g[l] = [];
    for (const row of discRows) {
      if (SOURCE_LABELS.includes(row.source as (typeof SOURCE_LABELS)[number]))
        g[row.source].push(row);
    }
    return g;
  }, [discRows]);

  const discTopUrls = useMemo(() => {
    const u: string[] = [];
    for (const s of SOURCE_LABELS) {
      const rs = bySrcDisc[s] ?? [];
      for (let i = 0; i < Math.min(5, rs.length); i++) u.push(rs[i].url);
    }
    return u;
  }, [bySrcDisc]);

  const loadGsc = useCallback(async (ref = false) => {
    try {
      const u = ref
        ? `/api/search-console?${DISCOVER_RANGE_QS}&refresh=1`
        : `/api/search-console?${DISCOVER_RANGE_QS}`;
      const res = await fetch(u, { credentials: "include" });
      if (!res.ok) {
        setDiscRows([]);
        return;
      }
      const data = (await res.json()) as GscPayload;
      setDiscRows(
        Object.entries(data.discoverByUrl ?? {})
          .filter(([, s]) => s.impressions > 0)
          .map(([url, s]) => ({ url, ...s, source: sourceFromArticleUrl(url) }))
          .sort((a, b) => b.clicks - a.clicks)
      );
    } catch {
      setDiscRows([]);
    }
  }, []);

  useEffect(() => {
    if (!gscConnected) return;
    void loadGsc();
  }, [gscConnected, loadGsc]);

  useEffect(() => {
    if (!gscConnected || !discTopUrls.length) return;
    fetch("/api/fetch-titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: discTopUrls }),
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((x: { titles?: Record<string, string> }) => {
        if (x.titles) setDiscTit((p) => ({ ...p, ...x.titles }));
      });
  }, [gscConnected, discTopUrls]);

  const refreshPage = useCallback(() => loadGsc(true), [loadGsc]);
  useRegisterPageRefresh(gscConnected ? refreshPage : null, gscConnected);

  return (
    <MonitoringAuthGate>
      <DiscoverDashboard
        bySrcDisc={bySrcDisc}
        visLabels={[...SOURCE_LABELS]}
        discExp={discExp}
        setDiscExp={setDiscExp}
        urlArticle={{}}
        discTit={discTit}
        norm={norm}
      />
    </MonitoringAuthGate>
  );
}
