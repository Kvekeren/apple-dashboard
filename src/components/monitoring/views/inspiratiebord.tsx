"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronDown, Pin, Search, Star, X } from "lucide-react";

import { useMonitoringAuth } from "@/components/monitoring/monitoring-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type IdeeenApiPayload } from "@/lib/discover-snoop";
import {
  BOARD_INITIAL,
  BOARD_STEP,
  COLUMN_LABELS,
  cardMatchesFilters,
  gscRowsToYoyCards,
  loadLade,
  mergeSnoopArticles,
  saveLade,
  type BoardCard,
  type BoardColumnId,
  type LadeEntry,
} from "@/lib/inspiratiebord";
import {
  normArticleUrl,
  slugFromUrl,
  SOURCE_LABELS,
  TOP_ARTICLES_MAX,
} from "@/lib/monitoring/shared";
import { useFetchPageTitlesAndImages } from "@/lib/monitoring/use-fetch-page-meta";

type YoyPayload = {
  meta: {
    isoWeek: number;
    isoWeekYear: number;
    startDate: string;
    endDate: string;
    currentIsoWeek: number;
  };
  discoverByUrl: Record<string, { clicks: number; impressions: number }>;
};

const EMPTY_SECTIONS: IdeeenApiPayload["sections"] = {
  tel: { nl: { items: [], meta: { total: null } }, worldwide: { items: [], meta: { total: null } } },
  electronics: {
    nl: { items: [], meta: { total: null } },
    worldwide: { items: [], meta: { total: null } },
  },
};

function formatWeekPeriod(startDate: string, endDate: string): string {
  const startFmt = format(parseISO(startDate), "d MMMM", { locale: nl });
  const endFmt = format(parseISO(endDate), "d MMMM yyyy", { locale: nl });
  return `${startFmt} – ${endFmt}`;
}

