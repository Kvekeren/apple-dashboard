"use client";

import { useCallback } from "react";

import { KeynoteDashboard } from "@/components/keynote/KeynoteDashboard";
import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";

export function KeynotePage() {
  const { gscConnected } = useMonitoringAuth();

  const refreshPage = useCallback(() => {
    window.dispatchEvent(new CustomEvent("keynote-refresh"));
  }, []);

  useRegisterPageRefresh(gscConnected ? refreshPage : null, gscConnected);

  return (
    <MonitoringAuthGate>
      <KeynoteDashboard />
    </MonitoringAuthGate>
  );
}
