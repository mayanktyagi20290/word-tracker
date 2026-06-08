// Vercel serverless function — fetches a URL server-side (no browser CORS limits)
// and returns CLEAN, analyzable body text. Deployed automatically at /api/fetch-url
// Upload this file inside an "api" folder at the repo root.

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const url = (req.query && req.query.url) || "";
  if (!url) { res.status(400).json({ error: "Missing url parameter" }); return; }

  let target;
  try {
    target = new URL(url);
    if (!/^https?:$/.test(target.protocol)) throw new Error("bad protocol");
  } catch {
    res.status(400).json({ error: "Invalid URL" }); return;
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
  // strip site chrome (menus, footers, sidebars, forms)
  s = s.replace(/<(nav|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");
  // focus on the real content region if the page exposes one
  const main = pickMainRegion(s);
  if (main) s = main;

  // headings → markdown (real content words; keeps Structure tab H1/H2 working)
  s = s.replace(/<h1\b[^>]*>/gi, "\n# ").replace(/<h2\b[^>]*>/gi, "\n## ")
       .replace(/<h3\b[^>]*>/gi, "\n### ").replace(/<h[4-6]\b[^>]*>/gi, "\n#### ");
  // links → keep ONLY the anchor text, drop the URL (URLs pollute keyword analysis)
  s = s.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (m, txt) => " " + txt.replace(/<[^>]+>/g, " ") + " ");
  // images → drop entirely (icon/CDN URLs are pure noise)
  s = s.replace(/<img\b[^>]*>/gi, " ");

  s = s.replace(/<li\b[^>]*>/gi, "\n- ");
  s = s.replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote|ul|ol)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  s = dedupeLines(s);
  return { title, text: s };
}