function InspiratieCard({
  card,
  displayTitle,
  pinned,
  onTogglePin,
}: {
  card: BoardCard;
  /** Live titel (og:title); overschrijft card.title zodra meta binnen is. */
  displayTitle?: string;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const title = displayTitle?.trim() || card.title;
  const publisherLabel = card.publisher?.trim() || card.ownLabel || "";
  const showCardDate = Boolean(card.dateLabel);

  return (
    <article
      className={`flex shrink-0 overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(60,64,67,0.08),0_1px_3px_rgba(60,64,67,0.04)] transition-shadow hover:shadow-[0_2px_6px_rgba(60,64,67,0.12),0_6px_14px_rgba(60,64,67,0.06)] ${
        card.ownLabel ? "border-primary/20" : "border-border"
      }`}
    >
      {card.image ? (
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-[156px] shrink-0 sm:w-[168px]"
        >
          <img
            src={card.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="aspect-video w-full object-cover bg-muted"
          />
        </a>
      ) : (
        <div
          className="aspect-video w-[156px] shrink-0 bg-gradient-to-br from-[var(--fnl-blue-soft)] to-[#b8cfe0] sm:w-[168px]"
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1 px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {card.favicon ? (
              <img
                alt=""
                src={card.favicon}
                className="size-4 shrink-0 rounded-sm bg-background object-contain"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : publisherLabel ? (
              <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[8px] font-semibold text-muted-foreground">
                {publisherLabel.charAt(0)}
              </span>
            ) : null}
            <span className="truncate text-[11px] font-medium text-muted-foreground">
              {publisherLabel}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onTogglePin}
              aria-label={pinned ? "Losmaken uit ideeënlade" : "Pinnen in ideeënlade"}
              aria-pressed={pinned}
              className={`rounded-[4px] p-1 transition-colors ${
                pinned
                  ? "text-primary hover:bg-primary/10"
                  : "text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
              }`}
            >
              <Pin className={`size-3.5 ${pinned ? "fill-current" : ""}`} strokeWidth={2} />
            </button>
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-muted-foreground">
              #<span className="font-bold text-foreground">{String(card.rank).padStart(2, "0")}</span>
            </span>
          </div>
        </div>

        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-4 text-xs font-medium leading-snug text-foreground hover:text-primary hover:underline"
        >
          {title}
        </a>

        <div className="mt-auto flex flex-wrap items-center gap-1">
          {showCardDate ? (
            <span className="text-[10px] text-muted-foreground">{card.dateLabel}</span>
          ) : null}
          {card.metricLabel ? (
            <span
              className={`text-[10px] tabular-nums text-muted-foreground ${showCardDate ? "ml-auto" : ""}`}
            >
              {card.metricLabel}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function BoardColumn({
  columnId,
  title,
  description,
  countLabel,
  tabs,
  activeTab,
  onTabChange,
  cards,
  visible,
  onLoadMore,
  loading,
  error,
  authGate,
  pinnedKeys,
  onTogglePin,
  resolveTitle,
}: {
  columnId: BoardColumnId;
  title: string;
  description: string;
  countLabel: string;
  tabs?: { value: string; label: string }[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  cards: BoardCard[];
  visible: number;
  onLoadMore: () => void;
  loading?: boolean;
  error?: string | null;
  authGate?: boolean;
  pinnedKeys: Set<string>;
  onTogglePin: (card: BoardCard) => void;
  resolveTitle?: (url: string) => string;
}) {
  const shown = cards.slice(0, visible);
  const hasMore = cards.length > visible;

  return (
    <section
      className="flex max-h-[calc(100dvh-12rem)] min-w-0 flex-col"
      aria-label={title}
    >
      <header className="rounded-t-[8px] border border-b-0 border-border bg-card px-3 py-2.5">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="text-[13px] font-semibold leading-snug text-primary">{title}</h2>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {countLabel}
          </span>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
        {tabs && tabs.length > 1 && onTabChange ? (
          <div className="fnl-segment mt-2 w-full" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={activeTab === t.value}
                data-active={activeTab === t.value ? "true" : "false"}
                className="fnl-segment-item min-w-0 flex-1 px-2 py-1 text-[10px]"
                onClick={() => onTabChange(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}
      </header>
      <div className="flex min-h-[280px] flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden rounded-b-[8px] border border-border bg-[var(--fnl-blue-pale)] p-2">
        {authGate ? (
          <div className="flex flex-1 flex-col items-center justify-center px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              Log in via Google Search Console om deze kolom te vullen.
            </p>
          </div>
        ) : loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Laden…</p>
        ) : error ? (
          <p className="px-2 py-4 text-center text-xs text-[var(--fnl-danger)]">{error}</p>
        ) : !shown.length ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Geen artikelen</p>
        ) : (
          <>
            {shown.map((card) => (
              <InspiratieCard
                key={card.id}
                card={card}
                displayTitle={resolveTitle?.(card.url)}
                pinned={pinnedKeys.has(`${columnId}:${card.id}`)}
                onTogglePin={() => onTogglePin(card)}
              />
            ))}
            {hasMore ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full rounded-[4px] text-primary hover:bg-white/80"
                onClick={onLoadMore}
              >
                <ChevronDown className="size-4" />
                Meer laden
              </Button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function LadeColumn({
  entries,
  images,
  onRemove,
}: {
  entries: LadeEntry[];
  images: Record<string, string>;
  onRemove: (pinKey: string) => void;
}) {
  return (
    <section
      className="flex min-w-0 flex-col rounded-[8px] border-2 border-primary bg-gradient-to-b from-card to-[var(--fnl-blue-pale)] shadow-[var(--shadow-fnl-card)]"
      aria-label="Ideeënlade"
    >
      <header className="border-b border-border px-3 py-2.5">
        <div className="mb-1 flex items-center gap-2">
          <Star className="size-4 fill-primary text-primary" />
          <h2 className="text-[13px] font-semibold text-primary">Ideeënlade</h2>
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {entries.length === 1 ? "1 idee" : `${entries.length} ideeën`}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Vastgepind voor de redactie — blijft bewaard in deze browser.
        </p>
      </header>
      <div className="flex min-h-[240px] flex-1 flex-col gap-2 overflow-y-auto p-2">
        {!entries.length ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center text-xs text-muted-foreground">
            <Pin className="mb-2 size-8 opacity-40" />
            <p>Nog geen ideeën vastgepind. Klik <strong>Pin</strong> op een artikel.</p>
          </div>
        ) : (
          entries.map((e) => {
            const img =
              e.image ??
              images[e.url.replace(/\/$/, "")] ??
              images[e.url];
            const pub = e.publisher?.trim() || e.ownLabel || "";
            return (
              <article
                key={e.pinKey}
                className="flex shrink-0 overflow-hidden rounded-xl border border-border bg-card"
              >
                {img ? (
                  <img
                    src={img}
                    alt=""
                    className="aspect-video w-[148px] shrink-0 object-cover bg-muted sm:w-[160px]"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="aspect-video w-[148px] shrink-0 bg-gradient-to-br from-[var(--fnl-blue-soft)] to-[#b8cfe0] sm:w-[160px]"
                    aria-hidden
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1 px-2.5 py-2">
                  <Badge variant="outline" className="h-5 w-fit px-1.5 text-[10px]">
                    {e.columnLabel}
                  </Badge>
                  <div className="flex min-w-0 items-center gap-1.5">
                    {e.favicon ? (
                      <img
                        alt=""
                        src={e.favicon}
                        className="size-4 shrink-0 rounded-sm bg-background object-contain"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : pub ? (
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[8px] font-semibold text-muted-foreground">
                        {pub.charAt(0)}
                      </span>
                    ) : null}
                    {pub ? (
                      <span className="truncate text-[11px] font-medium text-muted-foreground">
                        {pub}
                      </span>
                    ) : null}
                  </div>
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-3 text-xs font-medium leading-snug text-foreground hover:text-primary hover:underline"
                  >
                    {e.title}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-auto h-6 w-full rounded-[4px] text-[10px] text-muted-foreground"
                    onClick={() => onRemove(e.pinKey)}
                  >
                    <X className="mr-1 size-3" />
                    Verwijder
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export function Inspiratiebord({
  onRegisterRefresh,
}: {
  onRegisterRefresh?: (handler: (() => void | Promise<void>) | null) => void;
}) {
  const { gscConnected } = useMonitoringAuth();

  const [snoop, setSnoop] = useState<IdeeenApiPayload | null>(null);
  const [snoopErr, setSnoopErr] = useState<string | null>(null);
  const [snoopLoading, setSnoopLoading] = useState(true);

  const [yoy, setYoy] = useState<YoyPayload | null>(null);
  const [yoyErr, setYoyErr] = useState<string | null>(null);
  const [yoyLoading, setYoyLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [tabYoy, setTabYoy] = useState("all");

  const [visible, setVisible] = useState<Record<BoardColumnId, number>>({
    "week-nl": BOARD_INITIAL,
    "week-ww": BOARD_INITIAL,
    yoy: BOARD_INITIAL,
  });

  const [lade, setLade] = useState<LadeEntry[]>([]);

  useEffect(() => {
    setLade(loadLade());
  }, []);

  const loadSnoop = useCallback(async (refresh = false) => {
    setSnoopLoading(true);
    setSnoopErr(null);
    try {
      const u = refresh ? "/api/discover-snoop?refresh=1" : "/api/discover-snoop";
      const res = await fetch(u);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSnoop(null);
        setSnoopErr(body.error ?? "Discover-week laden mislukt");
        return;
      }
      setSnoop((await res.json()) as IdeeenApiPayload);
    } catch {
      setSnoop(null);
      setSnoopErr("Discover-week laden mislukt");
    } finally {
      setSnoopLoading(false);
    }
  }, []);

  const loadYoy = useCallback(async (refresh = false) => {
    setYoyLoading(true);
    setYoyErr(null);
    try {
      const u = refresh ? "/api/discover-yoy-week?refresh=1" : "/api/discover-yoy-week";
      const res = await fetch(u, { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setYoy(null);
        setYoyErr(body.error ?? "YoY-week laden mislukt");
        return;
      }
      setYoy((await res.json()) as YoyPayload);
    } catch {
      setYoy(null);
      setYoyErr("YoY-week laden mislukt");
    } finally {
      setYoyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnoop();
  }, [loadSnoop]);

  useEffect(() => {
    if (!gscConnected) return;
    void loadYoy();
  }, [gscConnected, loadYoy]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadSnoop(true), gscConnected ? loadYoy(true) : Promise.resolve()]);
  }, [loadSnoop, loadYoy, gscConnected]);

  useEffect(() => {
    onRegisterRefresh?.(refreshAll);
    return () => onRegisterRefresh?.(null);
  }, [refreshAll, onRegisterRefresh]);

  const sections = snoop?.sections ?? EMPTY_SECTIONS;

  const rawColumns = useMemo(() => {
    const weekNl = mergeSnoopArticles(sections, "nl", "week-nl");
    const weekWw = mergeSnoopArticles(sections, "worldwide", "week-ww");
    return { "week-nl": weekNl, "week-ww": weekWw, yoy: [] as BoardCard[] };
  }, [sections]);

  const yoyUrls = useMemo(() => {
    if (!yoy?.discoverByUrl) return [];
    return Object.entries(yoy.discoverByUrl)
      .filter(([, v]) => v.clicks > 0)
      .sort((a, b) => b[1].clicks - a[1].clicks)
      .slice(0, TOP_ARTICLES_MAX)
      .map(([url]) => url);
  }, [yoy]);

  const metaUrls = useMemo(
    () => [...new Set([...yoyUrls, ...lade.map((e) => e.url)])],
    [yoyUrls, lade]
  );

  const { titles: metaTitles, images: metaImages, dates: metaDates } =
    useFetchPageTitlesAndImages(metaUrls, gscConnected);

  const resolveTitle = useCallback(
    (url: string) => {
      const n = normArticleUrl(url);
      const fromMeta = metaTitles[n] ?? metaTitles[url];
      if (fromMeta?.trim()) return fromMeta.trim();
      return slugFromUrl(url);
    },
    [metaTitles]
  );

  const resolveDateLabel = useCallback(
    (url: string) => {
      const n = normArticleUrl(url);
      return metaDates[n] ?? metaDates[url] ?? "";
    },
    [metaDates]
  );

  const columnsWithGsc = useMemo(() => {
    const enrichCard = (cards: BoardCard[]) =>
      cards.map((c) => {
        const n = normArticleUrl(c.url);
        return {
          ...c,
          image: c.image ?? metaImages[n] ?? metaImages[c.url],
          dateLabel:
            c.dateLabel ||
            (c.columnId === "yoy" ? resolveDateLabel(c.url) : "") ||
            undefined,
        };
      });

    const yoyCards = yoy ? gscRowsToYoyCards(yoy.discoverByUrl, resolveTitle) : [];
    return {
      "week-nl": enrichCard(rawColumns["week-nl"]),
      "week-ww": enrichCard(rawColumns["week-ww"]),
      yoy: enrichCard(yoyCards),
    };
  }, [rawColumns, yoy, resolveTitle, resolveDateLabel, metaImages]);

  const filtered = useMemo(() => {
    const out = {} as Record<BoardColumnId, BoardCard[]>;
    for (const colId of ["week-nl", "week-ww", "yoy"] as BoardColumnId[]) {
      out[colId] = columnsWithGsc[colId].filter((card) =>
        cardMatchesFilters(card, {
          query,
          columnId: colId,
          tabFilter: colId === "yoy" ? tabYoy : undefined,
        })
      );
    }
    return out;
  }, [columnsWithGsc, query, tabYoy]);

  const pinnedKeys = useMemo(() => new Set(lade.map((e) => e.pinKey)), [lade]);

  const pinTitleForCard = useCallback(
    (card: BoardCard) =>
      card.columnId === "yoy" ? resolveTitle(card.url) : card.title,
    [resolveTitle]
  );

  const togglePin = useCallback(
    (card: BoardCard) => {
      const pinKey = `${card.columnId}:${card.id}`;
      setLade((prev) => {
        const exists = prev.some((e) => e.pinKey === pinKey);
        const next = exists
          ? prev.filter((e) => e.pinKey !== pinKey)
          : [
              ...prev,
              {
                pinKey,
                cardId: card.id,
                columnId: card.columnId,
                columnLabel: COLUMN_LABELS[card.columnId],
                title: pinTitleForCard(card),
                url: card.url,
                publisher: card.publisher,
                favicon: card.favicon,
                image: card.image,
                ownLabel: card.ownLabel,
              },
            ];
        saveLade(next);
        return next;
      });
    },
    [pinTitleForCard]
  );

  const removeFromLade = useCallback((pinKey: string) => {
    setLade((prev) => {
      const next = prev.filter((e) => e.pinKey !== pinKey);
      saveLade(next);
      return next;
    });
  }, []);

  const loadMore = (col: BoardColumnId) => {
    setVisible((v) => ({
      ...v,
      [col]: v[col] + BOARD_STEP,
    }));
  };

  const yoyPeriod =
    yoy?.meta != null
      ? formatWeekPeriod(yoy.meta.startDate, yoy.meta.endDate)
      : null;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Inspiratiebord
            {snoop?.week != null ? (
              <span className="ml-2 text-base font-normal text-muted-foreground sm:text-lg">
                Week {snoop.week}
              </span>
            ) : null}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Discover-markt deze week (NL en wereld) en eigen Discover in dezelfde week vorig jaar —
            als kolommen om ideeën te vergelijken en vast te pinnen.
          </p>
        </div>
        {yoy?.meta ? (
          <p className="shrink-0 text-xs text-muted-foreground sm:text-right">
            YoY: week {yoy.meta.isoWeek} · {yoy.meta.isoWeekYear}
            <br />
            {yoyPeriod}
          </p>
        ) : null}
      </div>

      {snoopErr ? (
        <div
          role="alert"
          className="mb-3 rounded-[8px] border border-[var(--fnl-warning)]/35 bg-[#fdf8ed] px-4 py-3 text-sm text-[var(--fnl-ink-2)]"
        >
          {snoopErr}
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-[8px] border border-border bg-card px-3 py-1.5 sm:max-w-xs">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek titel of onderwerp…"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 flex-1 pb-4">
        <div className="grid w-full grid-cols-1 gap-3 px-4 sm:px-6 md:grid-cols-2 xl:grid-cols-4 lg:px-8">
          <BoardColumn
            columnId="week-nl"
            title="Deze week · Nederland"
            description="DiscoverSnoop · Telecom & Tech"
            countLabel={
              snoopLoading
                ? "…"
                : `${filtered["week-nl"].length}${filtered["week-nl"].length !== columnsWithGsc["week-nl"].length ? ` / ${columnsWithGsc["week-nl"].length}` : ""}`
            }
            cards={filtered["week-nl"]}
            visible={visible["week-nl"]}
            onLoadMore={() => loadMore("week-nl")}
            loading={snoopLoading}
            pinnedKeys={pinnedKeys}
            onTogglePin={togglePin}
          />
          <BoardColumn
            columnId="week-ww"
            title="Deze week · Wereldwijd"
            description="DiscoverSnoop worldwide"
            countLabel={
              snoopLoading
                ? "…"
                : `${filtered["week-ww"].length}${filtered["week-ww"].length !== columnsWithGsc["week-ww"].length ? ` / ${columnsWithGsc["week-ww"].length}` : ""}`
            }
            cards={filtered["week-ww"]}
            visible={visible["week-ww"]}
            onLoadMore={() => loadMore("week-ww")}
            loading={snoopLoading}
            pinnedKeys={pinnedKeys}
            onTogglePin={togglePin}
          />
          <BoardColumn
            columnId="yoy"
            title="Zelfde week vorig jaar"
            description={
              yoy?.meta
                ? `GSC Discover · week ${yoy.meta.currentIsoWeek} ↔ ${yoy.meta.isoWeek}/${yoy.meta.isoWeekYear}`
                : "GSC Discover · eigen + markt"
            }
            countLabel={yoyLoading ? "…" : String(filtered.yoy.length)}
            tabs={[
              { value: "all", label: "Alle" },
              ...SOURCE_LABELS.map((l) => ({ value: l, label: l })),
            ]}
            activeTab={tabYoy}
            onTabChange={setTabYoy}
            cards={filtered.yoy}
            visible={visible.yoy}
            onLoadMore={() => loadMore("yoy")}
            loading={yoyLoading}
            error={!gscConnected ? null : yoyErr}
            authGate={!gscConnected}
            pinnedKeys={pinnedKeys}
            onTogglePin={togglePin}
            resolveTitle={resolveTitle}
          />
          <LadeColumn entries={lade} images={metaImages} onRemove={removeFromLade} />
        </div>
      </div>

    </div>
  );
}
