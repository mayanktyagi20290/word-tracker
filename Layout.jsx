import { useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { G, font } from "./SEOTools.jsx";
import { useContent } from "./content.jsx";
import { TOOLS_BY_SLUG, BRAND } from "./tools.config.jsx";

const GROUPS = [
  { title: "Content analysis", slugs: ["word-frequency-counter", "long-tail-keyword-finder", "wh-questions-generator"] },
  { title: "Optimization", slugs: ["nlp-entity-extractor", "content-optimization-checker", "seo-readability-highlighter", "search-intent-checker"] },
  { title: "Advanced", slugs: ["competitor-keyword-gap-analysis", "seo-structure-checker"] },
  { title: "Export", slugs: ["export-seo-report"] },
];

export default function Layout() {
  const { text, setText, filterStop, setFilterStop } = useContent();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const soloEditor = pathname.replace(/\/+$/, "") === "/seo-readability-highlighter";
  const wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const closeDrawer = () => setDrawer(false);

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
        .wt-textarea { width: 100%; height: calc(100vh - 180px); min-height: 400px; box-sizing: border-box; border: 1px solid ${G.border}; border-radius: 16px; padding: 18px 20px; font-family: ${font}; font-size: 15px; color: ${G.text}; line-height: 1.7; resize: none; outline: none; background: ${G.surface}; box-shadow: ${G.shadowSm}; transition: box-shadow .15s, border-color .15s; }
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
                <textarea className="wt-textarea" value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your content here and discover ranking opportunities..." />
                <div style={{ fontSize: 12, color: G.textHint, marginTop: 8 }}>
                  {wordCount.toLocaleString()} words · {text.length.toLocaleString()} chars
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
