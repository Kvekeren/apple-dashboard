"use client";

import dynamic from "next/dynamic";

const NewsSitemapsPanelLazy = dynamic(
  () =>
    import("@/components/monitoring/news-sitemaps-client").then((m) => ({
      default: m.NewsSitemapsPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center py-16 text-sm text-muted-foreground">
        Recent laden…
      </div>
    ),
  }
);

export function RecentPage() {
  return <NewsSitemapsPanelLazy />;
}
