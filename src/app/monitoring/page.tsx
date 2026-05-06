"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import { RefreshCw, ExternalLink, Bell, BellOff, Search, BarChart3, Link2Off, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface NewsArticle {
  source: string;
  title: string;
  url: string;
  publicationDate: string;
  imageUrl?: string;
  faviconUrl?: string;
  discoverClicks?: number;
  discoverImpressions?: number;
}

const SOURCES = [
  "iCreate",
  "Gardeners' World",
  "Historisch Nieuwsblad",
  "Auto Review",
] as const;

const SOURCE_COLORS: Record<string, string> = {
  "iCreate": "bg-blue-100 text-blue-800 border-blue-200",
  "Gardeners' World": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Historisch Nieuwsblad": "bg-amber-100 text-amber-800 border-amber-200",
  "Auto Review": "bg-slate-100 text-slate-800 border-slate-200",
};

const DOMAIN_TO_SOURCE: Record<string, string> = {
  "icreatemagazine.nl": "iCreate",
  "www.icreatemagazine.nl": "iCreate",
  "gardenersworldmagazine.nl": "Gardeners' World",
  "www.gardenersworldmagazine.nl": "Gardeners' World",
  "historischnieuwsblad.nl": "Historisch Nieuwsblad",
  "www.historischnieuwsblad.nl": "Historisch Nieuwsblad",
  "autoreview.nl": "Auto Review",
  "www.autoreview.nl": "Auto Review",
};

const SOURCE_TO_DOMAIN: Record<string, string> = {
  "iCreate": "icreatemagazine.nl",
  "Gardeners' World": "gardenersworldmagazine.nl",
  "Historisch Nieuwsblad": "historischnieuwsblad.nl",
  "Auto Review": "autoreview.nl",
};

const GSC_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Google-toegang is geannuleerd.",
  no_code: "Geen autorisatiecode ontvangen. Probeer opnieuw.",
  config: "OAuth is niet correct geconfigureerd (controleer GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET).",
  token_failed: "Token-uitwisseling mislukt. Probeer opnieuw.",
  unknown: "Er ging iets mis bij het verbinden. Probeer opnieuw.",
};

function messageForGscOAuthError(code: string): string {
  return GSC_OAUTH_ERROR_MESSAGES[code] ?? `Search Console kon niet worden verbonden (${code}).`;
}

function getFaviconUrl(source: string, fromArticles?: string): string {
  if (fromArticles) return fromArticles;
  const domain = SOURCE_TO_DOMAIN[source];
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

function getSourceFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return (
      DOMAIN_TO_SOURCE[host] ??
      DOMAIN_TO_SOURCE[host.replace(/^www\./, "")] ??
      host
    );
  } catch {
    return "Overig";
  }
}

function getUrlDisplayText(url: string): string {
  try {
    const path = new URL(url).pathname;
    const slug = path.split("/").filter(Boolean).pop() ?? path;
    return slug.replace(/-/g, " ").slice(0, 80);
  } catch {
    return url;
  }
}


function getRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return formatDistanceToNow(date, { addSuffix: true, locale: nl });
  } catch {
    return dateStr;
  }
}

