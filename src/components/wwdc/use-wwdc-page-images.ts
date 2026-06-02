"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { urlsToFetchKey } from "@/lib/monitoring/use-fetch-page-meta";
import {
  fetchAndCacheWwdcPageImages,
  readWwdcPageMetaForUrls,
} from "@/lib/wwdc-page-meta-cache";

/** OG-afbeeldingen voor WWDC — localStorage + permanente /api/wwdc/page-meta cache. */
export function useWwdcPageImages(urls: readonly string[], enabled: boolean) {
  const urlKey = useMemo(() => urlsToFetchKey(urls), [urls]);
  const [images, setImages] = useState<Record<string, string>>(() =>
    enabled && urlKey ? readWwdcPageMetaForUrls(urlKey.split("\n")) : {}
  );
  const lastFetchedKey = useRef("");

  useEffect(() => {
    if (!enabled || !urlKey) return;

    const urlList = urlKey.split("\n");
    const cached = readWwdcPageMetaForUrls(urlList);
    setImages((prev) => ({ ...cached, ...prev }));

    const allCached = urlList.every(
      (u) => cached[u] || cached[u.replace(/\/$/, "")]
    );
    if (allCached) {
      lastFetchedKey.current = urlKey;
      return;
    }

    if (urlKey === lastFetchedKey.current) return;
    lastFetchedKey.current = urlKey;

    let cancelled = false;
    void fetchAndCacheWwdcPageImages(urlList)
      .then((merged) => {
        if (!cancelled) setImages((prev) => ({ ...prev, ...merged }));
      })
      .catch(() => {
        if (!cancelled) lastFetchedKey.current = "";
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, urlKey]);

  return images;
}

/** Prefetch afbeeldingen voor alle artikelen in de WWDC-cache (achtergrond). */
export function prefetchWwdcPageImages(urls: readonly string[], force = false): void {
  if (!urls.length) return;
  void fetchAndCacheWwdcPageImages(urls, force).catch(() => {
    /* stille achtergrond-prefetch */
  });
}
