import { redirect } from "next/navigation";

/** Legacy URL → Recent. */
export default function NieuwLegacyRedirectPage() {
  redirect("/recent");
}
