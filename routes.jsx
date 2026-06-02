import { Link } from "react-router-dom";
import { Head } from "vite-react-ssg";
import { ContentProvider } from "./content.jsx";
import { G, font } from "./SEOTools.jsx";
import Layout from "./Layout.jsx";
import Home from "./Home.jsx";
import ToolPage from "./ToolPage.jsx";
import { TOOLS, SITE_URL, BRAND } from "./tools.config.jsx";

function Root() {
  return (
    <ContentProvider>
      <Layout />
    </ContentProvider>
  );
}

function NotFound() {
  return (
    <>
      <Head>
        <title>{`Page not found | ${BRAND}`}</title>
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href={`${SITE_URL}/`} />
      </Head>
      <div style={{ fontFamily: font, textAlign: "center", padding: "60px 20px" }}>
        <h1 style={{ fontSize: 24, color: G.text }}>404 — page not found</h1>
        <Link to="/" style={{ color: G.blue }}>Back to all tools</Link>
      </div>
    </>
  );
}

// Static route table. vite-react-ssg crawls these paths and writes a real
// HTML file per URL with the title, meta and content already in place.
export const routes = [
  {
    path: "/",
    element: <Root />,
    children: [
      { index: true, element: <Home /> },
      ...TOOLS.map((t) => ({ path: t.slug, element: <ToolPage tool={t} /> })),
      { path: "*", element: <NotFound /> },
    ],
  },
];
