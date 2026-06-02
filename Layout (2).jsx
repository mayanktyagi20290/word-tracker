import { NavLink, Outlet, Link } from "react-router-dom";
import { G, font } from "./SEOTools.jsx";
import { useContent } from "./content.jsx";
import { TOOLS, BRAND } from "./tools.config.jsx";

export default function Layout() {
  const { text, setText, filterStop, setFilterStop } = useContent();
  const wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div style={{ fontFamily: font, background: G.bg, minHeight: "100vh", display: "flex", flexDirection: "column", color: G.text }}>
      <style>{`
        .wt-split { display: grid; grid-template-columns: minmax(300px, 0.85fr) minmax(0, 1.15fr); gap: 20px; align-items: start; }
        .wt-inputcol { position: sticky; top: 0; align-self: start; }
        .wt-textarea { width: 100%; height: calc(100vh - 160px); min-height: 320px; box-sizing: border-box; border: 1px solid ${G.border}; border-radius: 10px; padding: 14px 16px; font-family: ${font}; font-size: 14px; color: ${G.text}; line-height: 1.6; resize: none; outline: none; background: ${G.surface}; }
        .wt-textarea:focus { border-color: ${G.blue}; box-shadow: 0 0 0 2px ${G.blueLight}; }
        @media (max-width: 1000px) {
          .wt-split { grid-template-columns: 1fr; }
          .wt-inputcol { position: static; }
          .wt-textarea { height: 200px; min-height: 140px; }
        }
      `}</style>

      {/* Top bar */}
      <header style={{ background: G.surface, borderBottom: `1px solid ${G.border}`, padding: "0 24px", display: "flex", alignItems: "center", gap: 16, height: 64, flexShrink: 0, position: "sticky", top: 0, zIndex: 100 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <svg width="28" height="28" viewBox="0 0 28 28">
            <circle cx="7" cy="7" r="5.5" fill="#4285f4" />
            <circle cx="21" cy="7" r="5.5" fill="#ea4335" />
            <circle cx="7" cy="21" r="5.5" fill="#34a853" />
            <circle cx="21" cy="21" r="5.5" fill="#fbbc04" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 700, color: G.text, letterSpacing: -0.3 }}>{BRAND}</span>
        </Link>
        <span style={{ fontSize: 13, color: G.textSec, flex: 1 }}>Find the triggers that make content rank</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: G.textSec, cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={filterStop} onChange={(e) => setFilterStop(e.target.checked)} style={{ accentColor: G.blue, width: 16, height: 16 }} />
          Filter stop words
        </label>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", marginTop: 8 }}>
        {/* Sidebar */}
        <nav style={{ width: 240, background: G.surface, borderRight: `1px solid ${G.border}`, flexShrink: 0, overflowY: "auto", padding: "8px 0" }}>
          {TOOLS.map((t) => (
            <NavLink key={t.slug} to={`/${t.slug}`} style={({ isActive }) => ({
              width: "100%", textAlign: "left", padding: "10px 12px", marginRight: 12,
              background: isActive ? G.blueLight : "transparent",
              borderRadius: "0 24px 24px 0", textDecoration: "none",
              display: "flex", alignItems: "center", gap: 12,
              color: isActive ? G.blue : G.textSec, fontSize: 14, fontWeight: isActive ? 500 : 400,
            })}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
              <span>{t.nav}</span>
            </NavLink>
          ))}
        </nav>

        {/* Main: split into writing area (left) + live analysis (right) */}
        <main style={{ flex: 1, overflowY: "auto", padding: "16px 24px 48px" }}>
          <div className="wt-split">
            {/* LEFT — content input */}
            <div className="wt-inputcol">
              <textarea
                className="wt-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste or write your content here — analysis updates live on the right…"
              />
              <div style={{ fontSize: 11, color: G.textHint, marginTop: 6 }}>
                {wordCount.toLocaleString()} words · {text.length.toLocaleString()} chars
              </div>
            </div>

            {/* RIGHT — analysis (each page renders here) */}
            <div>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
