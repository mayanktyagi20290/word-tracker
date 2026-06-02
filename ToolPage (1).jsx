import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { G, font, useAnalysis, useCompAnalysis, makeExporters } from "./SEOTools.jsx";
import { useContent } from "./content.jsx";
import { Head } from "vite-react-ssg";
import { TOOLS, SITE_URL, BRAND } from "./tools.config.jsx";

export default function ToolPage({ tool }) {
  const { text, compText, setCompText, filterStop } = useContent();
  const analysis = useAnalysis(text, filterStop);
  const compAnalysis = useCompAnalysis(compText, analysis);
  const exporters = useMemo(() => makeExporters(analysis), [analysis]);
  const [phraseLen, setPhraseLen] = useState(2);
  const [customN, setCustomN] = useState(4);


  const Tool = tool.Component;
  const related = TOOLS.filter((t) => t.slug !== tool.slug && !t.noindex).slice(0, 5);

  return (
    <article style={{ fontFamily: font, maxWidth: 1100 }}>
      <Head>
        <title>{`${tool.title} | ${BRAND}`}</title>
        <meta name="description" content={tool.description} />
        <link rel="canonical" href={`${SITE_URL}/${tool.slug}`} />
        <meta property="og:title" content={`${tool.title} | ${BRAND}`} />
        {tool.noindex && <meta name="robots" content="noindex,follow" />}
      </Head>
      {/* On-page SEO content — present even before any text is pasted, so the URL has crawlable, keyword-rich copy */}
      <h1 style={{ fontSize: 26, fontWeight: 700, color: G.text, margin: "4px 0 8px" }}>{tool.h1}</h1>
      <p style={{ fontSize: 15, color: G.textSec, lineHeight: 1.7, maxWidth: 760, margin: "0 0 24px" }}>{tool.intro}</p>

      {analysis ? (
        <Tool
          analysis={analysis}
          rawText={text}
          compText={compText}
          setCompText={setCompText}
          compAnalysis={compAnalysis}
          phraseLen={phraseLen}
          setPhraseLen={setPhraseLen}
          customN={customN}
          setCustomN={setCustomN}
          exportCSV={exporters.exportCSV}
          exportFullCSV={exporters.exportFullCSV}
          exportJSON={exporters.exportJSON}
        />
      ) : (
        <div style={{ background: G.surface, border: `1px dashed ${G.border}`, borderRadius: 12, padding: "40px 24px", textAlign: "center", color: G.textSec }}>
          Paste your content in the box above to run this analysis.
        </div>
      )}

      {/* FAQ — extra keyword-rich content + eligible for FAQ rich results via JSON-LD below */}
      {tool.faqs && tool.faqs.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: G.text, marginBottom: 12 }}>Frequently asked questions</h2>
          {tool.faqs.map((f, i) => (
            <div key={i} style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 8, padding: "14px 18px", marginBottom: 10 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: G.text, margin: "0 0 6px" }}>{f.q}</h3>
              <p style={{ fontSize: 13, color: G.textSec, lineHeight: 1.6, margin: 0 }}>{f.a}</p>
            </div>
          ))}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: tool.faqs.map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: { "@type": "Answer", text: f.a },
                })),
              }),
            }}
          />
        </section>
      )}

      {/* Internal links — pass link equity between the tool pages */}
      <section style={{ marginTop: 40, borderTop: `1px solid ${G.border}`, paddingTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: G.textSec, marginBottom: 12 }}>Related SEO tools</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {related.map((t) => (
            <Link key={t.slug} to={`/${t.slug}`} style={{ background: G.blueLight, color: G.blue, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
              {t.icon} {t.nav}
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
