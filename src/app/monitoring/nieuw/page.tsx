import { redirect } from "next/navigation";

/** Legacy URL voor de oude Recent-pagina. */
export default function NieuwLegacyRedirectPage() {
  redirect("/");
}
