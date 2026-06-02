"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** Stabiele sleutel op URL-set, zodat titel-updates geen nieuwe fetch-trigger geven. */
export function urlsToFetchKey(urls: readonly string[]): string {
  return [...new Set(urls.map((u) => u.trim()).filter(Boolean))].sort().join("\n");
}

export function useFetchPageTitlesAndImages(
  urls: readonly string[],
  enabled: boolean
): {
  titles: Record<string, string>;
  images: Record<string, string>;
  dates: Record<string, string>;
} {
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [images, setImages] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const urlKey = useMemo(() => urlsToFetchKey(urls), [urls]);
  const lastFetchedKey = useRef("");

  useEffect(() => {
    if (!enabled || !urlKey) return;
    if (urlKey === lastFetchedKey.current) return;
    lastFetchedKey.current = urlKey;

    const urlList = urlKey.split("\n");
    let cancelled = false;

    fetch("/api/fetch-titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: urlList }),
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then(
        (x: {
          titles?: Record<string, string>;
          images?: Record<string, string>;
          dates?: Record<string, string>;
        }) => {
        if (cancelled) return;
        if (x.titles) {
          const merged: Record<string, string> = {};
          for (const [url, title] of Object.entries(x.titles)) {
            const n = url.replace(/\/$/, "");
            merged[url] = title;
            merged[n] = title;
          }
          setTitles((p) => ({ ...p, ...merged }));
        }
        if (x.images) {
          const merged: Record<string, string> = {};
          for (const [url, image] of Object.entries(x.images)) {
            const n = url.replace(/\/$/, "");
            merged[url] = image;
            merged[n] = image;
          }
          setImages((p) => ({ ...p, ...merged }));
        }
        if (x.dates) {
          const merged: Record<string, string> = {};
          for (const [url, date] of Object.entries(x.dates)) {
            const n = url.replace(/\/$/, "");
            merged[url] = date;
            merged[n] = date;
          }
          setDates((p) => ({ ...p, ...merged }));
        }
      }
      )
      .catch(() => {
        if (!cancelled) lastFetchedKey.current = "";
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, urlKey]);

  return { titles, images, dates };
}
