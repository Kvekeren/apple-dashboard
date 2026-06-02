"use client";

import { useCallback } from "react";

import { MonitoringAuthGate } from "@/components/monitoring/auth-gate";
import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { ConversionDashboard } from "@/components/conversions/ConversionDashboard";

export function ConversiePage() {
  const { gscConnected } = useMonitoringAuth();

  const refreshPage = useCallback(() => {
    window.dispatchEvent(new CustomEvent("conversions-refresh"));
  }, []);

  useRegisterPageRefresh(gscConnected ? refreshPage : null, gscConnected);

  return (
    <MonitoringAuthGate>
      <ConversionDashboard />
    </MonitoringAuthGate>
  );
}
