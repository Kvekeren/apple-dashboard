"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { nl } from "date-fns/locale";
import { RefreshCw, Bell, BellOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  APPLE_TITLE_TABS,
  badgeClassForLabel,
  listTitleLabelsInOrder,
  type SiteTitleId,
} from "@/lib/site-titles";

export interface NewsArticle {
  source: string;
  title: string;
  url: string;
  publicationDate: string;
  imageUrl?: string;
  faviconUrl?: string;
}

const SOURCE_LABELS = listTitleLabelsInOrder();
const POLL_MS = 5 * 60 * 1000;

function primaryDomain(label: string): string | undefined {
  const row = APPLE_TITLE_TABS.find((t) => t.label === label);
  if (!row || row.id === "all") return undefined;
  const map: Record<SiteTitleId, string> = {
    icreate: "icreatemagazine.nl",
    iphoned: "iphoned.nl",
    iculture: "iculture.nl",
  };
  return map[row.id];
}

function favIconUrl(source: string, fallback?: string): string {
  if (fallback) return fallback;
  const d = primaryDomain(source);
  if (!d) return "";
  return `https://www.google.com/s2/favicons?domain=${d}&sz=32`;
}

function dayKey(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(startOfDay(d), "yyyy-MM-dd");
  } catch {
    return dateStr;
  }
}

function dayGroupLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (isToday(d)) return "Vandaag";
    if (isYesterday(d)) return "Gisteren";
    return format(d, "d MMMM yyyy", { locale: nl });
  } catch {
    return dateStr;
  }
}

function formatArticleTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, "HH:mm", { locale: nl });
  } catch {
    return dateStr;
  }
}

type DayArticleGroup = {
  dayKey: string;
  label: string;
  isToday: boolean;
  articles: NewsArticle[];
};

function groupArticlesByDay(articles: NewsArticle[]): DayArticleGroup[] {
  const byDay = new Map<string, NewsArticle[]>();
  const labels = new Map<string, string>();
  const isTodayByDay = new Map<string, boolean>();
  const order: string[] = [];

  for (const article of articles) {
    const key = dayKey(article.publicationDate);
    if (!byDay.has(key)) {
      byDay.set(key, []);
      labels.set(key, dayGroupLabel(article.publicationDate));
      isTodayByDay.set(key, isToday(new Date(article.publicationDate)));
      order.push(key);
    }
    byDay.get(key)!.push(article);
  }

  return order.map((key) => ({
    dayKey: key,
    label: labels.get(key)!,
    isToday: isTodayByDay.get(key)!,
    articles: byDay.get(key)!,
  }));
}

