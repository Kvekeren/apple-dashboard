"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type RefreshHandler = () => void | Promise<void>;

type MonitoringRefreshContextValue = {
  refreshing: boolean;
  refreshAvailable: boolean;
  registerRefresh: (handler: RefreshHandler | null) => void;
  runRefresh: () => void;
};

const MonitoringRefreshContext = createContext<MonitoringRefreshContextValue | null>(null);

export function MonitoringRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshAvailable, setRefreshAvailable] = useState(false);
  const handlerRef = useRef<RefreshHandler | null>(null);

  const registerRefresh = useCallback((handler: RefreshHandler | null) => {
    handlerRef.current = handler;
    setRefreshAvailable(handler != null);
  }, []);

  const runRefresh = useCallback(() => {
    const fn = handlerRef.current;
    if (!fn) return;
    void (async () => {
      setRefreshing(true);
      try {
        await fn();
      } finally {
        setRefreshing(false);
      }
    })();
  }, []);

  return (
    <MonitoringRefreshContext.Provider
      value={{ refreshing, refreshAvailable, registerRefresh, runRefresh }}
    >
      {children}
    </MonitoringRefreshContext.Provider>
  );
}

export function useMonitoringRefresh() {
  const ctx = useContext(MonitoringRefreshContext);
  if (!ctx) throw new Error("useMonitoringRefresh must be used within MonitoringRefreshProvider");
  return ctx;
}

export function useRegisterPageRefresh(handler: RefreshHandler | null, enabled = true) {
  const { registerRefresh } = useMonitoringRefresh();

  useEffect(() => {
    if (!enabled) {
      registerRefresh(null);
      return;
    }
    registerRefresh(handler);
    return () => registerRefresh(null);
  }, [enabled, handler, registerRefresh]);
}
