import { XMLParser } from "fast-xml-parser";
import { NextResponse } from "next/server";

const NEWS_SOURCES = [
  {
    name: "iCreate",
    url: "https://www.icreatemagazine.nl/news-sitemap.xml",
  },
  {
    name: "Gardeners' World",
    url: "https://www.gardenersworldmagazine.nl/news-sitemap.xml",
  },
  {
    name: "Historisch Nieuwsblad",
    url: "https://www.historischnieuwsblad.nl/news-sitemap.xml",
  },
  {
    name: "Auto Review",
    url: "https://www.autoreview.nl/google-news-sitemap.xml",
  },
] as const;

export interface NewsArticle {
  source: string;
  title: string;
  url: string;
  publicationDate: string;
  imageUrl?: string;
  faviconUrl?: string;
}

function extractFavicon(html: string, baseUrl: string): string | null {
  const patterns = [
    /<link[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut\s+)?icon["']/i,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) {
      const href = match[1].trim();
      try {
        return new URL(href, baseUrl).href;
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function fetchFavicon(siteUrl: string): Promise<string | null> {
  try {
    const baseUrl = siteUrl.replace(/\/[^/]*$/, "/");
    const res = await fetch(baseUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SEO-News-Monitor/1.0; +https://github.com)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractFavicon(html, baseUrl);
  } catch {
    return null;
  }
}

function extractOgImage(html: string): string | null {
  const match =
    html.match(
      /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
    );
  return match ? match[1].trim() : null;
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SEO-News-Monitor/1.0; +https://github.com)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return extractOgImage(html);
  } catch {
    return null;
  }
}

function decodeHtmlEntities(str: string): string {
  if (typeof str !== "string" || !str.includes("&")) return str;
  try {
    return str
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCodePoint(parseInt(hex, 16))
      )
      .replace(/&#(\d+);/g, (_, dec) =>
        String.fromCodePoint(parseInt(dec, 10))
      )
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  } catch {
    return str;
  }
}

function extractNewsFromXml(xml: string, sourceName: string): NewsArticle[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const result = parser.parse(xml);
  const articles: NewsArticle[] = [];

  try {
    const urlset = result?.urlset ?? result?.["sitemap-index"] ?? result;
    let urls = urlset?.url;

    if (!urls) return articles;
    if (!Array.isArray(urls)) urls = [urls];

    for (const urlEntry of urls) {
      const loc = urlEntry?.loc;
      if (!loc || typeof loc !== "string") continue;

      const newsData =
        urlEntry["news:news"] ?? urlEntry.news?.news ?? urlEntry.news;
      if (!newsData) continue;

      const title =
        newsData["news:title"] ??
        newsData.title ??
        newsData["news:news"]?.["news:title"] ??
        "";
      const publicationDate =
        newsData["news:publication_date"] ??
        newsData["news:publicationDate"] ??
        newsData.publication_date ??
        newsData.publicationDate ??
        "";

      const titleStr = decodeHtmlEntities(
        typeof title === "string" ? title : String(title ?? "")
      );
      if (titleStr.trim()) {
        articles.push({
          source: sourceName,
          title: titleStr,
          url: loc,
          publicationDate:
            typeof publicationDate === "string"
              ? publicationDate
              : String(publicationDate || ""),
        });
      }
    }
  } catch {
    // Silently skip malformed XML
  }

  return articles;
}

export async function GET() {
  try {
    const fetchPromises = NEWS_SOURCES.map(async (source) => {
      const response = await fetch(source.url, {
        headers: {
          "User-Agent": "SEO-News-Monitor/1.0",
        },
        next: { revalidate: 60 },
      });

      if (!response.ok) {
        return [];
      }

      const xml = await response.text();
      return extractNewsFromXml(xml, source.name);
    });

    const results = await Promise.all(fetchPromises);
    const allArticles: NewsArticle[] = results.flat();

    allArticles.sort((a, b) => {
      const dateA = new Date(a.publicationDate).getTime();
      const dateB = new Date(b.publicationDate).getTime();
      return dateB - dateA;
    });

    // Haal favicons op per bron (parallel)
    const faviconPromises = NEWS_SOURCES.map(async (source) => {
      const baseUrl = source.url.replace(/\/[^/]*$/, "/");
      const favicon = await fetchFavicon(baseUrl);
      return { name: source.name, favicon };
    });
    const favicons = await Promise.all(faviconPromises);
    const faviconMap = Object.fromEntries(
      favicons
        .filter((f) => f.favicon)
        .map((f) => [f.name, f.favicon as string])
    );

    // Haal og:image op per artikel (max 10 parallel om servers niet te overbelasten)
    const CONCURRENCY = 10;
    for (let i = 0; i < allArticles.length; i += CONCURRENCY) {
      const batch = allArticles.slice(i, i + CONCURRENCY);
      const images = await Promise.all(
        batch.map((a) => fetchOgImage(a.url))
      );
      batch.forEach((a, j) => {
        if (images[j]) a.imageUrl = images[j] ?? undefined;
        a.faviconUrl = faviconMap[a.source];
      });
    }

    return NextResponse.json(allArticles);
  } catch (error) {
    console.error("Error fetching news:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}