function isFresh24h(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    return Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Tab-inhoud: nieuwste berichten uit nieuws-sitemaps, per merk in drie kolommen. */
export function NewsSitemapsPanel() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNp] = useState<NotificationPermission | null>(null);

  const known = useRef<Set<string>>(new Set());
  const first = useRef(true);

  const bySource = useMemo(() => {
    const out: Record<string, NewsArticle[]> = {};
    for (const src of SOURCE_LABELS) {
      out[src] = articles
        .filter((a) => a.source === src)
        .sort((a, b) => +new Date(b.publicationDate) - +new Date(a.publicationDate));
    }
    return out;
  }, [articles]);

  async function fetchNews(): Promise<NewsArticle[]> {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 25000);
      const res = await fetch("/api/fetch-news", { signal: ac.signal });
      clearTimeout(t);
      if (!res.ok) throw 0;
      const d = await res.json();
      setArticles(d);
      return d;
    } catch {
      setArticles([]);
      return [];
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function notifyShow(newArts: NewsArticle[]) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const c = newArts.length;
    new Notification(c === 1 ? "Nieuw artikel" : `${c} nieuwe artikelen`, {
      body:
        c === 1
          ? `${newArts[0].source}: ${newArts[0].title}`
          : newArts.slice(0, 3).map((a) => `• ${a.source}: ${a.title}`).join("\n"),
      icon: "/favicon.ico",
      tag: "seo-news-new",
    });
  }

  useEffect(() => {
    void fetchNews();
  }, []);

  useEffect(() => {
    if ("Notification" in window) {
      setNp(Notification.permission);
      if (Notification.permission === "granted") setNotificationsEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (!notificationsEnabled) return;
    const iv = setInterval(async () => {
      const d = (await fetch("/api/fetch-news").then((r) => (r.ok ? r.json() : []))) as NewsArticle[];
      if (!d.length) return;
      const nu = new Set(d.map((a) => a.url));
      const nw = d.filter((a) => !known.current.has(a.url));
      if (nw.length && !first.current) notifyShow(nw);
      known.current = nu;
      setArticles(d);
    }, POLL_MS);
    return () => clearInterval(iv);
  }, [notificationsEnabled]);

  useEffect(() => {
    if (articles.length && first.current) {
      known.current = new Set(articles.map((a) => a.url));
      first.current = false;
    }
  }, [articles]);

  function onRefreshNews() {
    setRefreshing(true);
    void fetchNews().then((d) => {
      if (d.length) known.current = new Set(d.map((a: NewsArticle) => a.url));
    });
  }

  return (
    <section>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="fnl-section-title">Recent</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nieuwste berichten uit nieuws-sitemaps
            {notificationsEnabled && (
              <span className="ml-2 text-[var(--fnl-success)]">· poll elke 5 min</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!notificationsEnabled ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-[4px]"
              disabled={notificationPermission === "denied"}
              onClick={async () => {
                if (!("Notification" in window)) return;
                if (Notification.permission === "granted") {
                  setNotificationsEnabled(true);
                  return;
                }
                if (Notification.permission === "denied") return;
                const p = await Notification.requestPermission();
                setNp(p);
                if (p === "granted") setNotificationsEnabled(true);
              }}
            >
              <Bell className="size-4" /> Notificaties
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="rounded-[4px] border-[var(--fnl-success)]/30 bg-[#eaf5ef] text-[#1a5239] hover:bg-[#dff3ea]"
              onClick={() => setNotificationsEnabled(false)}
            >
              <BellOff className="size-4" /> Notificaties
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-[4px]"
            disabled={refreshing}
            onClick={onRefreshNews}
            aria-label="Verversen"
          >
            {refreshing ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/40 border-t-primary" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Laden…
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {SOURCE_LABELS.map((src) => {
            const rows = bySource[src] ?? [];
            const fav = favIconUrl(src, rows[0]?.faviconUrl);
            return (
              <div key={src} className="fnl-card-hover flex flex-col p-4">
                <div className="flex flex-col items-center border-b border-border pb-2.5">
                  {fav ? (
                    <img alt="" src={fav} className="mb-1.5 size-8 rounded-[8px]" />
                  ) : null}
                  <Badge variant="outline" className={badgeClassForLabel(src)}>
                    {src}
                  </Badge>
                </div>
                {!rows.length ? (
                  <p className="mt-3 flex-1 text-center text-sm text-muted-foreground">
                    Geen artikelen
                  </p>
                ) : (
                  <div className="mt-3 flex flex-1 flex-col">
                    {groupArticlesByDay(rows).map((group, groupIndex) => (
                      <div
                        key={`${src}-${group.dayKey}`}
                        className={groupIndex > 0 ? "mt-5 border-t border-border pt-4" : ""}
                      >
                        <h3 className="mb-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
                          {group.label}
                        </h3>
                        <div className="flex flex-col gap-2">
                          {group.articles.map((a, i) => (
                            <div
                              key={`${src}-${a.url}-${i}`}
                              className="flex gap-2.5 border-b border-border pb-2.5 last:border-b-0 last:pb-0"
                            >
                              <div className="w-[100px] shrink-0 sm:w-[112px]">
                                {a.imageUrl ? (
                                  <a
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block"
                                  >
                                    <img
                                      alt=""
                                      src={a.imageUrl}
                                      className="aspect-video w-full rounded-[3px] border border-border object-cover"
                                    />
                                  </a>
                                ) : (
                                  <div
                                    className="aspect-video w-full rounded-[3px] border border-dashed border-border bg-muted/50"
                                    aria-hidden
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 leading-snug">
                                <a
                                  href={a.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs leading-snug text-foreground underline-offset-2 hover:text-primary hover:underline"
                                >
                                  {a.title}
                                </a>
                                {group.isToday ? (
                                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    {isFresh24h(a.publicationDate) ? (
                                      <span
                                        className="inline-block size-1.5 shrink-0 rounded-full bg-[var(--fnl-success)]"
                                        title="Laatste 24 uur"
                                      />
                                    ) : null}
                                    <time dateTime={a.publicationDate}>
                                      {formatArticleTime(a.publicationDate)}
                                    </time>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
