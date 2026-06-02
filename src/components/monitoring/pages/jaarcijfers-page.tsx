"use client";

import { useCallback, useEffect, useState } from "react";

import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { JaarcijfersDashboard } from "@/components/monitoring/views/jaarcijfers-dashboard";
import {
  gscClicksRowsToYtdWeekly,
  type YtdWeeklySessionRow,
} from "@/lib/monitoring/shared";

export function JaarcijfersPage() {
  const { gscConnected } = useMonitoringAuth();
  const [pageviewsRows, setPageviewsRows] = useState<YtdWeeklySessionRow[]>([]);
  const [pageviewsRowsPrev, setPageviewsRowsPrev] = useState<YtdWeeklySessionRow[]>([]);
  const [discoverRows, setDiscoverRows] = useState<YtdWeeklySessionRow[]>([]);
  const [discoverRowsPrev, setDiscoverRowsPrev] = useState<YtdWeeklySessionRow[]>([]);
  const [searchRows, setSearchRows] = useState<YtdWeeklySessionRow[]>([]);
  const [searchRowsPrev, setSearchRowsPrev] = useState<YtdWeeklySessionRow[]>([]);
  const [ytdPreviousYear, setYtdPreviousYear] = useState<number | null>(null);
  const [ytdYear, setYtdYear] = useState<number | null>(null);

  const loadAll = useCallback(async (ref = false) => {
    const ga4Url = ref ? "/api/ga4-ytd-sessions?refresh=1" : "/api/ga4-ytd-sessions";
    const gscUrl = ref ? "/api/gsc-ytd-clicks?refresh=1" : "/api/gsc-ytd-clicks";

    const clearAll = () => {
      setPageviewsRows([]);
      setPageviewsRowsPrev([]);
      setDiscoverRows([]);
      setDiscoverRowsPrev([]);
      setSearchRows([]);
      setSearchRowsPrev([]);
      setYtdPreviousYear(null);
      setYtdYear(null);
    };

    try {
      const [ga4Res, gscRes] = await Promise.all([
        fetch(ga4Url, { credentials: "include" }),
        fetch(gscUrl, { credentials: "include" }),
      ]);

      if (ga4Res.ok) {
        const j = await ga4Res.json();
        setPageviewsRows(j.rows ?? []);
        setPageviewsRowsPrev(j.rowsPreviousYear ?? []);
        setYtdPreviousYear(j.meta?.previousYear ?? null);
        setYtdYear(j.meta?.year ?? null);
      } else {
        setPageviewsRows([]);
        setPageviewsRowsPrev([]);
      }

      if (gscRes.ok) {
        const g = await gscRes.json();
        setDiscoverRows(gscClicksRowsToYtdWeekly(g.discover?.rows ?? []));
        setDiscoverRowsPrev(gscClicksRowsToYtdWeekly(g.discover?.rowsPreviousYear ?? []));
        setSearchRows(gscClicksRowsToYtdWeekly(g.search?.rows ?? []));
        setSearchRowsPrev(gscClicksRowsToYtdWeekly(g.search?.rowsPreviousYear ?? []));
        if (g.meta?.year != null) setYtdYear(g.meta.year);
        if (g.meta?.previousYear != null) setYtdPreviousYear(g.meta.previousYear);
      } else {
        setDiscoverRows([]);
        setDiscoverRowsPrev([]);
        setSearchRows([]);
        setSearchRowsPrev([]);
      }

      if (!ga4Res.ok && !gscRes.ok) clearAll();
    } catch {
      clearAll();
    }
  }, []);

  useEffect(() => {
    if (!gscConnected) return;
    void loadAll();
  }, [gscConnected, loadAll]);

  const refreshPage = useCallback(() => loadAll(true), [loadAll]);
  useRegisterPageRefresh(gscConnected ? refreshPage : null, gscConnected);

  return (
    <MonitoringAuthGate>
      <JaarcijfersDashboard
        pageviewsRows={pageviewsRows}
        pageviewsRowsPrevious={pageviewsRowsPrev}
        discoverRows={discoverRows}
        discoverRowsPrevious={discoverRowsPrev}
        searchRows={searchRows}
        searchRowsPrevious={searchRowsPrev}
        ytdPreviousYear={ytdPreviousYear}
        ytdYear={ytdYear}
      />
    </MonitoringAuthGate>
  );
}