function isWithin24Hours(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minuten

const CIJFERS_METRICS: { key: string; label: string }[] = [
  { key: "pageviews", label: "Pageviews" },
  { key: "discoverClicks", label: "Discover-clicks" },
  { key: "searchClicks", label: "Google Search-clicks" },
  { key: "searchConsoleTotal", label: "GSC totaal (Discover + Search)" },
  { key: "newsletterSignups", label: "Nieuwsbriefinschrijvingen" },
];

export default function MonitoringPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | null
  >(null);
  const [showImages, setShowImages] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [gscConnected, setGscConnected] = useState(false);
  const [gscAuthError, setGscAuthError] = useState<string | null>(null);
  const [gscData, setGscData] = useState<Record<string, { clicks: number; impressions: number }>>({});
  const [discoverRawData, setDiscoverRawData] = useState<
    { url: string; clicks: number; impressions: number; source: string }[]
  >([]);
  const [discoverTitles, setDiscoverTitles] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"recent" | "discover" | "cijfers" | "realtime">("recent");
  const [discoverExpanded, setDiscoverExpanded] = useState<Record<string, number>>({});
  const [ga4NewsletterByUrl, setGa4NewsletterByUrl] = useState<Record<string, number>>({});
  const [realtimeData, setRealtimeData] = useState<{
    data: { source: string; activeUsers: number }[];
    topPages: { source: string; pageTitle: string; screenPageViews: number }[];
  } | null>(null);
  const [realtimeLoading, setRealtimeLoading] = useState(false);
  const [cijfersData, setCijfersData] = useState<{
    periods: { current: { startDate: string; endDate: string }; previous: { startDate: string; endDate: string } };
    sources: { source: string; metrics: Record<string, { current: number; previous: number; change: number; changePercent: number | null }> }[];
  } | null>(null);
  const knownUrlsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  function normalizeUrl(url: string): string {
    return url.replace(/\/$/, "");
  }

  const articlesWithGsc = useMemo(() => {
    if (Object.keys(gscData).length === 0) return articles;
    const keyed = Object.fromEntries(
      Object.entries(gscData).map(([k, v]) => [normalizeUrl(k), v])
    );
    return articles.map((a) => ({
      ...a,
      discoverClicks: keyed[normalizeUrl(a.url)]?.clicks ?? 0,
      discoverImpressions: keyed[normalizeUrl(a.url)]?.impressions ?? 0,
    }));
  }, [articles, gscData]);

  const filteredArticles = useMemo(() => {
    let result = [...articlesWithGsc];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((a) => a.title.toLowerCase().includes(q));
    }

    if (sourceFilter !== "all") {
      result = result.filter((a) => a.source === sourceFilter);
    }

    if (dateFilter === "24h") {
      const now = Date.now();
      const ms = 24 * 60 * 60 * 1000;
      const cutoff = now - ms;
      result = result.filter(
        (a) => new Date(a.publicationDate).getTime() >= cutoff
      );
    }

    result.sort((a, b) => {
      if (sortBy === "date") {
        return (
          new Date(b.publicationDate).getTime() -
          new Date(a.publicationDate).getTime()
        );
      }
      if (sortBy === "source") {
        return a.source.localeCompare(b.source);
      }
      if (sortBy === "titleLength") {
        return a.title.length - b.title.length;
      }
      if (sortBy === "clicks") {
        return (b.discoverClicks ?? 0) - (a.discoverClicks ?? 0);
      }
      return 0;
    });

    return result;
  }, [articlesWithGsc, searchQuery, sourceFilter, dateFilter, sortBy]);

  const urlToArticle = useMemo(() => {
    const map: Record<string, NewsArticle> = {};
    for (const a of articles) {
      map[normalizeUrl(a.url)] = a;
    }
    return map;
  }, [articles]);

  const discoverBySource = useMemo(() => {
    const grouped: Record<string, { url: string; clicks: number; impressions: number; source: string }[]> = {};
    for (const source of SOURCES) {
      grouped[source] = [];
    }
    for (const row of discoverRawData) {
      if (SOURCES.includes(row.source as (typeof SOURCES)[number])) {
        grouped[row.source].push(row);
      }
    }
    return grouped;
  }, [discoverRawData]);

  const sourceToFavicon = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of articles) {
      if (a.faviconUrl && !map[a.source]) map[a.source] = a.faviconUrl;
    }
    return map;
  }, [articles]);

  const discoverTop5Urls = useMemo(() => {
    const urls: string[] = [];
    for (const source of SOURCES) {
      const rows = discoverBySource[source] ?? [];
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        urls.push(rows[i].url);
      }
    }
    return urls;
  }, [discoverBySource]);

  const displayArticles =
    viewMode === "discover" ? discoverRawData : filteredArticles;

  // Laad afbeeldingsvoorkeur uit localStorage
  useEffect(() => {
    const stored = localStorage.getItem("seo-news-show-images");
    if (stored !== null) setShowImages(stored === "true");
  }, []);

  // Bewaar afbeeldingsvoorkeur in localStorage
  useEffect(() => {
    localStorage.setItem("seo-news-show-images", String(showImages));
  }, [showImages]);

  async function fetchNews(): Promise<NewsArticle[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const res = await fetch("/api/fetch-news", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setArticles(data);
      return data;
    } catch (err) {
      console.error(err);
      setArticles([]);
      return [];
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchGscData(forceRefresh = false) {
    try {
      const url = forceRefresh ? "/api/search-console?days=28&refresh=1" : "/api/search-console?days=28";
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setGscData(data);
      }
    } catch {
      setGscData({});
    }
  }

  async function fetchDiscoverRawData(forceRefresh = false) {
    try {
      const url = forceRefresh ? "/api/search-console?days=7&refresh=1" : "/api/search-console?days=7";
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as Record<
          string,
          { clicks: number; impressions: number }
        >;
        const rows = Object.entries(data)
          .filter(([, stats]) => stats.impressions > 0)
          .map(([url, stats]) => ({
            url,
            clicks: stats.clicks,
            impressions: stats.impressions,
            source: getSourceFromUrl(url),
          }))
          .sort((a, b) => b.clicks - a.clicks);
        setDiscoverRawData(rows);
      } else {
        setDiscoverRawData([]);
      }
    } catch {
      setDiscoverRawData([]);
    }
  }

  async function fetchGA4NewsletterByPage(forceRefresh = false) {
    try {
      const url = forceRefresh ? "/api/ga4-events-by-page?days=28&refresh=1" : "/api/ga4-events-by-page?days=28";
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as Record<string, number>;
        setGa4NewsletterByUrl(data);
      } else {
        setGa4NewsletterByUrl({});
      }
    } catch {
      setGa4NewsletterByUrl({});
    }
  }

  async function fetchCijfersData(forceRefresh = false) {
    if (forceRefresh) setRefreshing(true);
    try {
      const url = forceRefresh ? "/api/cijfers?refresh=1" : "/api/cijfers";
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCijfersData(data);
      } else {
        setCijfersData(null);
      }
    } catch {
      setCijfersData(null);
    } finally {
      if (forceRefresh) setRefreshing(false);
    }
  }

  async function fetchRealtimeData() {
    setRealtimeLoading(true);
    try {
      const res = await fetch("/api/ga4-realtime", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setRealtimeData(json);
      } else {
        setRealtimeData(null);
      }
    } catch {
      setRealtimeData(null);
    } finally {
      setRealtimeLoading(false);
    }
  }

  async function checkGscStatus() {
    try {
      const res = await fetch("/api/auth/status", { credentials: "include" });
      if (res.ok) {
        const { connected } = await res.json();
        setGscConnected(connected);
        if (connected) {
          fetchGscData();
          fetchDiscoverRawData();
        }
      }
    } catch {
      setGscConnected(false);
    }
  }

  async function handleDisconnectGsc() {
    try {
      await fetch("/api/auth/disconnect", {
        method: "POST",
        credentials: "include",
      });
      setGscConnected(false);
      setGscData({});
      setViewMode("recent");
    } catch {
      // ignore
    }
  }

  function showNewArticleNotification(newArticles: NewsArticle[]) {
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;

    const count = newArticles.length;
    const title =
      count === 1
        ? "Nieuw artikel gepubliceerd"
        : `${count} nieuwe artikelen gepubliceerd`;
    const body =
      count === 1
        ? `${newArticles[0].source}: ${newArticles[0].title}`
        : newArticles
            .slice(0, 3)
            .map((a) => `• ${a.source}: ${a.title}`)
            .join("\n");

    const notification = new Notification(title, {
      body: body.length > 200 ? body.slice(0, 197) + "…" : body,
      icon: "/favicon.ico",
      tag: "seo-news-new",
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  async function handleEnableNotifications() {
    if (!("Notification" in window)) {
      alert("Deze browser ondersteunt geen notificaties.");
      return;
    }

    if (Notification.permission === "granted") {
      setNotificationsEnabled(true);
      setNotificationPermission("granted");
      return;
    }

    if (Notification.permission === "denied") {
      setNotificationPermission("denied");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      setNotificationsEnabled(true);
    }
  }

  function handleDisableNotifications() {
    setNotificationsEnabled(false);
  }

  useEffect(() => {
    fetchNews();
    checkGscStatus();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gsc_connected") === "1") {
      setGscConnected(true);
      fetchGscData();
      fetchDiscoverRawData();
      fetchGA4NewsletterByPage();
      window.history.replaceState({}, "", "/monitoring");
    }
    const err = params.get("gsc_error");
    if (err) {
      setGscAuthError(messageForGscOAuthError(err));
      window.history.replaceState({}, "", "/monitoring");
    }
  }, []);

  useEffect(() => {
    if (viewMode === "discover" && gscConnected) {
      fetchDiscoverRawData();
      fetchGA4NewsletterByPage();
    }
  }, [viewMode, gscConnected]);

  useEffect(() => {
    if (viewMode === "cijfers" && gscConnected) {
      fetchCijfersData();
    }
  }, [viewMode, gscConnected]);

  useEffect(() => {
    if (viewMode === "realtime" && gscConnected) {
      fetchRealtimeData();
    }
  }, [viewMode, gscConnected]);

  useEffect(() => {
    if (viewMode !== "discover" || discoverTop5Urls.length === 0) return;

    const urlsToFetch = discoverTop5Urls.filter(
      (url) => !urlToArticle[normalizeUrl(url)]
    );
    if (urlsToFetch.length === 0) return;

    fetch("/api/fetch-titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: urlsToFetch }),
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, string>) =>
        setDiscoverTitles((prev) => ({ ...prev, ...data }))
      )
      .catch(() => {});
  }, [viewMode, discoverTop5Urls, urlToArticle]);


  // Check bestaande notificatie-permissie bij laden
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === "granted") {
        setNotificationsEnabled(true);
      }
    }
  }, []);

  // Poll voor nieuwe artikelen wanneer notificaties aan staan
  useEffect(() => {
    if (!notificationsEnabled || !("Notification" in window)) return;

    const interval = setInterval(async () => {
      const data = (await fetch("/api/fetch-news").then((r) =>
        r.ok ? r.json() : []
      )) as NewsArticle[];
      if (data.length === 0) return;

      const currentUrls = new Set<string>(data.map((a) => a.url));
      const newArticles = data.filter((a) => !knownUrlsRef.current.has(a.url));

      if (newArticles.length > 0 && !isInitialLoadRef.current) {
        showNewArticleNotification(newArticles);
      }

      knownUrlsRef.current = currentUrls;
      setArticles(data);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [notificationsEnabled]);

  // Bewaar bekende URLs na eerste load (voor vergelijking bij polling)
  useEffect(() => {
    if (articles.length > 0 && isInitialLoadRef.current) {
      knownUrlsRef.current = new Set(articles.map((a) => a.url));
      isInitialLoadRef.current = false;
    }
  }, [articles]);

  function handleRefresh() {
    setRefreshing(true);
    fetchNews().then((data) => {
      if (data.length > 0) {
        knownUrlsRef.current = new Set(data.map((a) => a.url));
      }
    });
    if (gscConnected) {
      fetchGscData(true);
      if (viewMode === "discover") {
        fetchDiscoverRawData(true);
        fetchGA4NewsletterByPage(true);
      }
      if (viewMode === "cijfers") {
        fetchCijfersData(true);
      }
      if (viewMode === "realtime") {
        fetchRealtimeData();
      }
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              SEO News Monitor
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Laatste artikelen van iCreate, Gardeners&apos; World, Historisch
              Nieuwsblad en Auto Review
              {notificationsEnabled && (
                <span className="ml-2 text-green-600">
                  • Controleert elke 5 minuten
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <Switch
                checked={showImages}
                onCheckedChange={setShowImages}
              />
              <span>Afbeeldingen</span>
            </label>
            {!notificationsEnabled ? (
              <Button
                onClick={handleEnableNotifications}
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={notificationPermission === "denied"}
                title={notificationPermission === "denied" ? "Toegang geweigerd" : undefined}
              >
                <Bell className="size-4" />
                <span>Notificaties</span>
              </Button>
            ) : (
              <Button
                onClick={handleDisableNotifications}
                variant="outline"
                size="sm"
                className="shrink-0 border-green-200 bg-green-50 text-green-800 hover:bg-green-100"
              >
                <BellOff className="size-4" />
                <span>Notificaties</span>
              </Button>
            )}
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="icon-sm"
              className="shrink-0"
              title="Vernieuwen"
            >
              {refreshing ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Button>
            {!gscConnected ? (
              <Button
                onClick={() => (window.location.href = "/api/auth/google")}
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                <BarChart3 className="size-4" />
                <span>Search Console</span>
              </Button>
            ) : (
              <Button
                onClick={handleDisconnectGsc}
                variant="outline"
                size="sm"
                className="shrink-0 border-green-200 bg-green-50 text-green-800 hover:bg-green-100"
              >
                <Link2Off className="size-4" />
                <span>GSC verbonden</span>
              </Button>
            )}
          </div>
        </header>

        {gscAuthError && (
          <div
            role="alert"
            className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            <span>{gscAuthError}</span>
            <button
              type="button"
              onClick={() => setGscAuthError(null)}
              className="shrink-0 font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950"
            >
              Sluiten
            </button>
          </div>
        )}

        <div className="mb-4 flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
          <button
            type="button"
            onClick={() => setViewMode("recent")}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === "recent"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Recent
          </button>
          <button
            type="button"
            onClick={() => setViewMode("discover")}
            disabled={!gscConnected}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              viewMode === "discover"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title={!gscConnected ? "Verbind Search Console om Discover te zien" : undefined}
          >
            Discover
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cijfers")}
            disabled={!gscConnected}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              viewMode === "cijfers"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title={!gscConnected ? "Verbind Search Console om cijfers te zien" : undefined}
          >
            Cijfers
          </button>
          <button
            type="button"
            onClick={() => setViewMode("realtime")}
            disabled={!gscConnected}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              viewMode === "realtime"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title={!gscConnected ? "Verbind Search Console om Realtime te zien" : undefined}
          >
            Realtime
          </button>
        </div>

        {viewMode === "recent" && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Zoeken in titels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue placeholder="Bron" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle bronnen</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder="Periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle periodes</SelectItem>
              <SelectItem value="24h">Afgelopen 24 uur</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger size="sm" className="w-[160px]">
              <SelectValue placeholder="Sorteren op" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Datum (nieuwste eerst)</SelectItem>
              <SelectItem value="source">Bron (A–Z)</SelectItem>
              <SelectItem value="titleLength">Titellengte (kort eerst)</SelectItem>
              {gscConnected && (
                <SelectItem value="clicks">Discover clicks (hoog eerst)</SelectItem>
              )}
            </SelectContent>
          </Select>
          {(searchQuery || sourceFilter !== "all" || dateFilter !== "all") && (
            <span className="text-sm text-slate-500">
              {filteredArticles.length} van {articles.length} artikelen
            </span>
          )}
        </div>
        )}

        {viewMode === "discover" && gscConnected && (
          <p className="mb-4 text-sm text-slate-500">
            Best presterende Discover-artikelen van de afgelopen 7 dagen, gesorteerd op clicks.
          </p>
        )}

        {viewMode === "cijfers" && gscConnected && (
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              Cijfers van de afgelopen 7 dagen met vergelijking met de 7 dagen daarvoor. Gecached voor 24 uur.
            </p>
            <Button
              onClick={() => fetchCijfersData(true)}
              variant="outline"
              size="sm"
              disabled={refreshing}
              title="Vernieuw cijfers (haalt verse data op)"
            >
              {refreshing ? (
                <span className="size-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span className="ml-1.5">Vernieuwen</span>
            </Button>
          </div>
        )}

        {viewMode === "realtime" && gscConnected && (
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              Actieve bezoekers in de afgelopen 30 minuten per merk.
            </p>
            <Button
              onClick={() => fetchRealtimeData()}
              variant="outline"
              size="sm"
              disabled={realtimeLoading}
              title="Haal nieuwere data op"
            >
              {realtimeLoading ? (
                <span className="size-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span className="ml-1.5">Vernieuwen</span>
            </Button>
          </div>
        )}

        {viewMode === "realtime" && gscConnected ? (
          realtimeData ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {SOURCES.map((source) => {
                const row = realtimeData.data.find((r) => r.source === source);
                const count = row?.activeUsers ?? 0;
                const pages = (realtimeData.topPages ?? []).filter(
                  (p) => p.source === source
                );
                return (
                  <div
                    key={source}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-col items-center">
                      {getFaviconUrl(source, sourceToFavicon[source]) && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={getFaviconUrl(source, sourceToFavicon[source])}
                          alt=""
                          className="mb-3 size-10 shrink-0 rounded-lg"
                        />
                      )}
                      <span className="text-center font-medium text-slate-900">
                        {source}
                      </span>
                      <span className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
                        {count.toLocaleString("nl-NL")}
                      </span>
                      <span className="mt-0.5 text-xs text-slate-500">
                        actief (30 min)
                      </span>
                    </div>
                    {pages.length > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <div className="text-xs font-medium text-slate-500" title="GA4 Realtime toont paginatitels, geen URL's">
                          Top 3 (weergaven)
                        </div>
                        <ul className="mt-2 space-y-1.5">
                          {pages.map((p, i) => (
                            <li
                              key={`${source}-${i}-${p.pageTitle}`}
                              className="flex items-start justify-between gap-2 text-xs"
                            >
                              <span
                                className="min-w-0 flex-1 truncate text-slate-700"
                                title={p.pageTitle}
                              >
                                {p.pageTitle}
                              </span>
                              <span className="shrink-0 tabular-nums font-medium text-slate-900">
                                {p.screenPageViews}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : realtimeLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                <p className="text-sm text-slate-500">Realtime data laden...</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-16">
              <p className="text-sm text-slate-500">Kon geen data ophalen.</p>
              <Button onClick={() => fetchRealtimeData()} variant="outline" size="sm">
                <RefreshCw className="size-4" />
                <span className="ml-1.5">Opnieuw proberen</span>
              </Button>
            </div>
          )
        ) : viewMode === "cijfers" && gscConnected ? (
          cijfersData ? (
            <div className="space-y-8">
              {cijfersData.sources.map((sourceData) => {
                const { source, metrics } = sourceData;
                return (
                  <div
                    key={source}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-200 px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          SOURCE_COLORS[source] ??
                          "bg-slate-100 text-slate-800 border-slate-200"
                        }
                      >
                        {getFaviconUrl(source, sourceToFavicon[source]) && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={getFaviconUrl(source, sourceToFavicon[source])}
                            alt=""
                            className="size-4 shrink-0 rounded-sm"
                          />
                        )}
                        {source}
                      </Badge>
                      <span className="ml-2 text-sm text-slate-500">
                        {cijfersData.periods.current.startDate} – {cijfersData.periods.current.endDate}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
                      {CIJFERS_METRICS.map(({ key, label }) => {
                        const m = metrics[key];
                        if (!m) return null;
                        const hasChange = m.change !== 0;
                        const isPositive = m.change > 0;
                        return (
                          <div
                            key={key}
                            className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
                          >
                            <div className="text-xs font-medium text-slate-500">
                              {label}
                            </div>
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="text-xl font-semibold tabular-nums text-slate-900">
                                {m.current}
                              </span>
                              {hasChange && m.changePercent !== null && (
                                <span
                                  className={`text-sm tabular-nums ${
                                    isPositive
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {isPositive ? "+" : ""}
                                  {m.changePercent}%
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              vorige periode: {m.previous}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16">
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                <p className="text-sm text-slate-500">Cijfers laden...</p>
              </div>
            </div>
          )
        ) : viewMode === "discover" && gscConnected ? (
          <div className="space-y-8">
            {SOURCES.map((source) => {
              const rows = discoverBySource[source] ?? [];
              const visibleCount = discoverExpanded[source] ?? 5;
              const visibleRows = rows.slice(0, visibleCount);
              const hasMore = rows.length > visibleCount;

              return (
                <div
                  key={source}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        SOURCE_COLORS[source] ??
                        "bg-slate-100 text-slate-800 border-slate-200"
                      }
                    >
                      {getFaviconUrl(source, sourceToFavicon[source]) && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={getFaviconUrl(source, sourceToFavicon[source])}
                          alt=""
                          className="size-4 shrink-0 rounded-sm"
                        />
                      )}
                      {source}
                    </Badge>
                    <span className="ml-2 text-sm text-slate-500">
                      ({rows.length} artikel{rows.length !== 1 ? "en" : ""})
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-200 hover:bg-transparent">
                        <TableHead className="text-slate-600">SEO Titel</TableHead>
                        <TableHead className="w-[80px] text-right text-slate-600">
                          Clicks
                        </TableHead>
                        <TableHead className="w-[80px] text-right text-slate-600">
                          CTR
                        </TableHead>
                        <TableHead className="w-[100px] text-right text-slate-600" title="Nieuwsbriefinschrijvingen (28 dagen)">
                          Nieuwsbrief
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-8 text-center text-slate-500"
                          >
                            Geen Discover-verkeer
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibleRows.map((row, idx) => {
                          const isTop5 = idx < 5;
                          const title = isTop5
                            ? urlToArticle[normalizeUrl(row.url)]?.title ??
                              discoverTitles[row.url] ??
                              getUrlDisplayText(row.url)
                            : getUrlDisplayText(row.url);
                          return (
                            <TableRow
                              key={`${row.url}-${idx}`}
                              className="border-slate-100"
                            >
                              <TableCell className="max-w-md py-3">
                                <a
                                  href={row.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:text-slate-600 hover:underline"
                                >
                                  {getFaviconUrl(row.source, sourceToFavicon[row.source]) && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                      src={getFaviconUrl(row.source, sourceToFavicon[row.source])}
                                      alt=""
                                      className="size-4 shrink-0 rounded-sm"
                                    />
                                  )}
                                  <span className="line-clamp-2">{title}</span>
                                  <ExternalLink className="size-3.5 shrink-0 opacity-60" />
                                </a>
                              </TableCell>
                              <TableCell className="py-3 text-right text-sm tabular-nums text-slate-600">
                                {row.clicks}
                              </TableCell>
                              <TableCell
                                className={`py-3 text-right text-sm tabular-nums ${
                                  row.impressions > 0
                                    ? (row.clicks / row.impressions) * 100 >= 10
                                      ? "bg-green-100 text-green-800"
                                      : (row.clicks / row.impressions) * 100 <= 4
                                        ? "bg-red-100 text-red-800"
                                        : "text-slate-600"
                                    : "text-slate-500"
                                }`}
                              >
                                {row.impressions > 0
                                  ? `${((row.clicks / row.impressions) * 100).toFixed(1)}%`
                                  : "–"}
                              </TableCell>
                              <TableCell className="py-3 text-right text-sm tabular-nums text-slate-600">
                                {ga4NewsletterByUrl[normalizeUrl(row.url)] ?? "–"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                  {hasMore && (
                    <div className="border-t border-slate-200 px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDiscoverExpanded((prev) => ({
                            ...prev,
                            [source]: (prev[source] ?? 5) + 10,
                          }))
                        }
                        className="w-full"
                      >
                        <ChevronDown className="size-4" />
                        Meer tonen ({rows.length - visibleCount} over)
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              <p className="text-sm text-slate-500">Artikelen laden...</p>
            </div>
          )}
          {!loading && (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="border-slate-200 hover:bg-transparent">
                <TableHead className="w-[140px] text-slate-600">
                  Bron
                </TableHead>
                <TableHead className="w-[40%] text-slate-600">SEO Titel</TableHead>
                <TableHead className="w-[140px] text-slate-600">
                  Datum & Tijd
                </TableHead>
                {gscConnected && (
                  <>
                    <TableHead className="w-[80px] text-right text-slate-600">
                      Clicks
                    </TableHead>
                    <TableHead className="w-[80px] text-right text-slate-600">
                      CTR
                    </TableHead>
                  </>
                )}
                <TableHead className="w-[80px] text-center text-slate-600">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayArticles.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={gscConnected ? 6 : 4}
                    className="py-12 text-center text-slate-500"
                  >
                    {articles.length === 0
                      ? "Geen artikelen gevonden. Controleer de sitemap-URL's."
                      : "Geen resultaten voor deze filters."}
                  </TableCell>
                </TableRow>
              ) : (
                (displayArticles as NewsArticle[]).map((article, idx) => (
                  <TableRow
                    key={`${article.url}-${idx}`}
                    className="border-slate-100"
                  >
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={
                          SOURCE_COLORS[article.source] ??
                          "bg-slate-100 text-slate-800 border-slate-200"
                        }
                      >
                        {article.faviconUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={article.faviconUrl}
                            alt=""
                            className="size-4 shrink-0 rounded-sm"
                          />
                        )}
                        {article.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="overflow-hidden whitespace-normal py-3 align-top">
                      <div className="flex min-w-0 flex-col gap-2">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`
                            flex items-start gap-1.5 font-medium text-slate-900 hover:text-slate-600 hover:underline
                            ${article.title.length > 60 ? "text-orange-600" : ""}
                          `}
                        >
                          <span className="min-w-0 break-words">{article.title}</span>
                          <ExternalLink className="mt-0.5 size-3.5 shrink-0 opacity-60" />
                        </a>
                        {showImages && article.imageUrl && (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-fit overflow-hidden rounded-lg border border-slate-200"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={article.imageUrl}
                              alt=""
                              className="aspect-video w-64 object-cover"
                            />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-500">
                      {getRelativeTime(article.publicationDate)}
                    </TableCell>
                    {gscConnected && (
                      <>
                        <TableCell className="py-3 text-right text-sm tabular-nums text-slate-600">
                          {article.discoverClicks ?? 0}
                        </TableCell>
                        <TableCell
                          className={`py-3 text-right text-sm tabular-nums ${
                            (() => {
                              const imp = article.discoverImpressions ?? 0;
                              const clk = article.discoverClicks ?? 0;
                              if (imp === 0) return "text-slate-500";
                              const ctr = (clk / imp) * 100;
                              if (ctr >= 10) return "bg-green-100 text-green-800";
                              if (ctr <= 4) return "bg-red-100 text-red-800";
                              return "text-slate-600";
                            })()
                          }`}
                        >
                          {(article.discoverImpressions ?? 0) > 0
                            ? `${(
                                ((article.discoverClicks ?? 0) /
                                  (article.discoverImpressions ?? 1)) *
                                100
                              ).toFixed(1)}%`
                            : "–"}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="py-3 text-center">
                      {isWithin24Hours(article.publicationDate) ? (
                        <span
                          className="inline-block size-2.5 rounded-full bg-green-500"
                          title="Minder dan 24 uur oud"
                        />
                      ) : (
                        <span
                          className="inline-block size-2.5 rounded-full bg-slate-300"
                          title="Ouder dan 24 uur"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
