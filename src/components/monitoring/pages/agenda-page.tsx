"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    AgendaData?: AgendaDataApi;
    AgendaChrome?: { mount: (opts: AgendaMountOpts) => AgendaChromeApi; current?: AgendaChromeApi };
  }
}

type AgendaDataApi = {
  TITLES: { id: string; label: string }[];
  TODAY: Date;
  toIso: (d: Date) => string;
  parseIso: (iso: string) => Date;
  articlesOn: (iso: string, titleId: string, visible: AgendaArticle[]) => AgendaArticle[];
  renderStack: (
    arts: AgendaArticle[],
    opts: { key: string; max: number; expanded: Set<string>; variant: string }
  ) => string;
  titleHead: (t: { id: string; label: string }) => string;
  formatDayLong: (d: Date) => string;
  formatDayShort: (d: Date) => string;
  bindMore: (board: Element, expanded: Set<string>) => void;
  hydrateOgImages: (urls: string[], cb: (map: Record<string, string>) => void) => Promise<void>;
  applyImageMap: (root: Element | null, map: Record<string, string>) => void;
  applyMetrics: (byUrl: Record<string, unknown>, connected: boolean) => void;
  ingestLive: (articles: AgendaArticle[]) => void;
};

type AgendaArticle = {
  id: string;
  titleId: string;
  date: string;
};

type AgendaMountOpts = {
  root?: HTMLElement;
  render: (board: Element, ctx: AgendaRenderCtx) => void;
  afterRender?: (board: Element) => void;
};

type AgendaRenderCtx = {
  view: string;
  days: Date[];
  cursorMonth: number;
  visible: AgendaArticle[];
  titles?: string[];
};

