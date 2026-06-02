import { createContext, useContext, useEffect, useState } from "react";

const ContentCtx = createContext(null);
export const useContent = () => useContext(ContentCtx);

const isBrowser = typeof window !== "undefined";
const read = (k, fallback) => (isBrowser ? localStorage.getItem(k) : null) ?? fallback;

export function ContentProvider({ children }) {
  const [text, setText] = useState(() => read("seo_text", ""));
  const [compText, setCompText] = useState(() => read("seo_comp", ""));
  const [filterStop, setFilterStop] = useState(() => read("seo_filter", "true") !== "false");
  const [targetKeyword, setTargetKeyword] = useState(() => read("seo_target", ""));

  useEffect(() => { if (isBrowser) localStorage.setItem("seo_text", text); }, [text]);
  useEffect(() => { if (isBrowser) localStorage.setItem("seo_comp", compText); }, [compText]);
  useEffect(() => { if (isBrowser) localStorage.setItem("seo_filter", String(filterStop)); }, [filterStop]);
  useEffect(() => { if (isBrowser) localStorage.setItem("seo_target", targetKeyword); }, [targetKeyword]);

  return (
    <ContentCtx.Provider value={{ text, setText, compText, setCompText, filterStop, setFilterStop, targetKeyword, setTargetKeyword }}>
      {children}
    </ContentCtx.Provider>
  );
}
