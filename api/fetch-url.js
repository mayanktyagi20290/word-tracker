// Vercel serverless function — fetches a URL server-side (no browser CORS limits).
// Deployed automatically at /api/fetch-url. Upload this file inside an "api" folder at the repo root.
//
// Default behavior (unchanged): ?url=... returns { title, text, url } — clean extracted
// page text, used by the SEO content analyzer and as a CORS-proxy fallback by other tools.
//
// New: ?url=...&mode=chain returns { chain, finalUrl, finalStatus, ok, warnings } —
// walks every redirect hop manually (server-side, so no browser CORS/opaque-response limits)
// and reports the status code and Location header at each step. Used by the Redirect Chain Checker.

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const url = (req.query && req.query.url) || "";
  const mode = (req.query && req.query.mode) || "";
  if (!url) { res.status(400).json({ error: "Missing url parameter" }); return; }

  let target;
  try {
    target = new URL(url);
    if (!/^https?:$/.test(target.protocol)) throw new Error("bad protocol");
  } catch {
    res.status(400).json({ error: "Invalid URL" }); return;
  }

  if (mode === "chain") {
    try {
      const result = await followRedirectChain(target.href, nodeFetchAdapter, 15);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
      res.status(200).json(result);
    } catch (e) {
      res.status(500).json({ error: "Redirect chain check failed: " + ((e && e.message) || "unknown") });
    }
    return;
  }

  try {
    const upstream = await fetch(target.href, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SEOTriggersBot/1.0; +https://seotriggers.com)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!upstream.ok) { res.status(502).json({ error: `Upstream returned ${upstream.status}` }); return; }
    const html = await upstream.text();
    const { title, text } = extractText(html);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=86400");
    res.status(200).json({ title, text, url: target.href });
  } catch (e) {
    res.status(500).json({ error: "Fetch failed: " + ((e && e.message) || "unknown") });
  }
};

// ============ Redirect chain walking (server-side, so headers are fully visible) ============
async function nodeFetchAdapter(url, opts) {
  const upstream = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SEOTriggersBot/1.0; +https://seotriggers.com)",
    },
  });
  return {
    status: upstream.status,
    headers: { get: (name) => upstream.headers.get(name) },
    url,
  };
}

async function followRedirectChain(startUrl, fetchFn, maxHops) {
  maxHops = maxHops || 15;
  const chain = [];
  const visited = new Set();
  let currentUrl = startUrl;
  const warnings = [];

  for (let hop = 0; hop < maxHops; hop++) {
    if (visited.has(currentUrl)) {
      warnings.push("Redirect loop detected: " + currentUrl + " was visited twice.");
      chain.push({ step: hop + 1, url: currentUrl, status: null, statusText: "LOOP DETECTED", location: null });
      return { chain, finalUrl: currentUrl, finalStatus: null, warnings, ok: false };
    }
    visited.add(currentUrl);

    let r;
    try {
      r = await fetchFn(currentUrl, { redirect: "manual" });
    } catch (e) {
      warnings.push("Request failed at hop " + (hop + 1) + " (" + currentUrl + "): " + (e && e.message ? e.message : "unknown error"));
      chain.push({ step: hop + 1, url: currentUrl, status: null, statusText: "REQUEST FAILED", location: null });
      return { chain, finalUrl: currentUrl, finalStatus: null, warnings, ok: false };
    }

    const isRedirect = r.status >= 300 && r.status < 400;
    const location = isRedirect ? r.headers.get("location") : null;

    chain.push({ step: hop + 1, url: currentUrl, status: r.status, statusText: statusText(r.status), location });

    if (!isRedirect) {
      return { chain, finalUrl: currentUrl, finalStatus: r.status, warnings, ok: true };
    }
    if (!location) {
      warnings.push("Got a " + r.status + " redirect at " + currentUrl + " with no Location header.");
      return { chain, finalUrl: currentUrl, finalStatus: r.status, warnings, ok: false };
    }

    let nextUrl;
    try {
      nextUrl = new URL(location, currentUrl).href;
    } catch (e) {
      warnings.push("Invalid Location header at " + currentUrl + ": " + location);
      return { chain, finalUrl: currentUrl, finalStatus: r.status, warnings, ok: false };
    }

    const curProto = new URL(currentUrl).protocol;
    const nextProto = new URL(nextUrl).protocol;
    if (curProto === "https:" && nextProto === "http:") {
      warnings.push("Protocol downgrade: " + currentUrl + " (https) redirects to " + nextUrl + " (http).");
    }

    currentUrl = nextUrl;
  }

  warnings.push("Exceeded maximum of " + maxHops + " redirect hops without reaching a final destination.");
  return { chain, finalUrl: currentUrl, finalStatus: null, warnings, ok: false };
}

function statusText(code) {
  const map = { 301: "Moved Permanently", 302: "Found", 303: "See Other", 307: "Temporary Redirect", 308: "Permanent Redirect", 200: "OK", 404: "Not Found", 500: "Internal Server Error", 403: "Forbidden" };
  return map[code] || String(code);
}

// ============ Existing content-extraction helpers (unchanged) ============
function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'").replace(/&apos;/g, "'")
    .replace(/&hellip;/g, "…").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(parseInt(n, 10)));
}

function pickMainRegion(s) {
  const cands = [];
  let m;
  const re1 = /<main\b[^>]*>([\s\S]*?)<\/main>/gi;
  while ((m = re1.exec(s)) !== null) cands.push(m[1]);
  const re2 = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
  while ((m = re2.exec(s)) !== null) cands.push(m[1]);
  if (!cands.length) return null;
  const best = cands.sort((a, b) => b.length - a.length)[0];
  return best && best.replace(/<[^>]+>/g, "").trim().length > 200 ? best : null;
}

function dedupeLines(s) {
  const out = []; let prev = null;
  for (const line of s.split("\n")) {
    const key = line.trim().toLowerCase();
    if (key && key === prev) continue;
    out.push(line); prev = key;
  }
  return out.join("\n");
}

function extractText(html) {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ");

  const tm = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = tm ? decodeEntities(tm[1]).trim() : "";

  s = s.replace(/<head\b[\s\S]*?<\/head>/i, " ");
  s = s.replace(/<(nav|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");
  const main = pickMainRegion(s);
  if (main) s = main;

  s = s.replace(/<h1\b[^>]*>/gi, "\n# ").replace(/<h2\b[^>]*>/gi, "\n## ")
       .replace(/<h3\b[^>]*>/gi, "\n### ").replace(/<h[4-6]\b[^>]*>/gi, "\n#### ");
  s = s.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (m, txt) => " " + txt.replace(/<[^>]+>/g, " ") + " ");
  s = s.replace(/<img\b[^>]*>/gi, " ");

  s = s.replace(/<li\b[^>]*>/gi, "\n- ");
  s = s.replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote|ul|ol)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  s = dedupeLines(s);
  return { title, text: s };
}
