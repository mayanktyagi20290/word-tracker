// Vercel serverless function — fetches a URL server-side (no browser CORS limits)
// and returns clean, analyzable text. Deployed automatically at /api/fetch-url
// Just upload this file inside an "api" folder at the repo root.

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
    if (!upstream.ok) {
      res.status(502).json({ error: `Upstream returned ${upstream.status}` }); return;
    }
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

function extractText(html) {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const tm = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = tm ? decodeEntities(tm[1]).trim() : "";

  // Preserve SEO structure as markdown so the Structure tab still works on fetched pages
  s = s.replace(/<img\b[^>]*>/gi, (m) => {
    const alt = (m.match(/alt=["']([^"']*)["']/i) || [, ""])[1];
    const src = (m.match(/src=["']([^"']+)["']/i) || [, ""])[1];
    return ` ![${alt}](${src}) `;
  });
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, txt) => {
    const t = txt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return ` [${t || href}](${href}) `;
  });
  s = s.replace(/<h1\b[^>]*>/gi, "\n# ").replace(/<h2\b[^>]*>/gi, "\n## ")
       .replace(/<h3\b[^>]*>/gi, "\n### ").replace(/<h[4-6]\b[^>]*>/gi, "\n#### ");
  s = s.replace(/<li\b[^>]*>/gi, "\n- ");
  s = s.replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote|ul|ol)>/gi, "\n")
       .replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { title, text: s };
}
