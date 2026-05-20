/** Meta-tags uit HTML — zelfde patronen als `/api/fetch-news`. */

export function extractOgImage(html: string): string | null {
  const match =
    html.match(
      /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
    );
  return match ? match[1].trim() : null;
}

export function extractOgTitle(html: string): string | null {
  const ogMatch =
    html.match(
      /<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i
    );
  if (ogMatch) return ogMatch[1].trim();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();

  return null;
}

export async function fetchPageOgMeta(
  url: string
): Promise<{ title: string | null; imageUrl: string | null }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SEO-News-Monitor/1.0; +https://github.com)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { title: null, imageUrl: null };
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
    };
  } catch {
    return { title: null, imageUrl: null };
  }
}
