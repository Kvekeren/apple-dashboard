import { redirect } from "next/navigation";

/** Legacy URL → home. */
export default function MonitoringLegacyRedirect() {
  redirect("/");
}
