/* Apple-agenda: live feed + lokale planning, zonder database. */
(function (global) {
  const TITLES = [
    { id: "icreate", label: "iCreate", domain: "icreatemagazine.nl", logo: "/agenda-concepten/logos/icreate.png" },
    { id: "iphoned", label: "iPhoned", domain: "iphoned.nl", logo: "/agenda-concepten/logos/iphoned.png" },
    { id: "iculture", label: "iCulture", domain: "iculture.nl", logo: "/agenda-concepten/logos/iculture.png" },
  ];

  const TYPES = {
    icreate: ["Nieuws", "Tips", "Academy", "Koopadvies", "Review", "Hardware", "Software"],
    iphoned: ["Nieuws", "Tips", "Deal", "Koopadvies", "Review"],
    iculture: ["Nieuws", "Tips", "Deals", "Gids", "Review", "Koopadvies"],
  };

  const PLAN_KEY = "apple-agenda-planned-v1";
  const NL_DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
  const NL_DAYS_LONG = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
  const NL_MONTHS = [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december",
  ];
  const NL_MONTHS_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toIso(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseIso(s) {
    const [y, m, d] = String(s || "").split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function startOfWeek(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    return x;
  }

  function formatDayShort(d) {
    const dow = (d.getDay() + 6) % 7;
    return `${NL_DAYS[dow]} ${d.getDate()} ${NL_MONTHS_SHORT[d.getMonth()]}`;
  }

  function formatDayLong(d) {
    const dow = (d.getDay() + 6) % 7;
    return `${NL_DAYS_LONG[dow]} ${d.getDate()} ${NL_MONTHS[d.getMonth()]}`;
  }

  function formatPeriodWeek(start) {
    const end = addDays(start, 6);
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} ${NL_MONTHS[start.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${NL_MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${NL_MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  }

  function formatMonth(d) {
    return `${NL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function fmtK(n) {
    const v = Number(n) || 0;
    if (v >= 1000) {
      const k = v / 1000;
      const s = k >= 10 ? k.toFixed(0) : k.toFixed(1);
      return s.replace(".", ",") + "k";
    }
    return String(Math.round(v));
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function titleHead(t) {
    return `<img class="title-logo" src="${escapeHtml(t.logo)}" alt="" width="20" height="20" />${escapeHtml(t.label)}`;
  }

  function normalizeUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./i, "").toLowerCase();
      const path = (u.pathname.replace(/\/+$/, "") || "/").toLowerCase();
      return `${host}${path}`;
    } catch {
      return String(url || "")
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .replace(/\/+$/, "")
        .toLowerCase();
    }
  }

  const now = new Date();
  const TODAY = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const RANGE_START = addDays(TODAY, -28);
  const RANGE_END = addDays(TODAY, 42);

  const articles = [];
  let seq = 1;
  let metricsConnected = false;
  let metricsLoaded = false;

  function emptyMetrics() {
    return { pageviews: 0, discoverClicks: 0, organicClicks: 0, gscClicks: 0, metricsKnown: false, hasPageviews: false };
  }

  function newId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function titleById(id) {
    return TITLES.find((t) => t.id === id);
  }

  function isHit(a) {
    if (a.status !== "published" || !metricsConnected) return false;
    return (a.hasPageviews && a.pageviews >= 10000) || a.discoverClicks >= 500;
  }

  function metricLabel(a) {
    if (a.status === "planned") return `<span class="acard-metrics">gepland</span>`;
    if (!metricsLoaded) return `<span class="acard-metrics">…</span>`;
    if (!metricsConnected || !a.hasPageviews) return `<span class="acard-metrics">—</span>`;
    const hit = isHit(a);
    return `<span class="acard-metrics"><b class="${hit ? "hitn" : ""}">${fmtK(a.pageviews)}</b></span>`;
  }

  function articlesOn(iso, titleId, source) {
    return (source || articles)
      .filter((a) => a.date === iso && (!titleId || a.titleId === titleId))
      .sort((a, b) => (b.time || "").localeCompare(a.time || "") || b.n - a.n);
  }

  function articlesInRange(fromIso, toIso) {
    return articles.filter((a) => a.date >= fromIso && a.date <= toIso);
  }

  function daysInRange(from, to) {
    const out = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) out.push(new Date(d));
    return out;
  }

  function monthGrid(year, monthIndex) {
    const first = new Date(year, monthIndex, 1);
    const start = startOfWeek(first);
    const last = new Date(year, monthIndex + 1, 0);
    const end = addDays(startOfWeek(last), 6);
    const weeks = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 7)) {
      weeks.push(daysInRange(d, addDays(d, 6)));
    }
    return { start, end, weeks };
  }

  function fourWeekGrid(weekStart) {
    const start = addDays(weekStart, -21);
    const weeks = [];
    for (let i = 0; i < 4; i++) {
      const s = addDays(start, i * 7);
      weeks.push(daysInRange(s, addDays(s, 6)));
    }
    return { start, end: addDays(start, 27), weeks };
  }

  function sourceArticle(a) {
    if (!a.sourceId && !a.sourceUrl) return null;
    return (
      articles.find((x) => a.sourceId && x.id === a.sourceId) ||
      articles.find((x) => a.sourceUrl && x.url && normalizeUrl(x.url) === normalizeUrl(a.sourceUrl)) ||
      null
    );
  }

  function targetArticles(a) {
    return articles.filter((x) => x.status === "planned" && (x.sourceId === a.id || (a.url && x.sourceUrl && normalizeUrl(x.sourceUrl) === normalizeUrl(a.url))));
  }

  function relinkTargets() {
    for (const a of articles) {
      a.targetIds = targetArticles(a).map((t) => t.id);
    }
  }

  function sortArticles() {
    articles.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.n - b.n);
  }

  function readPlannedStore() {
    try {
      const raw = localStorage.getItem(PLAN_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return Array.isArray(data?.cards) ? data.cards : [];
    } catch {
      return [];
    }
  }

  function writePlannedStore() {
    const cards = articles
      .filter((a) => a.status === "planned")
      .map((a) => ({
        id: a.id,
        titleId: a.titleId,
        headline: a.headline,
        type: a.type,
        date: a.date,
        time: a.time || "09:00",
        sourceId: a.sourceId || null,
        sourceUrl: a.sourceUrl || "",
        sourceHeadline: a.sourceHeadline || "",
        sourceTitleLabel: a.sourceTitleLabel || "",
        sourceDate: a.sourceDate || "",
        imageUrl: a.imageUrl || "",
      }));
    localStorage.setItem(PLAN_KEY, JSON.stringify({ version: 1, cards }));
  }

  function plannedFromStore(spec) {
    const t = titleById(spec.titleId);
    if (!t || !spec.date || !spec.headline) return null;
    return {
      id: spec.id || newId(`plan-${t.id}`),
      n: seq++,
      titleId: t.id,
      titleLabel: t.label,
      headline: spec.headline,
      type: spec.type || "Nieuws",
      date: spec.date,
      time: spec.time || "09:00",
      status: "planned",
      pageviews: 0,
      discoverClicks: 0,
      organicClicks: 0,
      gscClicks: 0,
      metricsKnown: false,
      hasPageviews: false,
      imageUrl: spec.imageUrl || "",
      url: "",
      sourceId: spec.sourceId || null,
      sourceUrl: spec.sourceUrl || "",
      sourceHeadline: spec.sourceHeadline || "",
      sourceTitleLabel: spec.sourceTitleLabel || "",
      sourceDate: spec.sourceDate || "",
      targetIds: [],
    };
  }

  function mergePlanned() {
    for (const spec of readPlannedStore()) {
      if (articles.some((a) => a.id === spec.id)) continue;
      const card = plannedFromStore(spec);
      if (card) articles.push(card);
    }
    relinkTargets();
    sortArticles();
  }

  function ingestLive(rows) {
    articles.splice(0, articles.length);
    seq = 1;
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const t = TITLES.find((x) => x.id === r.titleId);
        if (!t || !r.headline || !r.date) continue;
        const m = emptyMetrics();
        articles.push({
          id: r.id || `${r.titleId}-${r.date}-${seq}`,
          n: seq++,
          titleId: r.titleId,
          titleLabel: r.titleLabel || t.label,
          headline: r.headline,
          type: r.type || "Nieuws",
          date: r.date,
          time: r.time || "09:00",
          status: "published",
          pageviews: m.pageviews,
          discoverClicks: m.discoverClicks,
          organicClicks: m.organicClicks,
          gscClicks: m.gscClicks,
          metricsKnown: false,
          hasPageviews: false,
          imageUrl: r.imageUrl || "",
          url: r.url || "",
          sourceId: null,
          sourceUrl: "",
          targetIds: [],
        });
      }
    }
    mergePlanned();
    return articles.length > 0;
  }

  function applyMetrics(byUrl, connected) {
    metricsConnected = Boolean(connected);
    metricsLoaded = true;
    const map = byUrl && typeof byUrl === "object" ? byUrl : {};
    for (const a of articles) {
      if (a.status !== "published" || !a.url) continue;
      const row = map[normalizeUrl(a.url)];
      a.discoverClicks = Number(row?.discoverClicks) || 0;
      a.organicClicks = Number(row?.organicClicks) || 0;
      a.gscClicks = a.discoverClicks + a.organicClicks;
      if (row && row.pageviews != null) {
        a.pageviews = Number(row.pageviews) || 0;
        a.hasPageviews = true;
      } else {
        a.pageviews = 0;
        a.hasPageviews = false;
      }
      a.metricsKnown = metricsConnected;
    }
  }

  function addPlanned(spec) {
    const t = titleById(spec.titleId);
    if (!t) return null;
    const src = spec.sourceId ? articles.find((x) => x.id === spec.sourceId) : null;
    const card = plannedFromStore({
      id: newId(`plan-${t.id}`),
      titleId: t.id,
      headline: spec.headline || src?.headline || "Gepland bericht",
      type: spec.type || src?.type || "Nieuws",
      date: spec.date,
      time: spec.time || "09:00",
      sourceId: src ? src.id : spec.sourceId || null,
      sourceUrl: src?.url || spec.sourceUrl || "",
      sourceHeadline: src?.headline || spec.sourceHeadline || "",
      sourceTitleLabel: src?.titleLabel || spec.sourceTitleLabel || "",
      sourceDate: src?.date || spec.sourceDate || "",
      imageUrl: src?.imageUrl || spec.imageUrl || "",
    });
    if (!card) return null;
    articles.push(card);
    relinkTargets();
    sortArticles();
    writePlannedStore();
    return card;
  }

  function updatePlanned(id, patch) {
    const a = articles.find((x) => x.id === id && x.status === "planned");
    if (!a) return null;
    if (patch.date) a.date = patch.date;
    if (patch.headline) a.headline = patch.headline;
    if (patch.type) a.type = patch.type;
    if (patch.titleId && titleById(patch.titleId)) {
      const t = titleById(patch.titleId);
      a.titleId = t.id;
      a.titleLabel = t.label;
    }
    sortArticles();
    writePlannedStore();
    return a;
  }

  function removePlanned(id) {
    const idx = articles.findIndex((x) => x.id === id && x.status === "planned");
    if (idx < 0) return false;
    articles.splice(idx, 1);
    relinkTargets();
    writePlannedStore();
    return true;
  }

  function renderStack(arts, opts) {
    const max = opts.max;
    const key = opts.key;
    const expanded = opts.expanded;
    const variant = opts.variant || (max <= 2 ? "chip" : "");
    const open = expanded.has(key);
    const shown = open ? arts : arts.slice(0, max);
    const rest = arts.length - shown.length;
    let html = shown.map((a) => cardHtml(a, variant)).join("");
    if (!arts.length) return "";
    if (rest > 0) html += `<button type="button" class="more-btn" data-more="${key}">+${rest} meer</button>`;
    else if (open && arts.length > max) html += `<button type="button" class="more-btn" data-more="${key}">toon minder</button>`;
    return html;
  }

  function bindMore(board, expanded) {
    board.querySelectorAll("[data-more]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = btn.getAttribute("data-more");
        if (expanded.has(key)) expanded.delete(key);
        else expanded.add(key);
        global.AgendaChrome.current.render();
      });
    });
  }

  function cardTimeHtml(a) {
    if (!a.time) return "";
    return `<span class="acard-time">${escapeHtml(a.time.slice(0, 5))}</span>`;
  }

  function titleBlockHtml(a, variant) {
    const title = `<span class="acard-title">${escapeHtml(a.headline)}</span>`;
    const time = cardTimeHtml(a);
    if (variant === "lane" || variant === "lane-chip") {
      return `<span class="acard-body">${title}${time}</span>`;
    }
    return `${title}${time}`;
  }

  function cardHtml(a, variant) {
    const hit = isHit(a);
    const src = sourceArticle(a);
    const srcLabel = src
      ? `${src.titleLabel} · ${src.date.slice(8)}.${src.date.slice(5, 7)}`
      : a.sourceTitleLabel
        ? `${a.sourceTitleLabel}${a.sourceDate ? ` · ${a.sourceDate.slice(8)}.${a.sourceDate.slice(5, 7)}` : ""}`
        : "";
    const targets = targetArticles(a);
    const cls = ["acard", `t-${a.titleId}`, a.status, hit ? "hit" : "", variant || ""]
      .filter(Boolean)
      .join(" ");

    let extra = "";
    if (srcLabel) extra = `<span class="acard-repub">van ${escapeHtml(srcLabel)}</span>`;
    else if (targets.length) extra = `<span class="acard-repub">→ ${targets.map((t) => t.titleLabel).join(", ")}</span>`;

    const metrics = metricLabel(a);

    if (variant === "chip") {
      return `<button type="button" class="${cls}" data-id="${a.id}" title="${escapeHtml(a.headline)}">
        ${titleBlockHtml(a, variant)}
        ${metrics}
      </button>`;
    }

    if (variant === "lane" || variant === "lane-chip") {
      const thumb = a.imageUrl || (src && src.imageUrl) || "";
      const media = a.status === "planned" && !thumb
        ? `<span class="acard-media planned-media" aria-hidden="true"></span>`
        : `<span class="acard-media" data-og-url="${escapeHtml(a.url || a.sourceUrl || "")}">${
            thumb
              ? `<img src="${escapeHtml(thumb)}" alt="" />`
              : `<img alt="" hidden />`
          }</span>`;
      return `<button type="button" class="${cls}" data-id="${a.id}">
        ${media}
        <span class="acard-kicker">${escapeHtml(a.type)}${hit ? " · hit" : ""}</span>
        ${titleBlockHtml(a, variant)}
        ${metrics}
        ${extra}
      </button>`;
    }

    return `<button type="button" class="${cls}" data-id="${a.id}">
      <span class="acard-kicker">${escapeHtml(a.type)}${hit ? " · hit" : ""}</span>
      ${titleBlockHtml(a, variant)}
      ${metrics}
      ${extra}
    </button>`;
  }

  async function hydrateOgImages(urls, onBatch) {
    const unique = [...new Set((urls || []).filter(Boolean))];
    const map = {};
    for (let i = 0; i < unique.length; i += 40) {
      const batch = unique.slice(i, i + 40);
      try {
        const res = await fetch("/api/og-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: batch }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        Object.assign(map, data.images || {});
        for (const a of articles) {
          const key = a.url || a.sourceUrl;
          if (!key) continue;
          const img = map[key] || map[key.replace(/\/$/, "")];
          if (img) a.imageUrl = img;
        }
        if (typeof onBatch === "function") onBatch(map);
      } catch {
        /* skip batch */
      }
    }
    return map;
  }

  function applyImageMap(scope, map) {
    if (!scope || !map) return;
    scope.querySelectorAll("[data-og-url]").forEach((el) => {
      const url = el.getAttribute("data-og-url");
      const imgUrl = map[url] || map[(url || "").replace(/\/$/, "")];
      if (!imgUrl) return;
      let img = el.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        img.alt = "";
        el.appendChild(img);
      }
      img.hidden = false;
      img.src = imgUrl;
      el.classList.add("has-img");
    });
  }

  function tomorrowIso() {
    return toIso(addDays(TODAY, 1));
  }

  function allTypes() {
    const set = new Set();
    for (const list of Object.values(TYPES)) {
      for (const label of list) set.add(label);
    }
    return [...set];
  }

  function normalizeSearch(q) {
    return String(q || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function articleMatchesSearch(a, q) {
    const needle = normalizeSearch(q);
    if (!needle) return true;
    const hay = `${a.headline || ""} ${a.url || ""} ${a.type || ""} ${a.titleLabel || ""}`.toLowerCase();
    return hay.includes(needle);
  }

  function matchesFilters(a, filters) {
    if (!a || !filters) return true;
    const titles = filters.titles;
    if (Array.isArray(titles)) {
      if (!titles.length) return false;
      if (!titles.includes(a.titleId)) return false;
    }
    if (filters.type && a.type !== filters.type) return false;
    const minPv = Number(filters.minPageviews) || 0;
    if (minPv > 0) {
      if (a.status === "planned" || !a.hasPageviews) return false;
      if ((Number(a.pageviews) || 0) < minPv) return false;
    }
    if (filters.q && !articleMatchesSearch(a, filters.q)) return false;
    return true;
  }

  function filterArticles(list, filters) {
    return (list || articles).filter((a) => matchesFilters(a, filters));
  }

  function searchArticles(query, list, limit) {
    const needle = normalizeSearch(query);
    if (!needle) return [];
    const source = list || articles;
    const matches = source.filter((a) => articleMatchesSearch(a, needle));
    matches.sort((a, b) => {
      const ah = (a.headline || "").toLowerCase();
      const bh = (b.headline || "").toLowerCase();
      const as = ah.startsWith(needle) ? 0 : ah.includes(needle) ? 1 : 2;
      const bs = bh.startsWith(needle) ? 0 : bh.includes(needle) ? 1 : 2;
      if (as !== bs) return as - bs;
      const pv = (Number(b.pageviews) || 0) - (Number(a.pageviews) || 0);
      if (pv) return pv;
      return `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`);
    });
    return typeof limit === "number" ? matches.slice(0, limit) : matches;
  }

  function metricValue(a, metric) {
    if (metric === "discoverClicks") return Number(a.discoverClicks) || 0;
    if (metric === "organicClicks") return Number(a.organicClicks) || 0;
    return Number(a.pageviews) || 0;
  }

  function sortArticlesBy(list, metric) {
    const key = metric || "pageviews";
    const copy = [...(list || articles)];
    copy.sort((a, b) => {
      const aLast = a.status === "planned" || (key === "pageviews" && a.status === "published" && !a.hasPageviews);
      const bLast = b.status === "planned" || (key === "pageviews" && b.status === "published" && !b.hasPageviews);
      if (aLast !== bLast) return aLast ? 1 : -1;
      if (key === "date") {
        return `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`);
      }
      const diff = metricValue(b, key) - metricValue(a, key);
      if (diff) return diff;
      return `${b.date}${b.time || ""}`.localeCompare(`${a.date}${a.time || ""}`);
    });
    return copy;
  }

  function formatListDate(iso) {
    const d = parseIso(iso);
    if (Number.isNaN(d.getTime())) return iso || "";
    return `${d.getDate()} ${NL_MONTHS_SHORT[d.getMonth()]}`;
  }

  global.AgendaData = {
    TITLES,
    TYPES,
    TODAY,
    RANGE_START,
    RANGE_END,
    DEFAULT_WEEK_START: startOfWeek(TODAY),
    articles,
    get published() {
      return articles.filter((a) => a.status === "published");
    },
    get planned() {
      return articles.filter((a) => a.status === "planned");
    },
    get metricsConnected() {
      return metricsConnected;
    },
    get metricsLoaded() {
      return metricsLoaded;
    },
    isHit,
    titleById,
    articlesOn,
    articlesInRange,
    daysInRange,
    monthGrid,
    fourWeekGrid,
    startOfWeek,
    addDays,
    toIso,
    parseIso,
    formatDayShort,
    formatDayLong,
    formatPeriodWeek,
    formatMonth,
    fmtK,
    cardHtml,
    titleHead,
    renderStack,
    bindMore,
    sourceArticle,
    targetArticles,
    escapeHtml,
    ingestLive,
    applyMetrics,
    addPlanned,
    updatePlanned,
    removePlanned,
    hydrateOgImages,
    applyImageMap,
    tomorrowIso,
    allTypes,
    matchesFilters,
    filterArticles,
    searchArticles,
    sortArticlesBy,
    formatListDate,
    NL_DAYS,
    NL_DAYS_LONG,
    stats() {
      const pub = articles.filter((a) => a.status === "published");
      const plan = articles.filter((a) => a.status === "planned");
      const by = {};
      for (const t of TITLES) {
        by[t.id] = pub.filter((a) => a.titleId === t.id).length;
      }
      return {
        total: articles.length,
        published: pub.length,
        planned: plan.length,
        byTitle: by,
        hits: pub.filter(isHit).length,
        links: plan.filter((a) => a.sourceId || a.sourceUrl).length,
      };
    },
  };
})(window);
