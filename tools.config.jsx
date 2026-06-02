import {
  FreqTab, LongtailTab, QuestionsTab, NLPTab, OptTab,
  HighlighterTab, CompTab, StructTab, IntentTab, ExportTab,
} from "./SEOTools.jsx";

// ⚠️ CHANGE THIS to your real domain before deploying (used for canonical URLs + sitemap).
export const SITE_URL = "https://seotriggers.com";
export const BRAND = "SEOTriggers";

// One object = one page = one indexable URL. Add the screenshot's EEAT / AI Signals /
// Internal Links tools here the same way once those components exist.
export const TOOLS = [
  {
    slug: "word-frequency-counter",
    nav: "Word Frequency",
    icon: "📊",
    Component: FreqTab,
    title: "Free Word Frequency Counter & Keyword Density Tool",
    description: "Paste any text to instantly count word frequency and keyword density. See your top keywords, unique-word ratio and over-use warnings — free, no signup, 50,000+ words.",
    h1: "Word Frequency & Keyword Density Counter",
    intro: "Count how often every word appears in your content and see its keyword density as a percentage. Spot your strongest terms, catch accidental over-optimization, and measure vocabulary richness — all in the browser, with no word limit and nothing sent to a server.",
    faqs: [
      { q: "What is a good keyword density?", a: "For most content, keep your primary keyword roughly between 0.5% and 2%. Above 3% it reads as over-used, and above 5% search engines may treat it as keyword stuffing." },
      { q: "Does this tool count stop words?", a: "You can toggle stop-word filtering on or off. With it on, common words like 'the', 'and' and 'of' are removed so the ranking reflects meaningful keywords." },
    ],
  },
  {
    slug: "long-tail-keyword-finder",
    nav: "Long-tail Phrases",
    icon: "🔗",
    Component: LongtailTab,
    title: "Long-tail Keyword Finder — 2 to 6 Word Phrase Extractor",
    description: "Extract long-tail keyword phrases (2–6 words) from any content, ranked by frequency. Find the multi-word phrases your page already targets and the ones to add.",
    h1: "Long-tail Keyword & Phrase Finder",
    intro: "Discover the multi-word phrases hidden in your content. This tool extracts 2-, 3-, 4-, 5- and 6-word n-grams and ranks them by how often they appear, so you can see which long-tail keywords your page naturally targets and reinforce the ones with the most opportunity.",
    faqs: [
      { q: "Why do long-tail keywords matter for SEO?", a: "Long-tail phrases face less competition and match more specific search intent, so they often convert better and are easier to rank for than single broad keywords." },
      { q: "Can I choose the phrase length?", a: "Yes. Pick 2 to 6 words, or set a custom length, and the tool re-ranks the phrases instantly." },
    ],
  },
  {
    slug: "wh-questions-generator",
    nav: "WH Questions",
    icon: "❓",
    Component: QuestionsTab,
    title: "WH Questions Finder for SEO & Featured Snippets",
    description: "Pull every what / why / how / where question out of your content and score each for featured-snippet potential. Great for FAQ schema and People-Also-Ask coverage.",
    h1: "WH Question Finder for SEO",
    intro: "Find the question phrases inside your content — what, why, how, when, where, which and more — and see an SEO opportunity score for each. Questions are the foundation of featured snippets, FAQ schema and People-Also-Ask coverage, so this helps you target them deliberately.",
    faqs: [
      { q: "How does the SEO opportunity score work?", a: "Each question is scored on frequency and phrase length: longer, more-repeated questions score higher because they have stronger featured-snippet potential." },
      { q: "Why should I add questions to my content?", a: "Question-and-answer formatting matches how people search and how voice assistants read results, making your page eligible for snippet and PAA placements." },
    ],
  },
  {
    slug: "nlp-entity-extractor",
    nav: "NLP & Entities",
    icon: "🧠",
    Component: NLPTab,
    title: "NLP Entity Extractor & LSI Keyword Tool",
    description: "Extract named entities (locations, roles, industries, brands), topic clusters and LSI keyword suggestions from your content using in-browser NLP.",
    h1: "NLP Entity & LSI Keyword Extractor",
    intro: "Run entity recognition on your text to surface locations, job roles, industries and brand mentions, then group related terms into topic clusters and get LSI (semantically related) keyword suggestions. Use it to build topical depth that modern search engines reward.",
    faqs: [
      { q: "What are LSI keywords?", a: "LSI (latent semantic indexing) keywords are terms that frequently co-occur with your main topic. Including them signals depth and context to search engines." },
      { q: "What entities does this detect?", a: "It detects locations, roles and job titles, industries, and capitalized proper nouns such as brands, each with a count of how often they appear." },
    ],
  },
  {
    slug: "content-optimization-checker",
    nav: "Optimization",
    icon: "⚡",
    Component: OptTab,
    title: "Content Optimization & Keyword Stuffing Checker",
    description: "Check Flesch-Kincaid readability, catch keyword stuffing above 5% and over-use above 3%, and review the density of your top 20 keywords in one view.",
    h1: "Content Optimization Checker",
    intro: "Get a readability score, density health check and stuffing warnings in one place. The tool flags any keyword above 3% as over-used and above 5% as stuffing, and grades readability with the industry-standard Flesch-Kincaid formula so your content stays both optimized and easy to read.",
    faqs: [
      { q: "What Flesch-Kincaid score should I aim for?", a: "A score of 60 or higher (around 8th-grade reading level) is a safe target for most web content. Lower scores read as more difficult." },
      { q: "When is a keyword considered stuffed?", a: "This tool warns at 3% density (over-used) and flags 5% or higher as keyword stuffing, which can hurt rankings." },
    ],
  },
  {
    slug: "seo-readability-highlighter",
    nav: "Content Highlighter",
    icon: "🖍️",
    Component: HighlighterTab,
    title: "SEO & Readability Content Highlighter",
    description: "Highlight keyword density, hard sentences, passive voice and adverbs directly in your text. Switch between SEO mode, readability mode, or both combined.",
    h1: "SEO & Readability Highlighter",
    intro: "See exactly where your problems are. This highlighter marks dense keywords, long and hard-to-read sentences, passive voice and adverbs right inside your content, with separate SEO and readability views or a combined mode — like a Hemingway-style editor built for search.",
    faqs: [
      { q: "What do the colours mean?", a: "Red marks very hard sentences or stuffed keywords, orange marks hard sentences, green marks passive voice, and purple marks adverbs. Hover any highlight for details." },
      { q: "Why highlight passive voice and adverbs?", a: "Heavy passive voice and adverb use make content harder to read, which can increase bounce rate and weaken engagement signals." },
    ],
  },
  {
    slug: "competitor-keyword-gap-analysis",
    nav: "Competitor Gap",
    icon: "🆚",
    Component: CompTab,
    title: "Competitor Keyword Gap Analysis Tool",
    description: "Paste a competitor's page and instantly find the keywords, phrases and questions they cover that you don't — your content gap, ranked and ready to fill.",
    h1: "Competitor Keyword Gap Analysis",
    intro: "Compare your content against any competitor's page to find your keyword gaps. The tool lists the keywords, 2- and 3-word phrases and WH questions they use that your content is missing, so you know exactly what to add to compete.",
    faqs: [
      { q: "What is a keyword gap?", a: "A keyword gap is any term or phrase a competing page targets that yours doesn't. Closing those gaps helps you rank for the same queries." },
      { q: "Where do I get competitor content?", a: "Copy the visible text from a competitor's page that ranks for your target keyword and paste it into the competitor box." },
    ],
  },
  {
    slug: "seo-structure-checker",
    nav: "SEO Structure",
    icon: "🏗",
    Component: StructTab,
    title: "On-page SEO Structure Checker (Headings, Links, Images)",
    description: "Audit H1/H2/H3 headings, internal and external links, image alt text, tables and paragraph length against on-page SEO best practices. Markdown-aware.",
    h1: "On-page SEO Structure Checker",
    intro: "Audit the structure of your content against on-page SEO best practice. The checker counts your H1, H2 and H3 headings, internal and external links, images, tables and paragraph length, then scores each against an ideal target so you can fix structural gaps fast.",
    faqs: [
      { q: "How many H1 tags should a page have?", a: "Exactly one. A single H1 gives search engines a clear primary topic; multiple H1s dilute that signal." },
      { q: "Why does it show zero headings for my text?", a: "Structure detection reads Markdown (# H1, ## H2, [links], ![images]). Paste Markdown-formatted content for accurate counts." },
    ],
  },
  {
    slug: "search-intent-checker",
    nav: "Intent",
    icon: "🎯",
    Component: IntentTab,
    title: "Search Intent Checker — Informational vs Commercial",
    description: "Classify your content's search intent — informational, commercial, transactional or navigational — with a signal-by-signal breakdown and optimization tips.",
    h1: "Search Intent Classifier",
    intro: "Find out what intent your content signals to search engines. The classifier scores your text across informational, commercial, transactional and navigational intent, shows the breakdown, and gives tips to align your page with what searchers actually want.",
    faqs: [
      { q: "Why does search intent matter?", a: "Matching the dominant intent of a query is one of the strongest ranking factors. Content that mismatches intent rarely ranks, no matter how well-optimized." },
      { q: "What are the four intent types?", a: "Informational (learn), commercial (compare before buying), transactional (ready to act), and navigational (find a specific page or brand)." },
    ],
  },
  {
    slug: "export-seo-report",
    nav: "Export",
    icon: "💾",
    Component: ExportTab,
    title: "Export SEO Analysis — CSV & JSON",
    description: "Download your full SEO analysis as a Keywords CSV, a complete report CSV, or structured JSON.",
    h1: "Export Your SEO Report",
    intro: "Download everything you've analyzed as a keywords CSV, a full report CSV (keywords, phrases and questions) or structured JSON for your own tooling.",
    faqs: [],
    noindex: true, // utility page, not a keyword landing page
  },
];

export const TOOLS_BY_SLUG = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));
