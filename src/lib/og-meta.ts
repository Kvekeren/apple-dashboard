import { formatDiscoverArticleDate } from "@/lib/discover-snoop";

/** Meta-tags uit HTML — zelfde patronen als `/api/fetch-news`. */

function decodeHtmlEntities(str: string): string {
  if (typeof str !== "string" || !str.includes("&")) return str;
  try {
    return str
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCodePoint(parseInt(hex, 16))
      )
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  } catch {
    return str;
  }
}

function extractMetaTag(
  html: string,
  attr: "property" | "name",
  key: string
): string | null {
  const re = new RegExp(
    `<meta\\s+[^>]*${attr}=["']${key}["'][^>]*content=(["'])([\\s\\S]*?)\\1`,
    "i"
  );
  const m = html.match(re);
  if (m?.[2]) return decodeHtmlEntities(m[2].trim());

  const reRev = new RegExp(
    `<meta\\s+[^>]*content=(["'])([\\s\\S]*?)\\1[^>]*${attr}=["']${key}["']`,
    "i"
  );
  const m2 = html.match(reRev);
  if (m2?.[2]) return decodeHtmlEntities(m2[2].trim());

  return null;
}

export function extractOgImage(html: string): string | null {
  return (
    extractMetaTag(html, "property", "og:image") ??
    extractMetaTag(html, "name", "twitter:image")
  );
}

/** JSON-LD `datePublished` of meta article:published_time → `22 mei 2025`. */
export function extractDatePublished(html: string): string | null {
  const jsonLd =
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i) ??
    html.match(/'datePublished'\s*:\s*'([^']+)'/i);
  if (jsonLd?.[1]) return formatPublishedDateLabel(jsonLd[1]);

  const fromMeta =
    extractMetaTag(html, "property", "article:published_time") ??
    extractMetaTag(html, "property", "og:published_time") ??
    extractMetaTag(html, "name", "pubdate");
  if (fromMeta) return formatPublishedDateLabel(fromMeta);

  return null;
}

export function formatPublishedDateLabel(isoOrDate: string): string {
  const raw = isoOrDate.trim();
  const datePart = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0] ?? raw.slice(0, 10);
  return formatDiscoverArticleDate(datePart) || "";
}

export function extractOgTitle(html: string): string | null {
  const fromOg =
    extractMetaTag(html, "property", "og:title") ??
    extractMetaTag(html, "name", "twitter:title");
  if (fromOg) return fromOg;

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return decodeHtmlEntities(titleMatch[1].trim());

  return null;
}

export async function fetchPageOgMeta(
  url: string
): Promise<{ title: string | null; imageUrl: string | null; dateLabel: string | null }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SEO-News-Monitor/1.0; +https://github.com)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { title: null, imageUrl: null, dateLabel: null };
    const html = await res.text();
    const rawImg = extractOgImage(html);
    let imageUrl = rawImg;
    if (rawImg) {
      try {
        imageUrl = new URL(rawImg, url).href;
      } catch {
        imageUrl = rawImg;
      }
    }
    return {
      title: extractOgTitle(html),
      imageUrl,
      dateLabel: extractDatePublished(html),
    };
  } catch {
    return { title: null, imageUrl: null, dateLabel: null };
  }
}
