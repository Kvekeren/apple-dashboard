import Link from "next/link";

import { IdeeenPage } from "@/components/monitoring/pages/ideeen-page";

/** Zelfde inspiratiebord als /ideeen — live API-data. */
export default function IdeeenDemoPage() {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Demo-route met live data.{" "}
        <Link href="/ideeen" className="font-medium text-primary underline-offset-2 hover:underline">
          Permanente URL: /ideeen
        </Link>
      </p>
      <IdeeenPage />
    </div>
  );
}
