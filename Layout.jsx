import { NavLink, Outlet, Link } from "react-router-dom";
import { G, font } from "./SEOTools.jsx";
import { useContent } from "./content.jsx";
import { TOOLS, BRAND } from "./tools.config.jsx";

export default function Layout() {
  const { text, setText, filterStop, setFilterStop } = useContent();
  const wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div style={{ fontFamily: font, background: G.bg, minHeight: "100vh", display: "flex", flexDirection: "column", color: G.text }}>
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
        {/* Sidebar — now real links to separate URLs */}
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

        {/* Main */}
        <main style={{ flex: 1, overflowY: "auto", padding: "16px 24px 48px" }}>
          {/* Persistent content input — paste once, analyze on every page */}
          <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: G.shadowSm }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or write your content here — it stays loaded as you switch tools…"
              style={{ width: "100%", height: 110, border: `1px solid ${G.border}`, borderRadius: 8, padding: "12px 14px", fontFamily: font, fontSize: 14, color: G.text, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
            />
            <div style={{ fontSize: 11, color: G.textHint, marginTop: 6 }}>
              {wordCount.toLocaleString()} words · {text.length.toLocaleString()} chars
            </div>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
