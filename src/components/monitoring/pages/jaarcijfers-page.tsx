"use client";

import { useCallback, useEffect, useState } from "react";

import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { JaarcijfersDashboard } from "@/components/monitoring/views/jaarcijfers-dashboard";
import type { YtdWeeklySessionRow } from "@/lib/monitoring/shared";

export function JaarcijfersPage() {
  const { gscConnected } = useMonitoringAuth();
  const [ytdRows, setYtdRows] = useState<YtdWeeklySessionRow[]>([]);
  const [ytdRowsPrev, setYtdRowsPrev] = useState<YtdWeeklySessionRow[]>([]);
  const [ytdPreviousYear, setYtdPreviousYear] = useState<number | null>(null);
  const [ytdYear, setYtdYear] = useState<number | null>(null);

  const loadYtd = useCallback(async (ref = false) => {
    const u = ref ? "/api/ga4-ytd-sessions?refresh=1" : "/api/ga4-ytd-sessions";
    try {
      const res = await fetch(u, { credentials: "include" });
      if (!res.ok) {
        setYtdRows([]);
        setYtdRowsPrev([]);
        setYtdPreviousYear(null);
        setYtdYear(null);
        return;
      }
      const j = await res.json();
      setYtdRows(j.rows ?? []);
      setYtdRowsPrev(j.rowsPreviousYear ?? []);
      setYtdPreviousYear(j.meta?.previousYear ?? null);
      setYtdYear(j.meta?.year ?? null);
    } catch {
      setYtdRows([]);
      setYtdRowsPrev([]);
      setYtdPreviousYear(null);
      setYtdYear(null);
    }
  }, []);

  useEffect(() => {
    if (!gscConnected) return;
    void loadYtd();
  }, [gscConnected, loadYtd]);

  const refreshPage = useCallback(() => loadYtd(true), [loadYtd]);
  useRegisterPageRefresh(gscConnected ? refreshPage : null, gscConnected);

  return (
    <MonitoringAuthGate>
      <JaarcijfersDashboard
        ytdWeeklyRows={ytdRows}
        ytdWeeklyRowsPrevious={ytdRowsPrev}
        ytdPreviousYear={ytdPreviousYear}
        ytdYear={ytdYear}
      />
    </MonitoringAuthGate>
  );
}
