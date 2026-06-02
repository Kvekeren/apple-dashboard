"use client";

import { useCallback, useRef } from "react";

import { useRegisterPageRefresh } from "@/components/monitoring/monitoring-refresh-context";
import { Inspiratiebord } from "@/components/monitoring/views/inspiratiebord";

export function IdeeenPage() {
  const refreshRef = useRef<(() => void | Promise<void>) | null>(null);

  const refreshAll = useCallback(async () => {
    await refreshRef.current?.();
  }, []);

  useRegisterPageRefresh(refreshAll);

  return (
    <Inspiratiebord
      onRegisterRefresh={(handler) => {
        refreshRef.current = handler;
      }}
    />
  );
}
