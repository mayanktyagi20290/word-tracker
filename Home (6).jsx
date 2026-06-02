import { Link } from "react-router-dom";
import { G, font, useAnalysis, SeoScore } from "./SEOTools.jsx";
import { useContent } from "./content.jsx";
import { Head } from "vite-react-ssg";
import { TOOLS, SITE_URL, BRAND } from "./tools.config.jsx";

function teaser(slug, a) {
  if (!a) return "Open tool";
  const ents =
    a.entities.locations.length + a.entities.roles.length +
    a.entities.industries.length + a.entities.brands.length;
  switch (slug) {
    case "word-frequency-counter": return `${a.freqEntries.length.toLocaleString()} keywords`;
    case "long-tail-keyword-finder": return `${(a.phrases[2] || []).length} two-word phrases`;
    case "wh-questions-generator": return `${a.questions.length} questions found`;
    case "nlp-entity-extractor": return `${ents} entities detected`;
    case "content-optimization-checker": return `Readability ${a.readability.score}/100`;
    case "seo-readability-highlighter": return `${a.overused.length} dense keywords`;
    case "competitor-keyword-gap-analysis": return "Add a competitor →";
    case "seo-structure-checker": return `${a.structure.h2} H2 headings`;
    case "search-intent-checker": return `${a.intent[0]?.intent || "—"} ${a.intent[0]?.pct || 0}%`;
    default: return "Open tool";
  }
}

function Metric({ label, value, color }) {
  return (
    <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 14, padding: "16px 18px", minWidth: 0 }}>
      <div style={{ fontSize: 12, color: G.textSec, fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, textTransform: "capitalize", lineHeight: 1.15, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

export default function Home() {
  const { text, targetKeyword } = useContent();
  const a = useAnalysis(text);

  return (
    <>
      <Head>
        <title>{`${BRAND} — Free SEO Content Analyzer`}</title>
        <meta name="description" content="Free in-browser SEO toolkit: word frequency, long-tail keywords, WH questions, search intent, competitor gap analysis and more. No signup, handles 50,000+ words." />
        <link rel="canonical" href={`${SITE_URL}/`} />
        <meta property="og:title" content={`${BRAND} — Free SEO Content Analyzer`} />
      </Head>
    <div style={{ fontFamily: font, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: G.text, margin: "0 0 14px" }}>Free SEO Content Analysis Tools</h1>

      {a && <SeoScore analysis={a} text={text} targetKeyword={targetKeyword} />}

      {/* Instant overview right after the input */}
      {a && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
            <Metric label="Total words" value={a.totalWords.toLocaleString()} color={G.blue} />
            <Metric label="Unique words" value={a.uniqueWords.toLocaleString()} color={G.green} />
            <Metric label="Readability" value={`${a.readability.score}/100`} color={a.readability.score >= 60 ? G.green : a.readability.score >= 40 ? G.yellow : G.red} />
            <Metric label="Primary intent" value={a.intent[0]?.intent || "—"} color={G.purple} />
          </div>
          <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: G.textSec, marginBottom: 10 }}>Top keywords</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {a.topKeywords.slice(0, 10).map((k) => (
                <span key={k.word} style={{ background: G.blueLight, color: G.blue, borderRadius: 999, padding: "3px 12px", fontSize: 13, fontWeight: 500 }}>
                  {k.word} <span style={{ opacity: 0.7 }}>{k.density}%</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tool grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
        {TOOLS.filter((t) => !t.noindex).map((t) => (
          <Link key={t.slug} to={`/${t.slug}`} style={{ textDecoration: "none", background: G.surface, border: `1px solid ${G.border}`, borderRadius: 16, padding: 20, boxShadow: G.shadowSm, display: "block" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{t.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: G.text, marginBottom: 6 }}>{t.h1}</div>
            <div style={{ fontSize: 13, color: G.blue, fontWeight: 500 }}>{teaser(t.slug, a)}</div>
          </Link>
        ))}
      </div>

      {/* Description moved below */}
      <p style={{ fontSize: 14, color: G.textSec, lineHeight: 1.7, maxWidth: 760, marginTop: 28 }}>
        Paste your content in the box on the left for an instant overview, then open any tool for the full breakdown — keyword density, long-tail phrases, search intent, competitor gaps and more across {TOOLS.filter((t) => !t.noindex).length} dimensions. Everything runs in your browser; no signup and nothing leaves your device.
      </p>
    </div>
    </>
  );
}
