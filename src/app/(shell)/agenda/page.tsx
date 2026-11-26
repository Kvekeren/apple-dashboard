import { redirect } from "next/navigation";

/** De Agenda-tab is vervangen door Artikelen. */
export default function Page() {
  redirect("/artikelen");
}
