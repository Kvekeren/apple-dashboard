/* Agenda-chrome: topbar, paneel, nieuwe-kaart-modal, week/maand/lijst-state. */
(function (global) {
  const D = () => global.AgendaData;
  const VALID_SORT = new Set(["pageviews", "discoverClicks", "organicClicks", "date"]);
  const PV_MINS = [
    { value: 0, label: "Alle" },
    { value: 1000, label: "1k+" },
    { value: 5000, label: "5k+" },
    { value: 10000, label: "10k+" },
    { value: 25000, label: "25k+" },
  ];
  const PV_MIN_VALUES = new Set(PV_MINS.map((p) => p.value));

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function parseView(raw) {
    if (raw === "month" || raw === "list") return raw;
    return "week";
  }

  function parseTitles(raw, allIds) {
    if (raw == null || raw === "") return [...allIds];
    const wanted = raw.split(",").map((s) => s.trim()).filter((id) => allIds.includes(id));
    return wanted.length ? wanted : [...allIds];
  }

  function parseMinPageviews(raw) {
    const n = Number(raw);
    return PV_MIN_VALUES.has(n) ? n : 0;
  }

  function parseSort(raw) {
    return VALID_SORT.has(raw) ? raw : "pageviews";
  }

  function mount(opts) {
    const data = D();
    const allTitleIds = data.TITLES.map((t) => t.id);
    const typeOptions = data.allTypes();
    const params = new URLSearchParams(location.search);
    const typeParam = params.get("type") || "";
    const state = {
      view: parseView(params.get("view")),
      cursor: params.get("week") ? data.parseIso(params.get("week")) : new Date(data.DEFAULT_WEEK_START),
      selectedId: params.get("card") || null,
      q: params.get("q") || "",
      titles: parseTitles(params.get("titles"), allTitleIds),
      type: typeOptions.includes(typeParam) ? typeParam : "",
      minPageviews: parseMinPageviews(params.get("pv")),
      sort: parseSort(params.get("sort")),
    };

    document.body.innerHTML = "";
    document.body.removeAttribute("class");
    document.documentElement.classList.remove("agenda-shell");

    const root = el(`<div class="page"></div>`);
    root.innerHTML = `
      <header class="topbar">
        <div class="topbar-row">
          <div>
            <a class="back" href="/">← Dashboard</a>
            <h1>Agenda</h1>
          </div>
          <div class="toolbar">
            <div class="segment" role="tablist" aria-label="Weergave">
              <button type="button" data-view="week">Week</button>
              <button type="button" data-view="month">Maand</button>
              <button type="button" data-view="list">Lijst</button>
            </div>
            <div class="nav-shift" data-cal-nav>
              <button type="button" class="icon-btn" data-shift="-1" aria-label="Vorige">‹</button>
              <div class="period-label" data-period></div>
              <button type="button" class="icon-btn" data-shift="1" aria-label="Volgende">›</button>
            </div>
            <button type="button" class="btn btn-ghost" data-today data-cal-nav>Vandaag</button>
            <button type="button" class="btn" data-new>+ Nieuwe kaart</button>
          </div>
        </div>
        <div class="filterbar">
          <div class="search-wrap" data-search-wrap>
            <input type="search" class="search-input" data-search placeholder="Zoek artikel…" autocomplete="off" />
            <div class="search-drop" data-search-drop hidden></div>
          </div>
          <div class="title-chips" data-title-chips></div>
          <select class="filter-select" data-type-filter aria-label="Type">
            <option value="">Alle types</option>
            ${typeOptions.map((tp) => `<option value="${data.escapeHtml(tp)}">${data.escapeHtml(tp)}</option>`).join("")}
          </select>
          <div class="segment" role="tablist" aria-label="Pageviews">
            ${PV_MINS.map((p) => `<button type="button" data-pv="${p.value}">${p.label}</button>`).join("")}
          </div>
          <label class="sort-wrap" data-sort-wrap>
            <span>Sorteer</span>
            <select class="filter-select" data-sort>
              <option value="pageviews">Pageviews</option>
              <option value="discoverClicks">Discover</option>
              <option value="organicClicks">Organisch</option>
              <option value="date">Datum</option>
            </select>
          </label>
        </div>
      </header>
      <div class="board-wrap" data-board></div>
      <div class="overlay" data-overlay></div>
      <aside class="panel" data-panel></aside>
      <div class="modal" data-modal></div>
      <div class="toast" data-toast></div>
    `;
    document.body.appendChild(root);

    const board = root.querySelector("[data-board]");
    const periodEl = root.querySelector("[data-period]");
    const overlay = root.querySelector("[data-overlay]");
    const panel = root.querySelector("[data-panel]");
    const modal = root.querySelector("[data-modal]");
    const toastEl = root.querySelector("[data-toast]");
    const searchInput = root.querySelector("[data-search]");
    const searchDrop = root.querySelector("[data-search-drop]");
    const typeSelect = root.querySelector("[data-type-filter]");
    const sortSelect = root.querySelector("[data-sort]");
    const titleChips = root.querySelector("[data-title-chips]");

    searchInput.value = state.q;
    typeSelect.value = state.type;
    sortSelect.value = state.sort;

    let searchHi = 0;

    function syncChrome() {
      root.classList.toggle("is-list", state.view === "list");
      root.querySelectorAll("[data-view]").forEach((b) => {
        b.classList.toggle("on", b.getAttribute("data-view") === state.view);
      });
      root.querySelectorAll("[data-pv]").forEach((b) => {
        b.classList.toggle("on", Number(b.getAttribute("data-pv")) === state.minPageviews);
      });
      titleChips.innerHTML = data.TITLES.map((t) => {
        const on = state.titles.includes(t.id);
        return `<button type="button" class="chip-toggle${on ? " on" : ""}" data-title-chip="${t.id}">${data.titleHead(t)}</button>`;
      }).join("");
    }

    function syncUrl() {
      const p = new URLSearchParams();
      if (state.view !== "week") p.set("view", state.view);
      const start = data.startOfWeek(state.cursor);
      if (
        state.view !== "list" &&
        (data.toIso(start) !== data.toIso(data.DEFAULT_WEEK_START) || state.view === "month")
      ) {
        p.set("week", data.toIso(state.cursor));
      }
      if (state.selectedId) p.set("card", state.selectedId);
      const q = state.q.trim();
      if (q) p.set("q", q);
      if (state.titles.length && state.titles.length < allTitleIds.length) {
        p.set("titles", state.titles.join(","));
      }
      if (state.type) p.set("type", state.type);
      if (state.minPageviews) p.set("pv", String(state.minPageviews));
      if (state.view === "list" && state.sort !== "pageviews") p.set("sort", state.sort);
      const qs = p.toString();
      const next = qs ? `${location.pathname}?${qs}` : location.pathname;
      history.replaceState({}, "", next);
    }

    function filterSpec(extra) {
      return {
        titles: state.titles,
        type: state.type,
        minPageviews: state.minPageviews,
        q: extra && extra.q != null ? extra.q : "",
      };
    }

    function ctx() {
      const view = state.view;
      let days;
      let rangeStart;
      let rangeEnd;
      if (view === "list") {
        const published = data.articles.map((a) => a.date).filter(Boolean).sort();
        rangeStart = published.length ? data.parseIso(published[0]) : data.RANGE_START;
        rangeEnd = published.length ? data.parseIso(published[published.length - 1]) : data.TODAY;
        days = data.daysInRange(rangeStart, rangeEnd);
      } else if (view === "week") {
        const start = data.startOfWeek(state.cursor);
        days = data.daysInRange(start, data.addDays(start, 6));
        rangeStart = days[0];
        rangeEnd = days[6];
      } else if (opts.monthMode === "fourweeks") {
        const start = data.startOfWeek(state.cursor);
        const grid = data.fourWeekGrid(start);
        days = grid.weeks.flat();
        rangeStart = grid.start;
        rangeEnd = grid.end;
      } else {
        const grid = data.monthGrid(state.cursor.getFullYear(), state.cursor.getMonth());
        days = grid.weeks.flat();
        rangeStart = grid.start;
        rangeEnd = grid.end;
      }
      const from = data.toIso(rangeStart);
      const to = data.toIso(rangeEnd);
      const inRange = view === "list" ? data.articles.slice() : data.articlesInRange(from, to);
      const visible = data.filterArticles(inRange, filterSpec({ q: view === "list" ? state.q : "" }));
      const ranked = view === "list" ? data.sortArticlesBy(visible, state.sort) : visible;
      return {
        view,
        days,
        rangeStart,
        rangeEnd,
        from,
        to,
        visible: ranked,
        selectedId: state.selectedId,
        openCard,
        monthWeeks:
          view === "month"
            ? opts.monthMode === "fourweeks"
              ? data.fourWeekGrid(data.startOfWeek(state.cursor)).weeks
              : data.monthGrid(state.cursor.getFullYear(), state.cursor.getMonth()).weeks
            : [days],
        cursorMonth: state.cursor.getMonth(),
        cursorYear: state.cursor.getFullYear(),
        titles: state.titles,
      };
    }

    function renderList(c) {
      if (!c.visible.length) {
        board.innerHTML = `<div class="empty-state">Geen artikelen voor deze filters.</div>`;
        return;
      }
      const head = `
        <div class="rank-head">
          <span>#</span>
          <span></span>
          <span>Artikel</span>
          <span>Titel</span>
          <span>Type</span>
          <span>Datum</span>
          <span>Pageviews</span>
          <span>Discover</span>
          <span>Organisch</span>
        </div>`;
      const rows = c.visible
        .map((a, i) => {
          const src = data.sourceArticle(a);
          const thumb = a.imageUrl || (src && src.imageUrl) || "";
          const ogUrl = a.url || a.sourceUrl || "";
          const hit = data.isHit(a);
          const t = data.titleById(a.titleId);
          const on = state.selectedId === a.id ? " on" : "";
          const media = a.status === "planned" && !thumb
            ? `<span class="rank-media planned-media" aria-hidden="true"></span>`
            : `<span class="rank-media" data-og-url="${data.escapeHtml(ogUrl)}">${
                thumb ? `<img src="${data.escapeHtml(thumb)}" alt="" />` : `<img alt="" hidden />`
              }</span>`;
          return `<button type="button" class="rank-row t-${a.titleId}${on}${hit ? " hit" : ""}" data-id="${a.id}">
            <span class="rank-n">${i + 1}</span>
            ${media}
            <span class="rank-main">
              <span class="rank-kicker">${data.escapeHtml(a.type)}${hit ? " · hit" : ""}${a.status === "planned" ? " · gepland" : ""}</span>
              <span class="rank-title">${data.escapeHtml(a.headline)}</span>
            </span>
            <span class="rank-brand">${t ? data.titleHead(t) : data.escapeHtml(a.titleLabel || "")}</span>
            <span class="rank-type">${data.escapeHtml(a.type)}</span>
            <span class="rank-date">${data.formatListDate(a.date)}${a.time ? ` · ${data.escapeHtml(a.time.slice(0, 5))}` : ""}</span>
            <span class="rank-metric rank-pv${hit ? " hitn" : ""}">${kpiText(a, "pageviews")}</span>
            <span class="rank-metric rank-disc">${kpiText(a, "discoverClicks")}</span>
            <span class="rank-metric rank-org">${kpiText(a, "organicClicks")}</span>
          </button>`;
        })
        .join("");
      board.innerHTML = `<div class="rank-table">${head}${rows}</div>`;
    }

    function render() {
      const c = ctx();
      periodEl.textContent =
        c.view === "list"
          ? "Laatste 28 dagen"
          : c.view === "week"
            ? data.formatPeriodWeek(c.rangeStart)
            : opts.monthMode === "fourweeks"
              ? `${data.formatDayShort(c.rangeStart)} – ${data.formatDayShort(c.rangeEnd)}`
              : data.formatMonth(state.cursor);

      syncChrome();
      board.innerHTML = "";
      if (c.view === "list") renderList(c);
      else opts.render(board, c);
      bindCards(board);
      bindAdd(board);
      if (typeof opts.afterRender === "function") opts.afterRender(board, c);
      syncUrl();
      if (state.selectedId) openCard(state.selectedId, { skipRender: true });
    }

    function bindCards(scope) {
      scope.querySelectorAll("[data-id]").forEach((node) => {
        node.addEventListener("click", (e) => {
          e.preventDefault();
          openCard(node.getAttribute("data-id"));
        });
      });
    }

    function bindAdd(scope) {
      scope.querySelectorAll("[data-add-date]").forEach((node) => {
        node.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openNewCard({
            date: node.getAttribute("data-add-date"),
            titleId: node.getAttribute("data-add-title") || "",
          });
        });
      });
    }

    function kpiText(a, key) {
      if (a.status === "planned") return "—";
      if (!data.metricsLoaded) return "…";
      if (!data.metricsConnected) return "—";
      if (key === "pageviews" && !a.hasPageviews) return "—";
      return data.fmtK(a[key] || 0);
    }

    function openCard(id, flags) {
      const a = data.articles.find((x) => x.id === id);
      if (!a) return;
      state.selectedId = id;
      board.querySelectorAll(".acard.on, .rank-row.on").forEach((n) => n.classList.remove("on"));
      board.querySelectorAll(`[data-id="${id}"]`).forEach((n) => n.classList.add("on"));
      panel.innerHTML = panelHtml(a);
      panel.classList.add("show");
      overlay.classList.add("show");
      panel.querySelector("[data-close]")?.addEventListener("click", closePanel);
      panel.querySelector("[data-repub]")?.addEventListener("click", () => {
        const titleId = panel.querySelector("[name=repub-title]").value;
        const date = panel.querySelector("[name=repub-date]").value;
        const type = panel.querySelector("[name=repub-type]")?.value || a.type;
        const card = data.addPlanned({
          titleId,
          date,
          type,
          sourceId: a.id,
          headline: a.headline,
          imageUrl: a.imageUrl,
        });
        if (!card) {
          toast("Kaart inplannen mislukt.");
          return;
        }
        toast(`Gepland op ${data.titleById(titleId).label} · ${date}`);
        state.cursor = data.parseIso(date);
        closePanel();
        render();
        openCard(card.id);
      });
      panel.querySelector("[name=repub-title]")?.addEventListener("change", (e) => {
        const typeSel = panel.querySelector("[name=repub-type]");
        if (!typeSel) return;
        const types = data.TYPES[e.target.value] || [];
        typeSel.innerHTML = types.map((tp) => `<option>${tp}</option>`).join("");
      });
      panel.querySelector("[data-save-plan]")?.addEventListener("click", () => {
        const date = panel.querySelector("[name=plan-date]").value;
        const headline = panel.querySelector("[name=plan-headline]").value.trim();
        const type = panel.querySelector("[name=plan-type]").value;
        data.updatePlanned(a.id, { date, headline, type });
        toast("Kaart bijgewerkt.");
        state.cursor = data.parseIso(date);
        render();
        openCard(a.id);
      });
      panel.querySelector("[data-delete]")?.addEventListener("click", () => {
        data.removePlanned(a.id);
        toast("Geplande kaart verwijderd.");
        closePanel();
        render();
      });
      if ((a.url || a.sourceUrl) && !a.imageUrl) {
        void data.hydrateOgImages([a.url || a.sourceUrl], (map) => {
          data.applyImageMap(panel, map);
          data.applyImageMap(board, map);
        });
      }
      if (!flags?.skipRender) syncUrl();
    }

    function closePanel() {
      state.selectedId = null;
      panel.classList.remove("show");
      overlay.classList.remove("show");
      board.querySelectorAll(".acard.on, .rank-row.on").forEach((n) => n.classList.remove("on"));
      syncUrl();
    }

    function panelHtml(a) {
      const src = data.sourceArticle(a);
      const targets = data.targetArticles(a);
      const hit = data.isHit(a);
      const types = data.TYPES[a.titleId] || ["Nieuws"];
      const imageUrl = a.imageUrl || src?.imageUrl || "";
      const ogUrl = a.url || a.sourceUrl || "";
      const srcLine = src
        ? `${src.titleLabel} · ${src.date}`
        : a.sourceTitleLabel
          ? `${a.sourceTitleLabel}${a.sourceDate ? ` · ${a.sourceDate}` : ""}`
          : "";
      return `
        <div class="panel-head">
          <div style="flex:1">
            <span class="badge ${a.status}">${a.status === "planned" ? "Gepland" : "Verschenen"}</span>
            ${hit ? '<span class="badge hit">Hit</span>' : ""}
            <h2>${data.escapeHtml(a.headline)}</h2>
          </div>
          <button type="button" class="icon-btn" data-close aria-label="Sluiten">×</button>
        </div>
        <div class="panel-body">
          ${
            ogUrl || imageUrl
              ? `<div class="panel-media${imageUrl ? " has-img" : ""}" data-og-url="${data.escapeHtml(ogUrl)}">${
                  imageUrl
                    ? `<img src="${data.escapeHtml(imageUrl)}" alt="" />`
                    : `<img alt="" hidden />`
                }</div>`
              : ""
          }
          <div class="meta-row"><span>Titel</span><b>${data.titleHead(data.titleById(a.titleId))}</b></div>
          <div class="meta-row"><span>Type</span><b>${data.escapeHtml(a.type)}</b></div>
          <div class="meta-row"><span>Datum</span><b>${a.date}${a.time ? ` · ${a.time}` : ""}</b></div>
          ${
            a.url
              ? `<div class="meta-row"><span>URL</span><b><a href="${a.url}" target="_blank" rel="noreferrer">${data.escapeHtml(a.url.replace(/^https:\/\/www\./, ""))}</a></b></div>`
              : `<div class="meta-row"><span>URL</span><b>nog niet live</b></div>`
          }
          ${srcLine ? `<div class="meta-row"><span>Herplaatsing van</span><b>${data.escapeHtml(srcLine)}</b></div>` : ""}
          ${
            targets.length
              ? `<div class="meta-row"><span>Gepland op</span><b>${targets.map((t) => `${t.titleLabel} ${t.date}`).join(" · ")}</b></div>`
              : ""
          }
          <div class="kpi-grid">
            <div class="kpi"><div class="n">${kpiText(a, "discoverClicks")}</div><div class="l">Discover-clicks (GSC)</div></div>
            <div class="kpi"><div class="n">${kpiText(a, "organicClicks")}</div><div class="l">Organische clicks (GSC)</div></div>
          </div>
          <div class="meta-row"><span>Pageviews (GA4)</span><b>${kpiText(a, "pageviews")}</b></div>
          ${
            !data.metricsConnected && a.status === "published"
              ? `<p class="hint">Cijfers verschijnen als je via het dashboard met Google bent ingelogd.</p>`
              : ""
          }
          ${
            a.status === "planned"
              ? `
          <h3 class="panel-h">Kaart bewerken</h3>
          <div class="field">
            <label for="plan-headline">Kop</label>
            <input id="plan-headline" name="plan-headline" value="${data.escapeHtml(a.headline)}" />
          </div>
          <div class="field">
            <label for="plan-type">Type</label>
            <select id="plan-type" name="plan-type">
              ${types.map((tp) => `<option${tp === a.type ? " selected" : ""}>${tp}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="plan-date">Datum</label>
            <input id="plan-date" name="plan-date" type="date" value="${a.date}" />
          </div>
          <div class="panel-actions">
            <button type="button" class="btn" data-save-plan>Opslaan</button>
            <button type="button" class="btn btn-ghost danger" data-delete>Verwijderen</button>
          </div>`
              : `
          <h3 class="panel-h">Plaats ook op…</h3>
          <p class="hint">Plan dezelfde kop op een andere titel. De kaart blijft in deze browser bewaard.</p>
          <div class="field">
            <label for="repub-title">Titel</label>
            <select id="repub-title" name="repub-title">
              ${data.TITLES.filter((t) => t.id !== a.titleId)
                .map((t) => `<option value="${t.id}">${t.label}</option>`)
                .join("")}
            </select>
          </div>
          <div class="field">
            <label for="repub-type">Type</label>
            <select id="repub-type" name="repub-type">
              ${(data.TYPES[data.TITLES.find((t) => t.id !== a.titleId)?.id] || types)
                .map((tp) => `<option${tp === a.type ? " selected" : ""}>${tp}</option>`)
                .join("")}
            </select>
          </div>
          <div class="field">
            <label for="repub-date">Datum</label>
            <input id="repub-date" name="repub-date" type="date" value="${data.tomorrowIso()}" />
          </div>
          <div class="panel-actions">
            <button type="button" class="btn" data-repub>Kaart inplannen</button>
          </div>`
          }
        </div>
      `;
    }

    function recentSources() {
      const from = data.toIso(data.addDays(data.TODAY, -28));
      return data.published
        .filter((a) => a.date >= from)
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
        .slice(0, 40);
    }

    function openNewCard(preset) {
      closePanel();
      overlay.classList.add("show");
      modal.classList.add("show");
      const presetTitleId =
        preset?.titleId && data.titleById(preset.titleId) ? preset.titleId : data.TITLES[0].id;
      const presetDate = preset?.date || data.tomorrowIso();
      const firstTypes = data.TYPES[presetTitleId] || data.TYPES.icreate;
      modal.innerHTML = `
        <h2>Nieuwe kaart</h2>
        <p class="hint">Plan een nieuw bericht of een herplaatsing. Kaarten blijven in deze browser bewaard.</p>
        <div class="field">
          <label>Kop</label>
          <input name="new-title" placeholder="Bijvoorbeeld: Koopgids iPhone 16 vs 18" />
        </div>
        <div class="field">
          <label>Titel</label>
          <select name="new-brand">
            ${data.TITLES.map(
              (t) =>
                `<option value="${t.id}"${t.id === presetTitleId ? " selected" : ""}>${t.label}</option>`
            ).join("")}
          </select>
        </div>
        <div class="field">
          <label>Type</label>
          <select name="new-type">
            ${firstTypes.map((tp) => `<option>${tp}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Datum</label>
          <input type="date" name="new-date" value="${presetDate}" />
        </div>
        <div class="field">
          <label>Herplaatsing van (optioneel)</label>
          <select name="new-source">
            <option value="">Nieuw bericht</option>
            ${recentSources()
              .map(
                (a) =>
                  `<option value="${a.id}">${a.titleLabel}: ${data.escapeHtml(a.headline).slice(0, 64)}</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="panel-actions end">
          <button type="button" class="btn btn-ghost" data-cancel>Annuleren</button>
          <button type="button" class="btn" data-save>Kaart maken</button>
        </div>
      `;
      const brandSel = modal.querySelector("[name=new-brand]");
      const typeSel = modal.querySelector("[name=new-type]");
      brandSel.addEventListener("change", () => {
        const types = data.TYPES[brandSel.value] || firstTypes;
        typeSel.innerHTML = types.map((tp) => `<option>${tp}</option>`).join("");
      });
      modal.querySelector("[data-cancel]").addEventListener("click", closeModal);
      modal.querySelector("[data-save]").addEventListener("click", () => {
        const sourceId = modal.querySelector("[name=new-source]").value;
        const src = sourceId ? data.articles.find((x) => x.id === sourceId) : null;
        const title = modal.querySelector("[name=new-title]").value.trim() || src?.headline;
        if (!title) {
          toast("Vul een kop in, of kies een bestaand bericht.");
          return;
        }
        const date = modal.querySelector("[name=new-date]").value;
        const titleId = brandSel.value;
        const card = data.addPlanned({
          titleId,
          date,
          type: typeSel.value,
          headline: title,
          sourceId: src ? src.id : "",
          imageUrl: src?.imageUrl || "",
        });
        closeModal();
        if (!card) {
          toast("Kaart maken mislukt.");
          return;
        }
        state.cursor = data.parseIso(date);
        toast(`Gepland op ${data.titleById(titleId).label} · ${date}`);
        render();
        openCard(card.id);
      });
      modal.querySelector("[name=new-title]")?.focus();
    }

    function closeModal() {
      modal.classList.remove("show");
      if (!panel.classList.contains("show")) overlay.classList.remove("show");
    }

    let toastTimer;
    function toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
    }

    function closeSearchDrop() {
      searchDrop.hidden = true;
      searchDrop.innerHTML = "";
      searchHi = 0;
    }

    function jumpToArticle(id) {
      const a = data.articles.find((x) => x.id === id);
      if (!a) return;
      state.q = searchInput.value.trim();
      state.view = "week";
      state.cursor = data.parseIso(a.date);
      closeSearchDrop();
      render();
      openCard(id);
    }

    function renderSearchDrop() {
      const q = searchInput.value.trim();
      state.q = q;
      if (!q) {
        closeSearchDrop();
        if (state.view === "list") render();
        else syncUrl();
        return;
      }
      const pool = data.filterArticles(data.articles, filterSpec({ q: "" }));
      const matches = data.searchArticles(q, pool, 8);
      if (!matches.length) {
        searchDrop.innerHTML = `<div class="search-empty">Geen treffers</div>`;
        searchDrop.hidden = false;
        searchHi = 0;
        if (state.view === "list") render();
        else syncUrl();
        return;
      }
      searchHi = Math.min(searchHi, matches.length - 1);
      searchDrop.innerHTML = matches
        .map((a, i) => {
          const t = data.titleById(a.titleId);
          return `<button type="button" class="search-hit${i === searchHi ? " on" : ""}" data-jump-id="${a.id}">
            ${t ? `<img class="title-logo" src="${data.escapeHtml(t.logo)}" alt="" width="16" height="16" />` : ""}
            <span class="search-hit-main">
              <span class="search-hit-title">${data.escapeHtml(a.headline)}</span>
              <span class="search-hit-meta">${data.formatListDate(a.date)} · ${t ? data.escapeHtml(t.label) : ""} · ${kpiText(a, "pageviews")}</span>
            </span>
          </button>`;
        })
        .join("");
      searchDrop.hidden = false;
      searchDrop.querySelectorAll("[data-jump-id]").forEach((btn) => {
        btn.addEventListener("mousedown", (e) => e.preventDefault());
        btn.addEventListener("click", () => jumpToArticle(btn.getAttribute("data-jump-id")));
      });
      if (state.view === "list") render();
      else syncUrl();
    }

    root.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.view = btn.getAttribute("data-view");
        closeSearchDrop();
        render();
      });
    });

    root.querySelectorAll("[data-shift]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dir = Number(btn.getAttribute("data-shift"));
        if (state.view === "week") {
          state.cursor = data.addDays(data.startOfWeek(state.cursor), dir * 7);
        } else if (opts.monthMode === "fourweeks") {
          state.cursor = data.addDays(data.startOfWeek(state.cursor), dir * 28);
        } else {
          state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + dir, 1);
        }
        render();
      });
    });

    root.querySelector("[data-today]").addEventListener("click", () => {
      state.cursor = new Date(data.DEFAULT_WEEK_START);
      render();
    });
    root.querySelector("[data-new]").addEventListener("click", openNewCard);
    overlay.addEventListener("click", () => {
      closePanel();
      closeModal();
    });

    titleChips.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-title-chip]");
      if (!btn) return;
      const id = btn.getAttribute("data-title-chip");
      if (state.titles.includes(id)) {
        state.titles = state.titles.filter((x) => x !== id);
      } else {
        state.titles = allTitleIds.filter((x) => x === id || state.titles.includes(x));
      }
      render();
    });

    typeSelect.addEventListener("change", () => {
      state.type = typeSelect.value;
      render();
    });

    root.querySelectorAll("[data-pv]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.minPageviews = parseMinPageviews(btn.getAttribute("data-pv"));
        render();
      });
    });

    sortSelect.addEventListener("change", () => {
      state.sort = parseSort(sortSelect.value);
      render();
    });

    searchInput.addEventListener("input", () => {
      searchHi = 0;
      renderSearchDrop();
    });
    searchInput.addEventListener("focus", () => {
      if (searchInput.value.trim()) renderSearchDrop();
    });
    searchInput.addEventListener("blur", () => {
      setTimeout(closeSearchDrop, 120);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSearchDrop();
        searchInput.blur();
        return;
      }
      const hits = [...searchDrop.querySelectorAll("[data-jump-id]")];
      if (e.key === "ArrowDown" && hits.length) {
        e.preventDefault();
        searchHi = (searchHi + 1) % hits.length;
        hits.forEach((n, i) => n.classList.toggle("on", i === searchHi));
      } else if (e.key === "ArrowUp" && hits.length) {
        e.preventDefault();
        searchHi = (searchHi - 1 + hits.length) % hits.length;
        hits.forEach((n, i) => n.classList.toggle("on", i === searchHi));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const id = hits[searchHi]?.getAttribute("data-jump-id") || hits[0]?.getAttribute("data-jump-id");
        if (id) jumpToArticle(id);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closePanel();
        closeModal();
        closeSearchDrop();
      }
    });

    render();
    const api = { render, state, openCard, openNewCard, toast };
    global.AgendaChrome.current = api;
    return api;
  }

  global.AgendaChrome = { mount };
})(window);
