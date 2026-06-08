import { useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { G, font } from "./SEOTools.jsx";
import { useContent } from "./content.jsx";
import { TOOLS_BY_SLUG, BRAND } from "./tools.config.jsx";

// ── HTML → readable text (used as fallback when the /api endpoint is unavailable) ──
function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'").replace(/&apos;/g, "'")
    .replace(/&hellip;/g, "…").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(parseInt(n, 10)));
}
function pickMainRegion(s) {
  const cands = []; let m;
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
function clientExtract(html, url) {
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
  return { title, text: s, url };
}

const GROUPS = [
  { title: "Content analysis", slugs: ["word-frequency-counter", "long-tail-keyword-finder", "wh-questions-generator"] },
  { title: "Optimization", slugs: ["nlp-entity-extractor", "content-optimization-checker", "seo-readability-highlighter", "search-intent-checker"] },
  { title: "Advanced", slugs: ["competitor-keyword-gap-analysis", "seo-structure-checker"] },
  { title: "Export", slugs: ["export-seo-report"] },
];

export default function Layout() {
  const { text, setText, filterStop, setFilterStop, targetKeyword, setTargetKeyword } = useContent();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [inputMode, setInputMode] = useState("paste"); // "paste" | "url"
  const [urlInput, setUrlInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [fetchedFrom, setFetchedFrom] = useState("");
  const soloEditor = pathname.replace(/\/+$/, "") === "/seo-readability-highlighter";
  const wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = text.length;
  const charNoSpaces = text.replace(/\s/g, "").length;
  const closeDrawer = () => setDrawer(false);

  const fetchFromUrl = async () => {
    let u = urlInput.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    setFetching(true); setFetchError(""); setFetchedFrom("");
    try {
      let data = null;
      // 1) our own serverless endpoint (clean, no CORS limits)
      try {
        const r = await fetch(`/api/fetch-url?url=${encodeURIComponent(u)}`, { headers: { Accept: "application/json" } });
        if (r.ok && (r.headers.get("content-type") || "").includes("application/json")) {
          const j = await r.json();
          if (j && j.text) data = j;
        }
      } catch (_) { /* fall through to proxy */ }
      // 2) fallback: public CORS proxy + in-browser extraction
      if (!data) {
        const pr = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`);
        if (!pr.ok) throw new Error(`Fetch failed (status ${pr.status}). Site may block bots — paste content manually.`);
        const html = await pr.text();
        data = clientExtract(html, u);
      }
      if (!data.text || data.text.trim().length < 20) {
        throw new Error("Page mil gaya par readable text nahi mila. Content manually paste karke try karein.");
      }
      setText(data.text);
      setFetchedFrom(data.title ? `${data.title} — ${u}` : u);
    } catch (e) {
      setFetchError(e.message || "Fetch fail ho gaya. Site bots block kar rahi ho sakti hai — content manually paste karein.");
    } finally {
      setFetching(false);
    }
  };

  return (
    <div style={{ fontFamily: font, background: G.bg, minHeight: "100vh", display: "flex", flexDirection: "column", color: G.text }}>
      <style>{`
        .wt-header { height: 64px; }
        .wt-hamburger { display: none; background: none; border: none; cursor: pointer; padding: 8px; border-radius: 10px; color: ${G.text}; }
        .wt-hamburger:hover { background: ${G.hover}; }
        .wt-sidebar { width: 280px; background: ${G.surface}; border-right: 1px solid ${G.border}; flex-shrink: 0; overflow-y: auto; padding: 16px 0; }
        .wt-overlay { display: none; }
        .wt-navlink { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 8px 14px; margin: 1px 12px; border-radius: 12px; text-decoration: none; font-size: 14px; transition: background .15s; }

        .wt-split { display: grid; grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.1fr); gap: 24px; align-items: start; }
        .wt-inputcol { position: sticky; top: 0; align-self: start; }
        .wt-textarea { width: 100%; height: calc(100vh - 250px); min-height: 320px; box-sizing: border-box; border: 1px solid ${G.border}; border-radius: 16px; padding: 18px 20px; font-family: ${font}; font-size: 15px; color: ${G.text}; line-height: 1.7; resize: none; outline: none; background: ${G.surface}; box-shadow: ${G.shadowSm}; transition: box-shadow .15s, border-color .15s; }
        .wt-textarea:focus { border-color: ${G.blue}; box-shadow: 0 0 0 3px ${G.blueLight}; }
        .wt-main { padding: 20px 28px 56px; }

        @media (max-width: 1000px) {
          .wt-split { grid-template-columns: 1fr; }
          .wt-inputcol { position: static; }
          .wt-textarea { height: 250px; min-height: 250px; }
        }
        @media (max-width: 768px) {
          .wt-header { height: 56px; }
          .wt-tagline { display: none !important; }
          .wt-hamburger { display: inline-flex; }
          .wt-main { padding: 14px 16px 48px; }
          .wt-sidebar { position: fixed; top: 0; left: 0; height: 100vh; transform: translateX(-100%); transition: transform .22s ease; z-index: 60; box-shadow: 0 12px 32px rgba(0,0,0,.18); }
          .wt-sidebar.open { transform: translateX(0); }
          .wt-overlay.show { display: block; position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 55; }
        }
      `}</style>

      {/* Header */}
      <header className="wt-header" style={{ background: "rgba(255,255,255,.85)", backdropFilter: "saturate(180%) blur(8px)", WebkitBackdropFilter: "saturate(180%) blur(8px)", borderBottom: `1px solid ${G.border}`, padding: "0 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, position: "sticky", top: 0, zIndex: 70 }}>
        <button className="wt-hamburger" aria-label="Open menu" onClick={() => setDrawer(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
        <Link to="/" onClick={closeDrawer} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <svg width="26" height="26" viewBox="0 0 28 28" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="5.5" fill="#4F46E5" /><circle cx="21" cy="7" r="5.5" fill="#7C3AED" />
            <circle cx="7" cy="21" r="5.5" fill="#10B981" /><circle cx="21" cy="21" r="5.5" fill="#F59E0B" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, color: G.text, letterSpacing: -0.3 }}>{BRAND}</span>
        </Link>
        <span className="wt-tagline" style={{ fontSize: 13, color: G.textSec, flex: 1 }}>Analyze keywords, intent, entities & content gaps</span>
        <span style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: G.textSec, cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={filterStop} onChange={(e) => setFilterStop(e.target.checked)} style={{ accentColor: G.blue, width: 16, height: 16 }} />
          <span className="wt-tagline">Filter stop words</span>
        </label>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Mobile overlay */}
        <div className={`wt-overlay ${drawer ? "show" : ""}`} onClick={closeDrawer} />

        {/* Sidebar (grouped) */}
        <nav className={`wt-sidebar ${drawer ? "open" : ""}`}>
          {GROUPS.map((grp) => (
            <div key={grp.title} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: G.textHint, padding: "0 26px 6px" }}>{grp.title}</div>
              {grp.slugs.map((slug) => {
                const t = TOOLS_BY_SLUG[slug];
                if (!t) return null;
                return (
                  <NavLink key={slug} to={`/${slug}`} onClick={closeDrawer} className="wt-navlink"
                    style={({ isActive }) => ({
                      background: isActive ? G.blueLight : "transparent",
                      color: isActive ? G.blue : G.textSec,
                      fontWeight: isActive ? 600 : 500,
                    })}>
                    <span style={{ fontSize: 17, lineHeight: 1, width: 20, textAlign: "center" }}>{t.icon}</span>
                    <span>{t.nav}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Main */}
        <main className="wt-main" style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
          {soloEditor ? (
            <Outlet />
          ) : (
            <div className="wt-split">
              <div className="wt-inputcol">
                {/* input mode toggle */}
                <div style={{ display: "flex", gap: 4, background: G.bg, borderRadius: 999, padding: 3, border: `1px solid ${G.border}`, marginBottom: 10, width: "fit-content" }}>
                  {[{ id: "paste", label: "📝 Paste" }, { id: "url", label: "🔗 From URL" }].map((m) => {
                    const on = inputMode === m.id;
                    return (
                      <button key={m.id} onClick={() => { setInputMode(m.id); setFetchError(""); }}
                        style={{ padding: "6px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: font, fontSize: 12.5, fontWeight: 500, background: on ? G.blue : "transparent", color: on ? "#fff" : G.textSec, transition: "all .15s" }}>
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                {inputMode === "url" && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="url" value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !fetching) fetchFromUrl(); }}
                        placeholder="https://example.com/page-to-analyze"
                        style={{ flex: 1, minWidth: 0, boxSizing: "border-box", border: `1px solid ${G.border}`, borderRadius: 12, padding: "11px 14px", fontFamily: font, fontSize: 14, color: G.text, outline: "none", background: G.surface }} />
                      <button onClick={fetchFromUrl} disabled={fetching || !urlInput.trim()}
                        style={{ borderRadius: 12, border: "none", padding: "0 18px", whiteSpace: "nowrap", cursor: fetching || !urlInput.trim() ? "default" : "pointer", background: fetching || !urlInput.trim() ? G.border : G.blue, color: fetching || !urlInput.trim() ? G.textHint : "#fff", fontFamily: font, fontSize: 13.5, fontWeight: 600 }}>
                        {fetching ? "⏳ Fetching…" : "Fetch"}
                      </button>
                    </div>
                    {fetchError && <div style={{ marginTop: 8, fontSize: 12, color: G.red, background: G.redLight, borderRadius: 10, padding: "8px 12px", lineHeight: 1.5 }}>⚠️ {fetchError}</div>}
                    {!fetchError && fetchedFrom && <div style={{ marginTop: 8, fontSize: 12, color: G.green, background: G.greenLight, borderRadius: 10, padding: "8px 12px", lineHeight: 1.5, wordBreak: "break-word" }}>✅ Loaded: {fetchedFrom}</div>}
                  </div>
                )}

                <input value={targetKeyword} onChange={(e) => setTargetKeyword(e.target.value)} placeholder="🎯 Target keyword (optional)"
                  style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${G.border}`, borderRadius: 12, padding: "11px 14px", fontFamily: font, fontSize: 14, color: G.text, outline: "none", marginBottom: 10, background: G.surface }} />
                <textarea className="wt-textarea" value={text} onChange={(e) => setText(e.target.value)}
                  placeholder={inputMode === "url" ? "Fetched content yahan aayega — ya seedhe paste bhi kar sakte hain..." : "Paste your content here and discover ranking opportunities..."} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: G.textSec, marginTop: 8 }}>
                  <span><b style={{ color: G.blue }}>{wordCount.toLocaleString()}</b> words</span>
                  <span style={{ color: G.border }}>·</span>
                  <span><b style={{ color: G.green }}>{charCount.toLocaleString()}</b> characters</span>
                  <span style={{ color: G.border }}>·</span>
                  <span><b style={{ color: G.purple }}>{charNoSpaces.toLocaleString()}</b> no spaces</span>
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <Outlet />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
