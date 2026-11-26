/** Canonical URL-sleutel voor matching tussen feed, GA4 en GSC. */
export function agendaUrlKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = (u.pathname.replace(/\/+$/, "") || "/").toLowerCase();
    return `${host}${path}`;
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
  }
}

/** Path-varianten voor GA4-pagePath filters (met/zonder trailing slash). */
export function agendaPagePathVariants(url: string): string[] {
  try {
    const path = new URL(url).pathname || "/";
    const noSlash = path.replace(/\/+$/, "") || "/";
    const withSlash = noSlash === "/" ? "/" : `${noSlash}/`;
    return [...new Set([path, noSlash, withSlash])];
  } catch {
    return [];
  }
}

export function agendaPathKey(path: string): string {
  let p = path.trim();
  if (!p) return "/";
  try {
    if (p.includes("://")) p = new URL(p).pathname;
  } catch {
    /* keep p */
  }
  if (!p.startsWith("/")) {
    const slash = p.indexOf("/");
    const maybeHost = slash >= 0 ? p.slice(0, slash) : p;
    if (maybeHost.includes(".")) p = slash >= 0 ? p.slice(slash) : "/";
    else p = `/${p}`;
  }
  return (p.replace(/\/+$/, "") || "/").toLowerCase();
}