type AgendaChromeApi = {
  render: () => void;
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

function ensureStylesheet(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function AgendaPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const mountRoot = rootRef.current;
    if (!mountRoot) return;
    const agendaRoot: HTMLElement = mountRoot;

    let cancelled = false;

    async function boot() {
      ensureStylesheet("/agenda-concepten/tokens.css");
      await loadScript("/agenda-concepten/data.js");
      await loadScript("/agenda-concepten/chrome.js");

      if (cancelled) return;

      const D = window.AgendaData;
      const chrome = window.AgendaChrome;
      if (!D || !chrome) {
        setStatus("error");
        return;
      }
      const agendaData: AgendaDataApi = D;
      const agendaChrome: { mount: (opts: AgendaMountOpts) => AgendaChromeApi } = chrome;

      const expanded = new Set<string>();

      function mount() {
        agendaChrome.mount({
          root: agendaRoot,
          render(board, ctx) {
            const dayList =
              ctx.view === "month"
                ? ctx.days.filter((d) => d.getMonth() === ctx.cursorMonth)
                : ctx.days.filter((d) => (d.getDay() + 6) % 7 < 5);
            const visibleForHeads =
              ctx.view === "month"
                ? ctx.visible.filter((a) => agendaData.parseIso(a.date).getMonth() === ctx.cursorMonth)
                : ctx.visible;
            const titleCols = agendaData.TITLES.filter((t) => !ctx.titles?.length || ctx.titles.includes(t.id));
            const max = ctx.view === "month" ? 3 : 6;
            const variant = ctx.view === "month" ? "lane-chip" : "lane";
            const counts = Object.fromEntries(
              titleCols.map((t) => [t.id, visibleForHeads.filter((a) => a.titleId === t.id).length])
            );
            let html = `<div class="lanes ${ctx.view}" style="grid-template-columns: 92px repeat(${titleCols.length}, minmax(0, 1fr))">
            <div class="lane-corner"></div>
            ${titleCols.map((t) => `<div class="col-head">${agendaData.titleHead(t)}<span class="n">${counts[t.id]}</span></div>`).join("")}
          `;
            for (const day of dayList) {
              const iso = agendaData.toIso(day);
              const today = iso === agendaData.toIso(agendaData.TODAY);
              const dayLabel = agendaData.formatDayLong(day);
              html += `<button type="button" class="day-lab${today ? " today" : ""}" data-add-date="${iso}" aria-label="Nieuwe kaart op ${dayLabel}"><span class="num">${day.getDate()}</span>${agendaData.formatDayShort(day)}${today ? '<span class="today-chip">Vandaag</span>' : ""}</button>`;
              for (const t of titleCols) {
                const arts = agendaData.articlesOn(iso, t.id, ctx.visible);
                const addLabel = ctx.view === "month" ? "+" : arts.length ? "+ Kaart" : "+ Nieuwe kaart";
                html += `<div class="cell${arts.length ? "" : " empty"}${today ? " today" : ""}">${agendaData.renderStack(arts, { key: iso + ":" + t.id, max, expanded, variant })}<button type="button" class="add-card-btn" data-add-date="${iso}" data-add-title="${t.id}" aria-label="Nieuwe kaart op ${dayLabel} voor ${t.label}">${addLabel}</button></div>`;
              }
            }
            html += `</div>`;
            board.innerHTML = html;
            agendaData.bindMore(board, expanded);
          },
          afterRender(board) {
            const urls = [...board.querySelectorAll("[data-og-url]")]
              .map((el) => el.getAttribute("data-og-url"))
              .filter((url): url is string => Boolean(url));
            void agendaData.hydrateOgImages(urls, (map) => {
              agendaData.applyImageMap(board, map);
              agendaData.applyImageMap(document.querySelector("[data-panel]"), map);
            });
          },
        });
      }

      async function loadMetrics() {
        try {
          const res = await fetch("/api/agenda-metrics?days=28", { credentials: "include" });
          const json = res.ok ? await res.json() : { connected: false, byUrl: {} };
          agendaData.applyMetrics(json.byUrl || {}, json.connected);
        } catch {
          agendaData.applyMetrics({}, false);
        }
        window.AgendaChrome?.current?.render();
      }

      try {
        const res = await fetch("/api/agenda-feed");
        const data = res.ok ? await res.json() : { articles: [] };
        agendaData.ingestLive(data.articles || []);
      } catch {
        agendaData.ingestLive([]);
      }

      if (cancelled) return;

      mount();
      setStatus("ready");
      void loadMetrics();
    }

    void boot().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
      mountRoot.innerHTML = "";
    };
  }, []);

  return (
    <div className="agenda-page -mx-4 sm:-mx-6">
      <style>{`
        .agenda-page .page {
          min-height: auto;
          max-width: none;
          width: 100%;
        }
        .agenda-page .lanes {
          display: grid;
          grid-template-columns: 92px repeat(3, minmax(0, 1fr));
          gap: 8px 10px;
          align-items: stretch;
          background: var(--paper-1);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
        }
        .agenda-page .lane-corner,
        .agenda-page .col-head {
          position: sticky;
          top: 0;
          z-index: 3;
          align-self: start;
        }
        .agenda-page .lane-corner { background: var(--paper-1); }
        .agenda-page .col-head {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 650;
          color: var(--blue);
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 8px 12px -8px rgba(0, 30, 59, 0.18);
        }
        .agenda-page .col-head .title-logo { width: 20px; height: 20px; }
        .agenda-page .col-head .n {
          margin-left: auto;
          font-weight: 500;
          color: var(--ink-3);
          font-variant-numeric: tabular-nums;
        }
        .agenda-page .day-lab {
          display: block;
          width: 100%;
          appearance: none;
          background: #fff;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          padding: 8px;
          font: inherit;
          font-size: 11px;
          font-weight: 650;
          color: var(--ink-2);
          text-align: left;
          cursor: pointer;
        }
        .agenda-page .day-lab:hover {
          border-color: var(--blue);
          background: var(--blue-pale);
        }
        .agenda-page .day-lab .num {
          display: block;
          font-size: 18px;
          color: var(--blue);
          letter-spacing: -0.03em;
        }
        .agenda-page .day-lab.today {
          border-color: var(--blue);
          box-shadow: 0 0 0 1px var(--blue);
        }
        .agenda-page .day-lab.today:hover {
          background: color-mix(in srgb, var(--blue-pale) 70%, #fff);
        }
        .agenda-page .today-chip {
          display: inline-block;
          margin-top: 5px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #fff;
          background: var(--blue);
          padding: 2px 6px;
          border-radius: 999px;
        }
        .agenda-page .cell {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-height: 48px;
        }
        .agenda-page .cell.empty { background: var(--paper-1); }
        .agenda-page .cell.today {
          border-color: color-mix(in srgb, var(--blue) 45%, var(--border));
        }
        .agenda-page .lanes.month .cell { min-height: 52px; gap: 6px; }
        .agenda-page .add-card-btn {
          width: 100%;
          margin-top: auto;
          appearance: none;
          border: 1px dashed var(--border);
          background: transparent;
          color: var(--ink-3);
          font-size: 11px;
          font-weight: 650;
          padding: 6px 4px;
          border-radius: var(--r-sm);
        }
        .agenda-page .add-card-btn:hover {
          color: var(--blue);
          border-color: var(--blue);
          background: var(--blue-pale);
        }
        .agenda-page .cell.empty .add-card-btn { flex: 1; min-height: 36px; }
        .agenda-page .cell:not(.empty) .add-card-btn { opacity: 0; }
        .agenda-page .cell:not(.empty):hover .add-card-btn,
        .agenda-page .cell:not(.empty):focus-within .add-card-btn { opacity: 1; }
        .agenda-page .lanes.month .add-card-btn { font-size: 12px; padding: 4px; }
      `}</style>

      {status === "loading" && (
        <p className="py-12 text-center text-sm text-muted-foreground">Artikelen laden…</p>
      )}
      {status === "error" && (
        <p className="py-12 text-center text-sm text-destructive">Agenda kon niet geladen worden.</p>
      )}
      <div ref={rootRef} className={status === "ready" ? "" : "hidden"} aria-hidden={status !== "ready"} />
    </div>
  );
}
