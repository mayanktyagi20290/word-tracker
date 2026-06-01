# SEOTriggers — multi-page + pre-rendered (SSG)

Each tool is its own URL with its title, meta, content and FAQ schema baked
into static HTML at build time (via vite-react-ssg), so search engines see
everything without running JavaScript.

## Run
1. npm install        # adds react-router-dom + vite-react-ssg
2. npm run dev        # local dev (http://localhost:5173)
3. npm run build      # generates static HTML per route into /dist
4. npm run preview    # preview the built static site

## Before deploying
- In src/tools.config.jsx set SITE_URL and BRAND to your real domain/name.
- Update the domain in public/sitemap.xml and public/robots.txt.

## Output
`npm run build` writes one .html file per URL into /dist:
  index.html, word-frequency-counter.html, long-tail-keyword-finder.html,
  wh-questions-generator.html, ... plus sitemap.xml, robots.txt.
Deploy /dist to any static host (Netlify, Vercel, GitHub Pages, Cloudflare).
_redirects (Netlify) and vercel.json handle SPA fallback for unknown paths.

## Add a new tool (e.g. EEAT, AI Signals, Internal Links)
Add one object to the TOOLS array in src/tools.config.jsx (slug, nav, icon,
Component, title, description, h1, intro, faqs). Route, nav link, sitemap
entry and SEO meta all generate from it.
