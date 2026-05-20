import { MonitoringShell } from "@/components/monitoring/monitoring-shell";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <MonitoringShell>{children}</MonitoringShell>;
}
