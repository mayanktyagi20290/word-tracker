import { useState, useMemo, useEffect, useRef } from "react";

// ── Font injection (Plus Jakarta Sans) ──────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
document.head.appendChild(fontLink);

// ── SEOTriggers design tokens ────────────────────────────────────────────────
const G = {
  blue:       "#4f46e5",
  blueLight:  "#eef2ff",
  blueDark:   "#3730a3",
  green:      "#1e8e3e",
  greenLight: "#e6f4ea",
  red:        "#d93025",
  redLight:   "#fce8e6",
  yellow:     "#f9ab00",
  yellowLight:"#fef7e0",
  purple:     "#7627bb",
  purpleLight:"#f3e8fd",
  teal:       "#007b83",
  tealLight:  "#e4f7fb",
  surface:    "#ffffff",
  bg:         "#f5f6fb",
  border:     "#e5e7f0",
  text:       "#1a1c2e",
  textSec:    "#5b5e76",
  textHint:   "#8a8da3",
  hover:      "#f1f2f9",
  shadow:     "0 4px 16px -4px rgba(79,70,229,.18), 0 1px 3px rgba(26,28,46,.08)",
  shadowSm:   "0 1px 2px rgba(26,28,46,.08)",
};

// ── NLP engine ────────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "a","about","above","after","again","against","all","am","an","and","any","are","aren't","as","at",
  "be","because","been","before","being","below","between","both","but","by","can't","cannot","could",
  "couldn't","did","didn't","do","does","doesn't","doing","don't","down","during","each","few","for",
  "from","further","get","got","had","hadn't","has","hasn't","have","haven't","having","he","he'd",
  "he'll","he's","her","here","here's","hers","herself","him","himself","his","how","how's","i","i'd",
  "i'll","i'm","i've","if","in","into","is","isn't","it","it's","its","itself","let's","me","more",
  "most","mustn't","my","myself","no","nor","not","of","off","on","once","only","or","other","ought",
  "our","ours","ourselves","out","over","own","same","shan't","she","she'd","she'll","she's","should",
  "shouldn't","so","some","such","than","that","that's","the","their","theirs","them","themselves",
  "then","there","there's","these","they","they'd","they'll","they're","they've","this","those",
  "through","to","too","under","until","up","very","was","wasn't","we","we'd","we'll","we're","we've",
  "were","weren't","what","what's","when","when's","where","where's","which","while","who","who's",
  "whom","why","why's","will","with","won't","would","wouldn't","you","you'd","you'll","you're",
  "you've","your","yours","yourself","yourselves","also","just","like","get","use","using","used",
  "one","two","three","four","five","six","seven","eight","nine","ten","vs","etc","eg","ie"
]);
const WH_WORDS = ["what","why","when","where","which","who","how","can","is","are","does","do","should","will","would","could"];
const INTENT_PATTERNS = {
  transactional: /\b(buy|purchase|order|download|get|sign up|subscribe|apply|register|hire|price|cost|deal|discount|free|try|book|install)\b/gi,
  commercial:    /\b(best|top|vs|versus|compare|review|rating|alternative|recommend|pros|cons|worth|cheap|affordable)\b/gi,
  navigational:  /\b(login|log in|sign in|official|website|app|portal|platform|contact|support|help center)\b/gi,
  informational: /\b(what|how|why|when|where|which|who|learn|guide|tutorial|tips|explain|definition|example|understand)\b/gi,
};

function tokenize(text) { return text.toLowerCase().replace(/[^a-z0-9\s'-]/g," ").split(/\s+/).filter(Boolean); }
function cleanTokens(t) { return t.filter(w => w.length>2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w)); }
function getNgrams(tokens, n) {
  const g={};
  for(let i=0;i<=tokens.length-n;i++){const k=tokens.slice(i,i+n).join(" ");g[k]=(g[k]||0)+1;}
  return g;
}
function extractSentences(text) {
  const prot = text
    .replace(/(\d)\.(\d)/g, "$1<d>$2")
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Retd|vs|etc|No|Fig|Rs|Vol|Govt|Inc|Ltd|Jan|Feb|Aug|Sept|Oct|Nov|Dec)\./gi, "$1<d>")
    .replace(/\b([ie])\.([eg])\./gi, "$1<d>$2<d>");
  const sents = prot.match(/[^.!?]+[.!?]+/g) || [prot];
  return sents.map(s => s.replace(/<d>/g, "."));
}
function paragraphBlocks(text) {
  const dbl = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return dbl.length > 2 ? dbl : text.split(/\n+/).map(s => s.trim()).filter(Boolean);
}
function extractQuestions(text) {
  const whP=[]; const lines=text.split(/\n/);
  lines.forEach(line=>{ const low=line.toLowerCase().trim();
    WH_WORDS.forEach(wh=>{ if(low.startsWith(wh+" ")||low.startsWith(wh+"'")){
      const c=line.trim().replace(/\?$/,"").trim();
      if(c.split(/\s+/).length>=3)whP.push(c);
    }});
  });
  (text.match(/[^.!?\n]*\?/g)||[]).forEach(s=>{
    const low=s.toLowerCase().trim();
    WH_WORDS.forEach(wh=>{ if(low.includes(wh+" ")){const c=s.trim();if(c.split(/\s+/).length>=3)whP.push(c);}});
  });
  const counts={};
  whP.forEach(q=>{const k=q.toLowerCase().slice(0,80);counts[k]=(counts[k]||0)+1;});
  return Object.entries(counts).map(([phrase,freq])=>({
    phrase,freq,starter:WH_WORDS.find(w=>phrase.startsWith(w))||"other",
    seoScore:Math.min(100,freq*20+phrase.split(/\s+/).length*8)
  })).sort((a,b)=>b.seoScore-a.seoScore);
}
function extractEntities(text) {
  const capCounts={};
  (text.match(/\b[A-Z][a-z]{2,}\b/g)||[]).forEach(w=>{capCounts[w]=(capCounts[w]||0)+1;});
  const locs=text.match(/\b(bangalore|delhi|mumbai|pune|chennai|hyderabad|kolkata|noida|gurgaon|india|ncr|ghaziabad|faridabad|bengaluru)\b/gi)||[];
  const roles=text.match(/\b(engineer|developer|analyst|manager|designer|marketer|consultant|intern|fresher|executive|lead|director|founder)\b/gi)||[];
  const inds=text.match(/\b(IT|tech|finance|marketing|sales|HR|healthcare|manufacturing|BPO|pharma|consulting|education|ecommerce|startup|MNC)\b/g)||[];
  const cu=arr=>{const c={};arr.forEach(v=>{c[v.toLowerCase()]=(c[v.toLowerCase()]||0)+1;});return Object.entries(c).map(([k,v])=>({word:k,count:v})).sort((a,b)=>b.count-a.count);};
  return {
    locations:cu(locs),roles:cu(roles),industries:cu(inds),
    brands:Object.entries(capCounts).filter(([w])=>!STOP_WORDS.has(w.toLowerCase())&&!locs.map(l=>l.toLowerCase()).includes(w.toLowerCase())).map(([w,c])=>({word:w,count:c})).sort((a,b)=>b.count-a.count).slice(0,10)
  };
}
function detectIntent(text) {
  const scores={};
  Object.entries(INTENT_PATTERNS).forEach(([k,p])=>{scores[k]=(text.match(p)||[]).length;});
  const total=Object.values(scores).reduce((a,b)=>a+b,0)||1;
  return Object.entries(scores).map(([k,v])=>({intent:k,score:v,pct:Math.round((v/total)*100)})).sort((a,b)=>b.score-a.score);
}
function readabilityScore(text) {
  const sents=extractSentences(text); const words=tokenize(text);
  const syl=words.reduce((a,w)=>a+Math.max(1,(w.match(/[aeiou]/gi)||[]).length),0);
  const aws=words.length/(sents.length||1); const asw=syl/(words.length||1);
  const fk=Math.max(0,Math.min(100,206.835-1.015*aws-84.6*asw));
  const label=fk>=70?"Easy":fk>=60?"Standard":fk>=50?"Fairly Difficult":fk>=30?"Difficult":"Very Difficult";
  return {score:Math.round(fk),label,avgWords:Math.round(aws),avgSyl:asw.toFixed(2)};
}
function checkStructure(text) {
  let h1=(text.match(/^#{1}\s.+/gm)||[]).length;
  let h2=(text.match(/^#{2}\s.+/gm)||[]).length;
  let h3=(text.match(/^#{3}\s.+/gm)||[]).length;

  // Plain-text fallback: detect heading-like lines when no Markdown headings exist
  if (h1 + h2 + h3 === 0) {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    const headingLines = lines.filter(l => {
      const w = l.split(/\s+/).length;
      if (w > 12 || w < 2) return false;
      if (/[.!,;:]$/.test(l)) return false;                 // ends like a sentence
      if (/^[₹$|•\-*]/.test(l)) return false;                // currency / bullet / table cell
      if (/^\d[\d,]*(\.\d+)?(\s|$)/.test(l)) return false;   // starts with a bare number (data row)
      return /[A-Za-z]/.test(l);
    });
    if (headingLines.length > 0) { h1 = 1; h2 = Math.max(0, headingLines.length - 1); h3 = 0; }
  }

  const mdExternal = (text.match(/\[.*?\]\(https?:\/\/[^)]+\)/g)||[]).length;
  const bareUrls = (text.match(/https?:\/\/[^\s)]+/g)||[]).length;
  const blocks = paragraphBlocks(text);

  return {
    h1, h2, h3,
    internal:(text.match(/\[.*?\]\((?!https?:\/\/)[^)]+\)/g)||[]).length,
    external:Math.max(mdExternal, bareUrls),
    images:(text.match(/!\[.*?\]\([^)]+\)/g)||[]).length,
    tables:(text.match(/\|.+\|/g)||[]).length>0?1:0,
    paragraphs:blocks.filter(p=>p.split(/\s+/).length>=12).length,
    longParas:blocks.filter(p=>p.split(/\s+/).length>150).length,
  };
}

// ── Weighted SEO Score (100) ─────────────────────────────────────────────────
function scoreColor(s){ return s<=40 ? "#d93025" : s<=70 ? "#f9ab00" : "#1e8e3e"; }
function scoreLabel(s){ return s<=40 ? "Needs work" : s<=70 ? "Good" : "Excellent"; }

function computeSeoScore(a){
  const tw = a.totalWords || 0;

  // Content Length (10) — ramps to full near 1000 words
  const lengthScore = Math.max(0, Math.min(10, tw/100));

  // Keyword Coverage (20) — healthy-density keywords, penalised for stuffing
  const healthy = (a.topKeywords||[]).filter(k=>{const d=parseFloat(k.density); return d>=0.4 && d<=3.2;}).length;
  const kwScore = Math.max(0, Math.min(20, healthy*4) - (a.stuffing?.length||0)*5);

  // Entity Coverage (15) — distinct detected entities
  const ent = a.entities.locations.length + a.entities.roles.length + a.entities.industries.length + a.entities.brands.length;
  const entScore = Math.min(15, ent*2);

  // Long-tail Coverage (15) — repeating 2/3/4-word phrases
  const lt = [2,3,4].reduce((s,n)=> s + (a.phrases[n]||[]).filter(([,c])=>c>=2).length, 0);
  const ltScore = Math.min(15, lt*1.5);

  // Intent Match (15) — clarity of dominant intent
  const signals = a.intent.reduce((s,i)=>s+i.score,0);
  const intentScore = signals===0 ? 5 : Math.min(15, Math.round(6 + (a.intent[0].pct/100)*9));

  // Readability (10) — Flesch sweet spot 60–80
  const fk = a.readability.score;
  const readScore = (fk>=60&&fk<=80)?10 : (fk>=50&&fk<90)?8 : (fk>=40)?6 : (fk>=30)?4 : 2;

  // Structure (10) — markdown headings, paragraphs, links, images
  const s = a.structure; let st = 0;
  if (s.h1===1) st+=2.5; else if(s.h1>1) st+=1;
  if (s.h2>=2) st+=2; else if(s.h2>=1) st+=1;
  if (s.h3>=1) st+=1;
  if (s.paragraphs>=3) st+=2.5; else if(s.paragraphs>=1) st+=1;
  if (s.internal>=1) st+=1;
  if (s.images>=1) st+=1;
  const structScore = Math.min(10, st);

  // WH Questions (5)
  const whScore = Math.min(5, a.questions.length);

  const breakdown = [
    {label:"Keyword Coverage",  score:kwScore,     max:20},
    {label:"Entity Coverage",   score:entScore,    max:15},
    {label:"Long-tail Coverage",score:ltScore,     max:15},
    {label:"Intent Match",      score:intentScore, max:15},
    {label:"Content Length",    score:lengthScore, max:10},
    {label:"Readability",       score:readScore,   max:10},
    {label:"Structure",         score:structScore, max:10},
    {label:"WH Questions",      score:whScore,     max:5},
  ];
  const total = Math.max(0, Math.min(100, Math.round(breakdown.reduce((sum,b)=>sum+b.score,0))));
  return { total, breakdown };
}

// ── EEAT analyzer (Experience · Expertise · Authority · Trust) ────────────────
function analyzeEEAT(text){
  const c = (re)=> (text.match(re)||[]).length;
  const author   = /\b(written by|authored by|author|about the author|reviewed by)\b/i.test(text) || /\bin my (experience|opinion|testing|view)\b/i.test(text);
  const sourcesN = c(/\b(according to|source[s]?:|study|studies|research|reported|cited|reference|journal|data from)\b/gi) + c(/\[.*?\]\(https?:\/\/[^)]+\)/g) + c(/https?:\/\/\S+/g);
  const statsN   = c(/\b\d+(\.\d+)?\s?%|\b\d{1,3}(,\d{3})+\b|\$\s?\d+|\b\d+\s?(million|billion|thousand|percent)\b/gi);
  const quotesN  = c(/["“][^"”]{15,}["”]/g);
  const expert   = /\b(expert|dr\.|ph\.?\s?d|professor|specialist|certified|qualified|licensed|years of experience)\b/i.test(text);
  const trust    = /\b(privacy|guarantee|verified|trusted|reviewed|fact[- ]?check|last updated|disclaimer|terms|secure|refund|policy)\b/i.test(text);

  const checks = [
    {key:"Author / first-hand experience", ok:author,            tip:"Add an author byline or first-person experience signals ('in my experience…')."},
    {key:"Sources & citations",            ok:sourcesN>0,         tip:"Cite and link reputable sources — studies, data, official pages."},
    {key:"Statistics & data",              ok:statsN>0,           tip:"Support claims with concrete numbers, %, or figures."},
    {key:"Expert references / quotes",      ok:expert||quotesN>0,  tip:"Quote an expert or show credentials (Dr., PhD, certified)."},
    {key:"Trust signals",                  ok:trust,              tip:"Add a 'last updated' date, disclaimer, or review note."},
  ];
  const passed = checks.filter(x=>x.ok).length;
  const score = Math.round((passed/checks.length)*100);
  return { score, checks, counts:{ sources:sourcesN, stats:statsN, quotes:quotesN } };
}

// ── AI-content signals (heuristic human-like estimate) ───────────────────────
function analyzeAISignals(text){
  const sents = (text.match(/[^.!?]+[.!?]+/g)||[]).map(s=>s.trim()).filter(Boolean);
  const wc = sents.map(s=>s.split(/\s+/).filter(Boolean).length);
  const mean = wc.reduce((a,b)=>a+b,0)/(wc.length||1);
  const stdev = Math.sqrt(wc.reduce((a,b)=>a+(b-mean)**2,0)/(wc.length||1));
  const cv = mean ? stdev/mean : 0;
  const sentVar = Math.min(100, Math.round((cv/0.6)*100));

  const paras = text.split(/\n{2,}/).map(p=>p.split(/\s+/).filter(Boolean).length).filter(n=>n>0);
  const pMean = paras.reduce((a,b)=>a+b,0)/(paras.length||1);
  const pStd = Math.sqrt(paras.reduce((a,b)=>a+(b-pMean)**2,0)/(paras.length||1));
  const paraVar = paras.length<2 ? 45 : Math.min(100, Math.round(((pMean?pStd/pMean:0)/0.5)*100));

  const starters = sents.map(s=>(s.toLowerCase().split(/\s+/)[0]||"")).filter(Boolean);
  const sc = {}; starters.forEach(s=>sc[s]=(sc[s]||0)+1);
  const repeated = Object.values(sc).filter(n=>n>1).reduce((a,b)=>a+b,0);
  const repetition = Math.max(0, Math.round((1 - (starters.length?repeated/starters.length:0)*1.4)*100));

  const nearMean = wc.filter(n=>Math.abs(n-mean)<=2).length;
  const unpredict = wc.length ? Math.round((1 - nearMean/wc.length)*100) : 50;

  const metrics = [
    {label:"Sentence-length variation", score:sentVar,    tip:"Mix short and long sentences."},
    {label:"Paragraph variation",       score:paraVar,    tip:"Vary paragraph lengths."},
    {label:"Low repetition",            score:repetition, tip:"Avoid starting sentences the same way."},
    {label:"Unpredictability",          score:unpredict,  tip:"Break uniform sentence rhythm."},
  ];
  const human = Math.round(metrics.reduce((a,m)=>a+m.score,0)/metrics.length);
  return { human, metrics, avgSentence:Math.round(mean) };
}

// ── Internal-linking suggestions ─────────────────────────────────────────────
function suggestInternalLinks(a){
  const out=[]; const seen=new Set();
  const add=(t,type)=>{ const k=(t||"").toLowerCase().trim(); if(k && !seen.has(k) && t.split(/\s+/).length<=5){ seen.add(k); out.push({text:t,type}); } };
  (a.phrases[3]||[]).slice(0,6).forEach(([p,c])=>{ if(c>=1) add(p,"Long-tail phrase"); });
  (a.phrases[2]||[]).slice(0,6).forEach(([p,c])=>{ if(c>=2) add(p,"Key phrase"); });
  a.entities.industries.slice(0,3).forEach(e=>add(e.word,"Topic page"));
  a.entities.roles.slice(0,3).forEach(e=>add(e.word,"Category page"));
  a.topKeywords.slice(0,6).forEach(k=>add(k.word,"Keyword"));
  return out.slice(0,14);
}

// ── UI primitives ──────────────────────────────────────────────────────────────
const font = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif";

// ── Responsive hook ─────────────────────────────────────────────────────────
function useIsMobile(breakpoint = 820) {
  const get = () => (typeof window !== "undefined" ? window.innerWidth < breakpoint : false);
  const [mobile, setMobile] = useState(get);
  useEffect(() => {
    const onResize = () => setMobile(get());
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return mobile;
}

// ── SEOTriggers brand mark ──────────────────────────────────────────────────
function Logo({ size = 30 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: `linear-gradient(135deg, ${G.blue} 0%, #7c3aed 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 8px -1px rgba(79,70,229,.5)",
    }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="#fff" />
      </svg>
    </div>
  );
}

function Wordmark({ small }) {
  return (
    <span style={{ fontSize: small ? 17 : 19, fontWeight: 800, letterSpacing: -0.5, color: G.text, whiteSpace: "nowrap" }}>
      SEO<span style={{ color: G.blue }}>Triggers</span>
    </span>
  );
}

function GChip({ children, color=G.blue, bg=G.blueLight, active, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      background: active ? color : bg,
      color: active ? "#fff" : color,
      border: `1px solid ${active ? color : color+"44"}`,
      borderRadius: 999, padding: small?"2px 10px":"6px 16px",
      fontSize: small?11:13, fontWeight:500, cursor:"pointer",
      fontFamily:font, transition:"all .15s", whiteSpace:"nowrap",
      outline:"none",
    }}
    onMouseEnter={e=>!active&&(e.currentTarget.style.background=color+"18")}
    onMouseLeave={e=>!active&&(e.currentTarget.style.background=bg)}
    >{children}</button>
  );
}

function GCard({ children, style={}, padding=16 }) {
  return (
    <div style={{background:G.surface,borderRadius:8,boxShadow:G.shadowSm,border:`1px solid ${G.border}`,padding,...style}}>
      {children}
    </div>
  );
}

function GTable({ headers, rows, accent=G.blue }) {
  return (
    <div style={{border:`1px solid ${G.border}`,borderRadius:8,overflow:"hidden",background:G.surface}}>
      <div style={{display:"grid",gridTemplateColumns:headers.map(h=>h.width||"1fr").join(" "),background:G.bg,borderBottom:`1px solid ${G.border}`}}>
        {headers.map(h=>(
          <div key={h.label} style={{padding:"10px 16px",fontSize:12,fontWeight:500,color:G.textSec,letterSpacing:.4,textAlign:h.align||"left"}}>{h.label}</div>
        ))}
      </div>
      <div style={{maxHeight:460,overflowY:"auto"}}>
        {rows.map((row,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:headers.map(h=>h.width||"1fr").join(" "),borderBottom:i<rows.length-1?`1px solid ${G.border}`:"none",background:i%2===0?G.surface:"#fafafa"}}>
            {row.map((cell,j)=>(
              <div key={j} style={{padding:"10px 16px",fontSize:13,color:G.text,textAlign:headers[j]?.align||"left",alignSelf:"center",...(headers[j]?.style||{})}}>{cell}</div>
            ))}
          </div>
        ))}
        {rows.length===0&&<div style={{padding:32,textAlign:"center",color:G.textHint,fontSize:13}}>No data found</div>}
      </div>
    </div>
  );
}

function GBar({ value, max, color=G.blue, height=6 }) {
  return (
    <div style={{background:G.border,borderRadius:99,height,overflow:"hidden",flex:1,minWidth:60}}>
      <div style={{width:`${Math.round((value/max)*100)}%`,height:"100%",background:color,borderRadius:99,transition:"width .3s ease"}}/>
    </div>
  );
}

function GBadge({ children, color=G.blue, bg }) {
  return (
    <span style={{background:bg||color+"18",color,borderRadius:999,padding:"2px 10px",fontSize:12,fontWeight:500,whiteSpace:"nowrap"}}>{children}</span>
  );
}

function GStat({ label, value, sub, icon, color=G.blue }) {
  return (
    <GCard style={{flex:1,minWidth:140}} padding="16px 20px">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:12,color:G.textSec,fontWeight:500,marginBottom:6}}>{label}</div>
          <div style={{fontSize:26,fontWeight:700,color:G.text,lineHeight:1}}>{value}</div>
          {sub&&<div style={{fontSize:11,color:G.textHint,marginTop:4}}>{sub}</div>}
        </div>
        {icon&&<div style={{fontSize:22,color:color,background:color+"15",borderRadius:8,padding:8,lineHeight:1}}>{icon}</div>}
      </div>
    </GCard>
  );
}

// ── Live content dashboard ───────────────────────────────────────────────────
function Dashboard({ text, analysis, isMobile }) {
  const a = analysis;
  const chars = text.length;
  const readMin = a.totalWords ? Math.max(1, Math.round(a.totalWords / 200)) : 0;
  const speakMin = a.totalWords ? Math.max(1, Math.round(a.totalWords / 130)) : 0;
  const { total, breakdown } = a.seo;
  const col = scoreColor(total);
  const worst = [...breakdown].sort((x, y) => (x.score / x.max) - (y.score / y.max))[0];

  const stats = [
    { l: "Words",      v: a.totalWords.toLocaleString(), icon: "📝", c: G.blue },
    { l: "Characters", v: chars.toLocaleString(),        icon: "🔤", c: G.teal },
    { l: "Sentences",  v: a.sentences.toLocaleString(),  icon: "✍️", c: G.purple },
    { l: "Paragraphs", v: a.paragraphs.toLocaleString(), icon: "¶",  c: G.green },
    { l: "Reading",    v: `${readMin} min`,              icon: "📖", c: G.yellow },
    { l: "Speaking",   v: `${speakMin} min`,             icon: "🎙️", c: G.red },
  ];

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, alignItems: "stretch" }}>
      {/* SEO Score */}
      <GCard style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0, minWidth: isMobile ? "auto" : 290 }} padding={isMobile ? 14 : 16}>
        <svg width="86" height="86" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
          <circle cx="50" cy="50" r="42" fill="none" stroke={G.border} strokeWidth="9" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${(total / 100) * 264} 264`} transform="rotate(-90 50 50)" style={{ transition: "stroke-dasharray .4s ease" }} />
          <text x="50" y="48" textAnchor="middle" fontSize="27" fontWeight="800" fill={G.text} fontFamily={font}>{total}</text>
          <text x="50" y="66" textAnchor="middle" fontSize="11" fill={G.textHint} fontFamily={font}>/ 100</text>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: G.textHint, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6 }}>SEO Score</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: col, margin: "2px 0 4px" }}>{scoreLabel(total)}</div>
          <div style={{ fontSize: 12, color: G.textSec }}>Improve next: <b style={{ color: G.text }}>{worst.label}</b></div>
        </div>
      </GCard>

      {/* Stat tiles */}
      <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: isMobile ? "repeat(3,minmax(0,1fr))" : "repeat(6,minmax(0,1fr))", gap: 8 }}>
        {stats.map(s => (
          <GCard key={s.l} padding="12px 6px" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 0, minHeight: isMobile ? 84 : 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: s.c + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, lineHeight: 1 }}>{s.icon}</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: G.text, lineHeight: 1, whiteSpace: "nowrap" }}>{s.v}</div>
            <div style={{ fontSize: 9.5, color: G.textSec, fontWeight: 700, letterSpacing: .4, textTransform: "uppercase" }}>{s.l}</div>
          </GCard>
        ))}
      </div>
    </div>
  );
}

// ── Tabs config ────────────────────────────────────────────────────────────────
const TABS = [
  {id:"frequency",label:"Word Frequency",icon:"bar_chart"},
  {id:"longtail",label:"Long-tail Phrases",icon:"link"},
  {id:"questions",label:"WH Questions",icon:"help_outline"},
  {id:"nlp",label:"NLP & Entities",icon:"psychology"},
  {id:"optimization",label:"Optimization",icon:"tune"},
  {id:"eeat",label:"EEAT",icon:"shield"},
  {id:"ai",label:"AI Signals",icon:"robot"},
  {id:"highlighter",label:"Content Highlighter",icon:"🖍️"},
  {id:"competitor",label:"Competitor Gap",icon:"compare_arrows"},
  {id:"structure",label:"SEO Structure",icon:"schema"},
  {id:"linking",label:"Internal Links",icon:"link"},
  {id:"intent",label:"Intent",icon:"my_location"},
  {id:"export",label:"Export",icon:"download"},
];

// ── Main app ───────────────────────────────────────────────────────────────────
export default function SEOTracker() {
  const [text, setText] = useState("");
  const [compText, setCompText] = useState("");
  const [tab, setTab] = useState("frequency");
  const [filterStop, setFilterStop] = useState(true);
  const [phraseLen, setPhraseLen] = useState(2);
  const [customN, setCustomN] = useState(4);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const resultsRef = useRef(null);
  const scrollToResults = () => resultsRef.current && resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);

  const analysis = useMemo(() => {
    if (!text.trim()) return null;
    const tokens = tokenize(text);
    const clean = cleanTokens(tokens);
    const rawFreq={}, cleanFreq={};
    tokens.forEach(t=>{if(t.length>1)rawFreq[t]=(rawFreq[t]||0)+1;});
    clean.forEach(t=>{cleanFreq[t]=(cleanFreq[t]||0)+1;});
    const freqEntries = Object.entries(filterStop?cleanFreq:rawFreq).sort((a,b)=>b[1]-a[1]);
    const totalWords=tokens.length, uniqueWords=new Set(tokens).size;
    const phrases={};
    [2,3,4,5,6].forEach(n=>{phrases[n]=Object.entries(getNgrams(clean,n)).filter(([,c])=>c>=1).sort((a,b)=>b[1]-a[1]).slice(0,60);});
    const questions=extractQuestions(text);
    const entities=extractEntities(text);
    const intent=detectIntent(text);
    const readability=readabilityScore(text);
    const structure=checkStructure(text);
    const topKeywords=freqEntries.slice(0,20).map(([k,v])=>({word:k,count:v,density:((v/totalWords)*100).toFixed(2)}));
    const overused=topKeywords.filter(k=>parseFloat(k.density)>3);
    const stuffing=topKeywords.filter(k=>parseFloat(k.density)>5);
    const stems={};
    clean.forEach(t=>{const s=t.slice(0,5);if(!stems[s])stems[s]=[];if(!stems[s].includes(t))stems[s].push(t);});
    const clusters=Object.entries(stems).filter(([,w])=>w.length>=2).map(([s,w])=>({stem:s,words:w})).slice(0,15);
    const lsi=topKeywords.slice(0,5).map(k=>({keyword:k.word,related:clean.filter((t,i)=>{const win=clean.slice(Math.max(0,i-5),Math.min(clean.length,i+5));return win.includes(k.word)&&t!==k.word;}).reduce((a,t)=>{a[t]=(a[t]||0)+1;return a;},{})})).map(item=>({keyword:item.keyword,related:Object.entries(item.related).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w])=>w)}));
    const sentences=extractSentences(text).filter(s=>s.trim().length>0).length;
    const paragraphs=Math.max(1, paragraphBlocks(text).length);
    const seo=computeSeoScore({totalWords,topKeywords,stuffing,entities,phrases,questions,intent,readability,structure});
    const eeat=analyzeEEAT(text);
    const aiSignals=analyzeAISignals(text);
    const internalLinks=suggestInternalLinks({phrases,entities,topKeywords});
    return {tokens,clean,freqEntries,totalWords,uniqueWords,phrases,questions,entities,intent,readability,structure,topKeywords,overused,stuffing,clusters,lsi,sentences,paragraphs,seo,eeat,aiSignals,internalLinks};
  },[text,filterStop]);

  const compAnalysis = useMemo(() => {
    if (!compText.trim()||!analysis) return null;
    const ct=cleanTokens(tokenize(compText));
    const cf={};ct.forEach(t=>{cf[t]=(cf[t]||0)+1;});
    const myW=new Set(analysis.clean);
    const myP2=new Set((analysis.phrases[2]||[]).map(([p])=>p));
    const myP3=new Set((analysis.phrases[3]||[]).map(([p])=>p));
    return {
      missingWords:Object.entries(cf).filter(([w])=>!myW.has(w)&&w.length>3).sort((a,b)=>b[1]-a[1]).slice(0,30),
      missingPhrases2:Object.entries(getNgrams(ct,2)).filter(([p,c])=>!myP2.has(p)&&c>=1).sort((a,b)=>b[1]-a[1]).slice(0,20),
      missingPhrases3:Object.entries(getNgrams(ct,3)).filter(([p,c])=>!myP3.has(p)&&c>=1).sort((a,b)=>b[1]-a[1]).slice(0,20),
      missingQs:extractQuestions(compText).filter(q=>!new Set(analysis.questions.map(q=>q.phrase.slice(0,40))).has(q.phrase.slice(0,40))),
    };
  },[compText,analysis]);

  const exportCSV = () => {
    if (!analysis) return;
    const rows=[["Keyword","Count","Density %"],...analysis.freqEntries.slice(0,200).map(([w,c])=>[w,c,((c/analysis.totalWords)*100).toFixed(2)])];
    const csv=rows.map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="seo-keywords.csv";a.click();
  };
  const exportFullCSV = () => {
    if (!analysis) return;
    const rows=[["=== KEYWORDS ==="],["Keyword","Count","Density"],...analysis.freqEntries.slice(0,200).map(([w,c])=>[w,c,((c/analysis.totalWords)*100).toFixed(2)]),
      [],[" === 2-WORD PHRASES ==="],["Phrase","Count"],...(analysis.phrases[2]||[]).slice(0,50).map(([p,c])=>[p,c]),
      [],["=== 3-WORD PHRASES ==="],["Phrase","Count"],...(analysis.phrases[3]||[]).slice(0,50).map(([p,c])=>[p,c]),
      [],["=== WH QUESTIONS ==="],["Question","Starter","Frequency","SEO Score"],...analysis.questions.slice(0,30).map(q=>[q.phrase,q.starter,q.freq,q.seoScore])];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="seo-full-report.csv";a.click();
  };
  const exportJSON = () => {
    if (!analysis) return;
    const data={summary:{totalWords:analysis.totalWords,uniqueWords:analysis.uniqueWords,characters:text.length,sentences:analysis.sentences,paragraphs:analysis.paragraphs,readability:analysis.readability,seoScore:analysis.seo.total,seoBreakdown:analysis.seo.breakdown},topKeywords:analysis.topKeywords,phrases:{bigrams:(analysis.phrases[2]||[]).slice(0,50),trigrams:(analysis.phrases[3]||[]).slice(0,50)},questions:analysis.questions.slice(0,30),intent:analysis.intent,entities:analysis.entities,structure:analysis.structure};
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="seo-analysis.json";a.click();
  };

  const wordCount = text ? tokenize(text).length : 0;

  const tabIcons = {frequency:"📊",longtail:"🔗",questions:"❓",nlp:"🧠",optimization:"⚡",eeat:"🛡️",ai:"🤖",highlighter:"🖍️",competitor:"🆚",structure:"🏗",linking:"⛓️",intent:"🎯",export:"💾"};

  const overviewBlock = analysis ? (
    <div style={{padding:"4px 16px 14px",borderBottom:`1px solid ${G.border}`}}>
      <div style={{fontSize:11,color:G.textHint,textTransform:"uppercase",letterSpacing:.8,marginBottom:10,fontWeight:700}}>Content Overview</div>
      {[
        {l:"Words",v:analysis.totalWords.toLocaleString(),c:G.blue},
        {l:"SEO Score",v:`${analysis.seo.total}/100`,c:scoreColor(analysis.seo.total)},
        {l:"Unique",v:analysis.uniqueWords.toLocaleString(),c:G.green},
        {l:"Readability",v:`${analysis.readability.score}/100`,c:analysis.readability.score>=60?G.green:analysis.readability.score>=40?G.yellow:G.red},
        {l:"Intent",v:analysis.intent[0]?.intent,c:G.purple},
      ].map(({l,v,c})=>(
        <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0"}}>
          <span style={{fontSize:12,color:G.textSec}}>{l}</span>
          <span style={{fontSize:12,fontWeight:700,color:c,textTransform:"capitalize"}}>{v}</span>
        </div>
      ))}
    </div>
  ) : null;

  const navButtons = (onPick) => TABS.map(t=>{
    const active=tab===t.id;
    return (
      <button key={t.id} onClick={()=>{setTab(t.id); if(onPick) onPick();}}
        style={{width:"100%",textAlign:"left",padding:"11px 16px",background:active?G.blueLight:"transparent",borderRadius:"0 999px 999px 0",border:"none",borderLeft:active?`3px solid ${G.blue}`:"3px solid transparent",cursor:"pointer",display:"flex",alignItems:"center",gap:12,color:active?G.blue:G.textSec,fontFamily:font,fontSize:14,fontWeight:active?700:500,marginRight:12}}
        onMouseEnter={e=>{if(!active)e.currentTarget.style.background=G.hover;}}
        onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
        <span style={{fontSize:18,lineHeight:1}}>{tabIcons[t.id]}</span>
        <span>{t.label}</span>
      </button>
    );
  });

  return (
    <div style={{fontFamily:font,background:G.bg,minHeight:"100vh",display:"flex",flexDirection:"column",color:G.text}}>
      
      {/* ── Responsive top bar ── */}
      <header style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:isMobile?"0 14px":"0 24px",display:"flex",alignItems:"center",gap:isMobile?8:16,height:isMobile?56:64,flexShrink:0,position:"sticky",top:0,zIndex:100}}>
        {isMobile && (
          <button aria-label="Open menu" onClick={()=>setDrawerOpen(true)} style={{background:"none",border:"none",padding:6,marginLeft:-6,cursor:"pointer",display:"flex",alignItems:"center",color:G.text}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
        )}
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <Logo size={isMobile?28:30}/>
          <div style={{display:"flex",flexDirection:"column",lineHeight:1.05}}>
            <Wordmark small={isMobile}/>
            {!isMobile && <span style={{fontSize:11,color:G.textHint,fontWeight:600,marginTop:3}}>Find the triggers that make content rank</span>}
          </div>
        </div>
        <div style={{flex:1}}/>
        {!isMobile && (
          <label style={{display:"flex",alignItems:"center",gap:7,fontSize:13,color:G.textSec,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}>
            <input type="checkbox" checked={filterStop} onChange={e=>setFilterStop(e.target.checked)} style={{accentColor:G.blue,width:16,height:16}}/>
            Filter stop words
          </label>
        )}
        {isMobile && wordCount>0 && <span style={{fontSize:12,color:G.textHint,fontWeight:700}}>{wordCount.toLocaleString()}w</span>}
      </header>

      {/* ── Mobile slide drawer ── */}
      {isMobile && drawerOpen && (
        <div onClick={()=>setDrawerOpen(false)} style={{position:"fixed",inset:0,background:"rgba(26,28,46,.45)",zIndex:200,display:"flex"}}>
          <nav onClick={e=>e.stopPropagation()} style={{width:282,maxWidth:"84%",height:"100%",background:G.surface,boxShadow:"2px 0 28px rgba(0,0,0,.2)",overflowY:"auto",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${G.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}><Logo size={28}/><Wordmark small/></div>
              <button aria-label="Close menu" onClick={()=>setDrawerOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:G.textSec,padding:4,display:"flex"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {overviewBlock}
            <div style={{padding:"8px 0"}}>{navButtons(()=>setDrawerOpen(false))}</div>
            <div style={{marginTop:"auto",padding:"14px 16px",borderTop:`1px solid ${G.border}`}}>
              <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:G.textSec,cursor:"pointer"}}>
                <input type="checkbox" checked={filterStop} onChange={e=>setFilterStop(e.target.checked)} style={{accentColor:G.blue,width:16,height:16}}/>
                Filter stop words
              </label>
            </div>
          </nav>
        </div>
      )}

      {/* ── Body ── */}
      <div style={{display:"flex",flex:1,minHeight:0,height:isMobile?"auto":"calc(100vh - 64px)",overflow:isMobile?"visible":"hidden"}}>

        {/* Desktop sidebar */}
        {!isMobile && (
          <nav style={{width:248,background:G.surface,borderRight:`1px solid ${G.border}`,flexShrink:0,overflowY:"auto",padding:"10px 0"}}>
            {overviewBlock}
            <div style={{padding:"6px 0"}}>{navButtons()}</div>
          </nav>
        )}

        {/* Main */}
        <main style={{flex:1,minWidth:0,overflowY:"auto",padding:isMobile?"12px 12px 96px":"20px 28px 40px",display:"flex",flexDirection:"column",gap:14}}>

          {/* Live dashboard — appears above editor once there's content */}
          {text.trim() && analysis && <Dashboard text={text} analysis={analysis} isMobile={isMobile} />}

          {/* Editor — always visible */}
          <div style={{position:"relative",background:G.surface,border:`1px solid ${G.border}`,borderRadius:16,boxShadow:G.shadowSm,padding:isMobile?14:18}}>
            <textarea
              value={text}
              onChange={e=>setText(e.target.value)}
              placeholder="Paste or write your content here..."
              style={{width:"100%",minHeight:isMobile?300:180,border:"none",outline:"none",resize:"vertical",fontFamily:font,fontSize:isMobile?16:15,lineHeight:1.6,color:G.text,background:"transparent",boxSizing:"border-box",display:"block"}}
            />
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,paddingTop:10,borderTop:`1px solid ${G.border}`,fontSize:12,color:G.textHint}}>
              <span>{wordCount.toLocaleString()} words · {text.length.toLocaleString()} chars</span>
              {text && <button onClick={()=>setText("")} style={{background:"none",border:"none",color:G.textSec,cursor:"pointer",fontSize:12,fontFamily:font,fontWeight:700}}>Clear</button>}
            </div>
          </div>

          {!text.trim() ? (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",gap:14,padding:isMobile?"28px 8px":"44px 16px"}}>
              <Logo size={56}/>
              <div style={{fontSize:isMobile?22:26,fontWeight:800,color:G.text,letterSpacing:-0.6,maxWidth:520}}>Stop just counting words.</div>
              <div style={{fontSize:isMobile?14:15,color:G.textSec,maxWidth:460,lineHeight:1.6}}>Find the SEO triggers that actually make content rank — keyword density, entities, search intent, and opportunities across 10 dimensions.</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginTop:6}}>
                {["Word Frequency","Long-tail","WH Questions","Intent","Gap Analysis"].map(f=>(<GChip key={f} color={G.blue}>{f}</GChip>))}
              </div>
            </div>
          ) : (
            <>
              {isMobile && (
                <div style={{display:"flex",gap:8,overflowX:"auto",padding:"2px 0 6px",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
                  {TABS.map(t=>{
                    const active=tab===t.id;
                    return (
                      <button key={t.id} onClick={()=>setTab(t.id)} style={{flexShrink:0,display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:999,border:`1px solid ${active?G.blue:G.border}`,background:active?G.blue:G.surface,color:active?"#fff":G.textSec,fontFamily:font,fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                        <span style={{fontSize:14}}>{tabIcons[t.id]}</span>{t.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <div ref={resultsRef} style={{scrollMarginTop:64,flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
                <TabRouter tab={tab} analysis={analysis} compText={compText} setCompText={setCompText} compAnalysis={compAnalysis} phraseLen={phraseLen} setPhraseLen={setPhraseLen} customN={customN} setCustomN={setCustomN} exportCSV={exportCSV} exportFullCSV={exportFullCSV} exportJSON={exportJSON} rawText={text} isMobile={isMobile} />
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Sticky mobile Analyze button ── */}
      {isMobile && text.trim() && (
        <button onClick={scrollToResults} style={{position:"fixed",left:12,right:12,bottom:12,zIndex:150,height:52,borderRadius:14,border:"none",background:`linear-gradient(135deg, ${G.blue}, #7c3aed)`,color:"#fff",fontFamily:font,fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:"0 6px 22px -4px rgba(79,70,229,.6)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>
          Analyze SEO
        </button>
      )}
    </div>
  );
}

function TabRouter(props) {
  const {tab}=props;
  if(tab==="frequency") return <FreqTab {...props}/>;
  if(tab==="longtail")  return <LongtailTab {...props}/>;
  if(tab==="questions") return <QuestionsTab {...props}/>;
  if(tab==="nlp")       return <NLPTab {...props}/>;
  if(tab==="optimization") return <OptTab {...props}/>;
  if(tab==="eeat")       return <EEATTab {...props}/>;
  if(tab==="ai")         return <AITab {...props}/>;
  if(tab==="linking")    return <LinkingTab {...props}/>;
  if(tab==="highlighter") return <HighlighterTab {...props}/>;
  if(tab==="competitor") return <CompTab {...props}/>;
  if(tab==="structure") return <StructTab {...props}/>;
  if(tab==="intent")    return <IntentTab {...props}/>;
  if(tab==="export")    return <ExportTab {...props}/>;
  return null;
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionTitle({children, sub}) {
  return (
    <div style={{marginBottom:16}}>
      <h2 style={{fontSize:16,fontWeight:500,color:G.text,margin:0}}>{children}</h2>
      {sub&&<p style={{fontSize:13,color:G.textSec,margin:"4px 0 0"}}>{sub}</p>}
    </div>
  );
}

// ── Readability helpers ────────────────────────────────────────────────────────
function getGradeLevel(fkScore) {
  if (fkScore >= 90) return { grade: "5th grade", color: G.green,  desc: "Very easy" };
  if (fkScore >= 80) return { grade: "6th grade", color: G.green,  desc: "Easy" };
  if (fkScore >= 70) return { grade: "7th grade", color: G.green,  desc: "Fairly easy" };
  if (fkScore >= 60) return { grade: "8–9th grade", color: G.blue, desc: "Standard" };
  if (fkScore >= 50) return { grade: "10–12th grade", color: G.yellow, desc: "Fairly hard" };
  if (fkScore >= 30) return { grade: "College", color: G.yellow, desc: "Difficult" };
  return { grade: "Post-grad", color: G.red, desc: "Very difficult" };
}

function getSentenceData(text) {
  const raw = text.match(/[^.!?]+[.!?]*/g) || [];
  return raw.map(s => {
    const clean = s.trim();
    const wc = clean.split(/\s+/).filter(Boolean).length;
    const isVeryHard = wc >= 30;
    const isHard     = wc >= 20 && wc < 30;
    const isPassive  = /\b(am|is|are|was|were|be|been|being)\s+\w+ed\b/i.test(clean);
    return { text: clean, wc, isVeryHard, isHard, isPassive };
  });
}

function getAdverbs(text) {
  const words = text.match(/\b\w+ly\b/gi) || [];
  const counts = {};
  words.forEach(w => { const k=w.toLowerCase(); counts[k]=(counts[k]||0)+1; });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
}

// ── Content Highlighter ────────────────────────────────────────────────────────
function HighlighterTab({analysis, rawText, isMobile}) {
  const [mode, setMode] = useState("seo"); // "seo" | "readability" | "both"

  // ── SEO constants ──
  const STUFFING = 1.5, OVERUSED = 1.0, HIGH = 0.5;

  const hotKeywords = useMemo(() => {
    if (!analysis) return new Map();
    const map = new Map();
    analysis.freqEntries.forEach(([word, count]) => {
      const d = (count / analysis.totalWords) * 100;
      if (d >= HIGH) map.set(word, d);
    });
    return map;
  }, [analysis]);

  const stuffingKw = [...hotKeywords.entries()].filter(([,d])=>d>=STUFFING).sort((a,b)=>b[1]-a[1]);
  const overusedKw = [...hotKeywords.entries()].filter(([,d])=>d>=OVERUSED&&d<STUFFING).sort((a,b)=>b[1]-a[1]);
  const highKw     = [...hotKeywords.entries()].filter(([,d])=>d>=HIGH&&d<OVERUSED).sort((a,b)=>b[1]-a[1]);

  // ── Readability data ──
  const sentenceData = useMemo(() => getSentenceData(rawText), [rawText]);
  const adverbs      = useMemo(() => getAdverbs(rawText), [rawText]);
  const veryHardSents = sentenceData.filter(s=>s.isVeryHard);
  const hardSents     = sentenceData.filter(s=>s.isHard);
  const passiveSents  = sentenceData.filter(s=>s.isPassive);
  const gradeInfo     = getGradeLevel(analysis.readability.score);

  // ── Render: SEO highlights ──
  const renderSEO = useMemo(() => {
    if (!rawText || hotKeywords.size === 0) return rawText;
    const words = [...hotKeywords.keys()].sort((a,b)=>b.length-a.length);
    const escaped = words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const regex = new RegExp(`\\b(${escaped.join('|')})\\b`,'gi');
    const parts=[]; let last=0, k=0; let m;
    regex.lastIndex=0;
    while((m=regex.exec(rawText))!==null){
      if(m.index>last) parts.push(<span key={k++}>{rawText.slice(last,m.index)}</span>);
      const d=hotKeywords.get(m[0].toLowerCase())||0;
      const st = d>=STUFFING ? {background:"#fce8e6",color:"#c5221f",borderBottom:"2px solid #d93025"}
               : d>=OVERUSED ? {background:"#fef7e0",color:"#b06000",borderBottom:"2px solid #f9ab00"}
               :               {background:"#e8f0fe",color:"#1557b0",borderBottom:"2px solid #1a73e8"};
      parts.push(<mark key={k++} title={`${d.toFixed(2)}% density`} style={{...st,borderRadius:3,padding:"1px 4px",cursor:"help",fontWeight:600}}>{m[0]}</mark>);
      last=m.index+m[0].length;
    }
    if(last<rawText.length) parts.push(<span key={k++}>{rawText.slice(last)}</span>);
    return parts;
  }, [rawText, hotKeywords]);

  // ── Render: Readability highlights (sentence-level) ──
  const renderReadability = useMemo(() => {
    if (!rawText) return rawText;
    const sentences = rawText.match(/[^.!?\n]+[.!?]*/g) || [];
    const parts=[]; let remaining=rawText; let k=0;
    sentences.forEach(sent => {
      const idx = remaining.indexOf(sent);
      if(idx>0) { parts.push(<span key={k++}>{remaining.slice(0,idx)}</span>); }
      const clean=sent.trim();
      const wc=clean.split(/\s+/).filter(Boolean).length;
      const isVH=wc>=30;
      const isH=wc>=20&&wc<30;
      const isPas=/\b(am|is|are|was|were|be|been|being)\s+\w+ed\b/i.test(clean);
      // adverb spans inside sentence
      const advRegex=/\b(\w+ly)\b/gi;
      let advParts=[]; let aLast=0; let aK=0; let aM;
      advRegex.lastIndex=0;
      const sentStr=sent;
      while((aM=advRegex.exec(sentStr))!==null){
        if(aM.index>aLast) advParts.push(<span key={`a${aK++}`}>{sentStr.slice(aLast,aM.index)}</span>);
        advParts.push(<mark key={`a${aK++}`} title="Adverb — consider removing" style={{background:"#e8d5f5",color:"#6a1b9a",borderBottom:"2px solid #7b1fa2",borderRadius:3,padding:"1px 3px",cursor:"help"}}>{aM[0]}</mark>);
        aLast=aM.index+aM[0].length;
      }
      if(aLast<sentStr.length) advParts.push(<span key={`a${aK++}`}>{sentStr.slice(aLast)}</span>);

      const sentBg = isVH ? {background:"#fce8e6",borderRadius:3,padding:"2px 0"}
                   : isH  ? {background:"#fff3e0",borderRadius:3,padding:"2px 0"}
                   : isPas? {background:"#e8f5e9",borderRadius:3,padding:"2px 0"}
                   : {};
      const sentTitle = isVH?"Very hard sentence (30+ words)" : isH?"Hard sentence (20–29 words)" : isPas?"Passive voice detected" : "";
      parts.push(
        <span key={k++} title={sentTitle||undefined} style={{...sentBg,cursor:sentTitle?"help":undefined}}>
          {advParts.length>0 ? advParts : sent}
        </span>
      );
      remaining=remaining.slice(idx+sent.length);
    });
    if(remaining) parts.push(<span key={k++}>{remaining}</span>);
    return parts;
  }, [rawText]);

  // ── Render: Both combined ──
  const renderBoth = useMemo(() => {
    if (!rawText) return rawText;
    // Apply sentence-level bg first, then keyword marks on top
    const sentences = rawText.match(/[^.!?\n]+[.!?]*/g)||[];
    const parts=[]; let remaining=rawText; let k=0;
    sentences.forEach(sent=>{
      const idx=remaining.indexOf(sent);
      if(idx>0) parts.push(<span key={k++}>{remaining.slice(0,idx)}</span>);
      const wc=sent.trim().split(/\s+/).filter(Boolean).length;
      const isVH=wc>=30, isH=wc>=20&&wc<30;
      const isPas=/\b(am|is|are|was|were|be|been|being)\s+\w+ed\b/i.test(sent);
      const sentBg=isVH?"#fce8e6":isH?"#fff3e0":isPas?"#e8f5e9":"transparent";
      // Inside each sentence, highlight keywords
      const kwRegex=hotKeywords.size>0?new RegExp(`\\b(${[...hotKeywords.keys()].sort((a,b)=>b.length-a.length).map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})\\b`,'gi'):null;
      if(kwRegex){
        const sParts=[]; let sLast=0; let sK=0; let sM;
        kwRegex.lastIndex=0;
        while((sM=kwRegex.exec(sent))!==null){
          if(sM.index>sLast) sParts.push(<span key={`s${sK++}`}>{sent.slice(sLast,sM.index)}</span>);
          const d=hotKeywords.get(sM[0].toLowerCase())||0;
          const kst=d>=STUFFING?{background:"#fca5a5",color:"#7f1d1d",border:"1px solid #ef4444"}
                   :d>=OVERUSED?{background:"#fde68a",color:"#78350f",border:"1px solid #f59e0b"}
                   :            {background:"#93c5fd",color:"#1e3a5f",border:"1px solid #3b82f6"};
          sParts.push(<mark key={`s${sK++}`} title={`${d.toFixed(2)}% density`} style={{...kst,borderRadius:3,padding:"1px 4px",cursor:"help",fontWeight:700}}>{sM[0]}</mark>);
          sLast=sM.index+sM[0].length;
        }
        if(sLast<sent.length) sParts.push(<span key={`s${sK++}`}>{sent.slice(sLast)}</span>);
        parts.push(<span key={k++} style={{background:sentBg,borderRadius:3,padding:"2px 0"}}>{sParts}</span>);
      } else {
        parts.push(<span key={k++} style={{background:sentBg,borderRadius:3}}>{sent}</span>);
      }
      remaining=remaining.slice(idx+sent.length);
    });
    if(remaining) parts.push(<span key={k++}>{remaining}</span>);
    return parts;
  }, [rawText, hotKeywords]);

  const rendered = mode==="seo" ? renderSEO : mode==="readability" ? renderReadability : renderBoth;

  // ── Legend chips for each mode ──
  const legends = {
    seo:[
      {color:"#c5221f",bg:"#fce8e6",label:`🔴 Stuffing >1.5% (${stuffingKw.length})`},
      {color:"#b06000",bg:"#fef7e0",label:`🟡 Overused >1% (${overusedKw.length})`},
      {color:"#1557b0",bg:"#e8f0fe",label:`🔵 High >0.5% (${highKw.length})`},
    ],
    readability:[
      {color:"#c5221f",bg:"#fce8e6",label:`🔴 Very hard (${veryHardSents.length})`},
      {color:"#b06000",bg:"#fff3e0",label:`🟠 Hard (${hardSents.length})`},
      {color:"#1b5e20",bg:"#e8f5e9",label:`🟢 Passive voice (${passiveSents.length})`},
      {color:"#6a1b9a",bg:"#e8d5f5",label:`🟣 Adverbs (${adverbs.length})`},
    ],
    both:[
      {color:"#c5221f",bg:"#fce8e6",label:"🔴 Very hard / stuffing"},
      {color:"#b06000",bg:"#fff3e0",label:"🟠 Hard sentence"},
      {color:"#1b5e20",bg:"#e8f5e9",label:"🟢 Passive voice"},
      {color:"#1e3a5f",bg:"#93c5fd",label:"🔵 Keyword density"},
    ],
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:10,flex:1,minHeight:0,height:"100%"}}>

      {/* ── Mode toggle + legend ── */}
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
        {[
          {id:"seo",        label:"🔑 SEO Mode"},
          {id:"readability",label:"📖 Readability Mode"},
          {id:"both",       label:"⚡ Both Combined"},
        ].map(m=>(
          <button key={m.id} onClick={()=>setMode(m.id)}
            style={{padding:"7px 18px",borderRadius:999,border:`2px solid ${mode===m.id?G.blue:G.border}`,background:mode===m.id?G.blue:"#fff",color:mode===m.id?"#fff":G.textSec,fontFamily:font,fontSize:13,fontWeight:500,cursor:"pointer",transition:"all .15s"}}>
            {m.label}
          </button>
        ))}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginLeft:8}}>
          {legends[mode].map(l=>(
            <span key={l.label} style={{background:l.bg,color:l.color,borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:500,border:`1px solid ${l.color}33`}}>{l.label}</span>
          ))}
        </div>
      </div>

      {/* ── Split screen ── */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,flex:1,height:isMobile?"auto":"calc(100vh - 230px)",minHeight:isMobile?0:500}}>

        {/* LEFT — highlighted text */}
        <div style={{display:"flex",flexDirection:"column",border:`1px solid ${G.border}`,borderRadius:8,background:"#fff",overflow:"hidden",boxShadow:G.shadowSm,height:isMobile?440:"auto"}}>
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,background:G.bg,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <span style={{fontSize:13,fontWeight:500,color:G.textSec}}>📄 Your content</span>
            <span style={{fontSize:11,color:G.textHint}}>Hover highlights for details</span>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"20px 24px",fontSize:14,lineHeight:2.1,color:G.text,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"Georgia,'Times New Roman',serif"}}>
            {rendered}
          </div>
        </div>

        {/* RIGHT — overview panel */}
        <div style={{overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>

          {/* Grade level card */}
          <div style={{background:"#fff",border:`2px solid ${gradeInfo.color}44`,borderRadius:10,padding:"14px 18px",boxShadow:G.shadowSm,display:"flex",alignItems:"center",gap:16}}>
            <div style={{background:gradeInfo.color+"18",borderRadius:8,padding:"10px 14px",textAlign:"center",minWidth:80}}>
              <div style={{fontSize:22,fontWeight:700,color:gradeInfo.color}}>{analysis.readability.score}</div>
              <div style={{fontSize:10,color:gradeInfo.color,fontWeight:500}}>FK Score</div>
            </div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:G.text}}>{gradeInfo.grade}</div>
              <div style={{fontSize:12,color:gradeInfo.color,fontWeight:500}}>{gradeInfo.desc}</div>
              <div style={{fontSize:11,color:G.textHint,marginTop:3}}>Avg {analysis.readability.avgWords} words/sentence</div>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {l:"Total words",   v:analysis.totalWords.toLocaleString(), c:G.blue},
              {l:"Sentences",     v:sentenceData.length,                  c:G.textSec},
              {l:"Hard sentences",v:hardSents.length+veryHardSents.length,c:G.yellow},
              {l:"Passive voice", v:passiveSents.length,                  c:G.green},
              {l:"Adverbs (-ly)", v:adverbs.length,                       c:"#7b1fa2"},
              {l:"Stuffing words",v:stuffingKw.length,                    c:G.red},
            ].map(({l,v,c})=>(
              <div key={l} style={{background:"#fff",border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 12px",boxShadow:G.shadowSm}}>
                <div style={{fontSize:10,color:G.textSec,fontWeight:500,marginBottom:3}}>{l}</div>
                <div style={{fontSize:20,fontWeight:700,color:c}}>{v}</div>
              </div>
            ))}
          </div>

          {/* SEO stuffing list */}
          {mode!=="readability" && stuffingKw.length>0 && (
            <div style={{background:"#fff",border:"1px solid #d9302533",borderRadius:8,overflow:"hidden",boxShadow:G.shadowSm}}>
              <div style={{padding:"8px 14px",background:"#fce8e6",fontSize:12,fontWeight:600,color:"#c5221f"}}>🔴 Keyword stuffing — above 1.5%</div>
              <div style={{maxHeight:140,overflowY:"auto"}}>
                {stuffingKw.map(([w,d],i)=>(
                  <div key={w} style={{display:"flex",justifyContent:"space-between",padding:"6px 14px",borderTop:`1px solid ${G.border}`,background:i%2===0?"#fff":"#fafafa"}}>
                    <span style={{background:"#fce8e6",color:"#c5221f",borderRadius:999,padding:"2px 9px",fontSize:12,fontWeight:500}}>{w}</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#d93025"}}>{d.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overused list */}
          {mode!=="readability" && overusedKw.length>0 && (
            <div style={{background:"#fff",border:"1px solid #f9ab0033",borderRadius:8,overflow:"hidden",boxShadow:G.shadowSm}}>
              <div style={{padding:"8px 14px",background:"#fef7e0",fontSize:12,fontWeight:600,color:"#b06000"}}>🟡 Overused — 1% to 1.5%</div>
              <div style={{maxHeight:120,overflowY:"auto"}}>
                {overusedKw.map(([w,d],i)=>(
                  <div key={w} style={{display:"flex",justifyContent:"space-between",padding:"6px 14px",borderTop:`1px solid ${G.border}`,background:i%2===0?"#fff":"#fafafa"}}>
                    <span style={{background:"#fef7e0",color:"#b06000",borderRadius:999,padding:"2px 9px",fontSize:12,fontWeight:500}}>{w}</span>
                    <span style={{fontSize:12,fontWeight:700,color:"#f9ab00"}}>{d.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hard sentences */}
          {mode!=="seo" && veryHardSents.length>0 && (
            <div style={{background:"#fff",border:"1px solid #d9302533",borderRadius:8,overflow:"hidden",boxShadow:G.shadowSm}}>
              <div style={{padding:"8px 14px",background:"#fce8e6",fontSize:12,fontWeight:600,color:"#c5221f"}}>🔴 Very hard sentences (30+ words)</div>
              <div style={{maxHeight:130,overflowY:"auto"}}>
                {veryHardSents.map((s,i)=>(
                  <div key={i} style={{padding:"7px 14px",borderTop:`1px solid ${G.border}`,fontSize:12,color:G.text,lineHeight:1.6}}>
                    "{s.text.slice(0,80)}{s.text.length>80?"…":""}" <span style={{color:G.textHint}}>({s.wc} words)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Passive voice */}
          {mode!=="seo" && passiveSents.length>0 && (
            <div style={{background:"#fff",border:"1px solid #1e8e3e33",borderRadius:8,overflow:"hidden",boxShadow:G.shadowSm}}>
              <div style={{padding:"8px 14px",background:"#e8f5e9",fontSize:12,fontWeight:600,color:"#1b5e20"}}>🟢 Passive voice ({passiveSents.length})</div>
              <div style={{maxHeight:120,overflowY:"auto"}}>
                {passiveSents.slice(0,5).map((s,i)=>(
                  <div key={i} style={{padding:"7px 14px",borderTop:`1px solid ${G.border}`,fontSize:12,color:G.text,lineHeight:1.6}}>
                    "{s.text.slice(0,80)}{s.text.length>80?"…":""}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adverbs */}
          {mode!=="seo" && adverbs.length>0 && (
            <div style={{background:"#fff",border:"1px solid #7b1fa233",borderRadius:8,overflow:"hidden",boxShadow:G.shadowSm}}>
              <div style={{padding:"8px 14px",background:"#e8d5f5",fontSize:12,fontWeight:600,color:"#6a1b9a"}}>🟣 Adverbs (-ly words) — {adverbs.length} unique</div>
              <div style={{padding:"10px 14px",display:"flex",flexWrap:"wrap",gap:6,maxHeight:110,overflowY:"auto"}}>
                {adverbs.slice(0,20).map(([w,c])=>(
                  <span key={w} style={{background:"#e8d5f5",color:"#6a1b9a",borderRadius:999,padding:"2px 9px",fontSize:11,fontWeight:500}}>{w} ({c}×)</span>
                ))}
              </div>
            </div>
          )}

          {/* Guide */}
          <div style={{background:"#e6f4ea",border:"1px solid #1e8e3e33",borderRadius:8,padding:"12px 14px"}}>
            <div style={{fontSize:11,fontWeight:600,color:G.green,marginBottom:6}}>✅ Ideal targets</div>
            <div style={{fontSize:11,color:G.textSec,lineHeight:1.9}}>
              <div>🔑 Keyword density &lt;1.5% per word</div>
              <div>📖 Flesch score &gt;60 (8th grade)</div>
              <div>📝 Sentences &lt;20 words on average</div>
              <div>🟢 Passive voice &lt;10% of sentences</div>
              <div>🟣 Adverbs — use sparingly</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── 1. Frequency ───────────────────────────────────────────────────────────────
function FreqTab({analysis}) {
  const {freqEntries,totalWords,uniqueWords}=analysis;
  const [page,setPage]=useState(0); const PS=30;
  const maxC=freqEntries[0]?.[1]||1;
  const paged=freqEntries.slice(page*PS,(page+1)*PS);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Ranked by frequency with keyword density percentage">Word frequency analysis</SectionTitle>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <GStat label="Total words" value={totalWords.toLocaleString()} icon="📝" color={G.blue}/>
        <GStat label="Unique words" value={uniqueWords.toLocaleString()} icon="🔤" color={G.green}/>
        <GStat label="Vocabulary richness" value={((uniqueWords/totalWords)*100).toFixed(1)+"%"} icon="📈" color={G.purple} sub="unique ÷ total"/>
        <GStat label="Top keyword" value={freqEntries[0]?.[0]||"—"} icon="🏆" color={G.yellow} sub={`${freqEntries[0]?.[1]||0} occurrences`}/>
      </div>
      <GCard padding={0}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,fontWeight:500,color:G.textSec}}>Keyword density table</span>
          <span style={{fontSize:12,color:G.textHint}}>Showing {page*PS+1}–{Math.min((page+1)*PS,freqEntries.length)} of {freqEntries.length.toLocaleString()}</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:G.bg}}>
                {["#","Keyword","Count","Density","Distribution"].map(h=>(
                  <th key={h} style={{padding:"10px 16px",fontSize:12,fontWeight:500,color:G.textSec,textAlign:h==="#"||h==="Count"||h==="Density"?"center":"left",borderBottom:`1px solid ${G.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(([word,count],i)=>{
                const d=((count/totalWords)*100).toFixed(2);
                const hi=parseFloat(d)>3;
                const color=parseFloat(d)>5?G.red:parseFloat(d)>3?G.yellow:G.blue;
                return (
                  <tr key={word} style={{borderBottom:`1px solid ${G.border}`,background:i%2===0?G.surface:"#fafafa"}}>
                    <td style={{padding:"9px 16px",fontSize:12,color:G.textHint,textAlign:"center"}}>{page*PS+i+1}</td>
                    <td style={{padding:"9px 16px",fontSize:14}}><span style={{background:hi?G.yellowLight:G.blueLight,color:hi?G.yellow:G.blue,padding:"2px 10px",borderRadius:999,fontSize:13,fontWeight:500}}>{word}</span></td>
                    <td style={{padding:"9px 16px",fontSize:13,color:G.text,textAlign:"center",fontWeight:500}}>{count}</td>
                    <td style={{padding:"9px 16px",textAlign:"center"}}><span style={{color,fontWeight:600,fontSize:13}}>{d}%</span></td>
                    <td style={{padding:"9px 24px 9px 16px"}}><GBar value={count} max={maxC} color={color}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:"12px 16px",borderTop:`1px solid ${G.border}`,display:"flex",gap:8}}>
          {[["← Previous",()=>setPage(p=>Math.max(0,p-1)),page===0],["Next →",()=>setPage(p=>p+1),(page+1)*PS>=freqEntries.length]].map(([label,action,disabled])=>(
            <button key={label} onClick={action} disabled={disabled}
              style={{padding:"6px 16px",background:disabled?"transparent":G.blue,color:disabled?G.textHint:"#fff",border:`1px solid ${disabled?G.border:G.blue}`,borderRadius:4,cursor:disabled?"default":"pointer",fontSize:13,fontFamily:font,fontWeight:500,opacity:disabled?.5:1}}>
              {label}
            </button>
          ))}
        </div>
      </GCard>
    </div>
  );
}

// ── 2. Long-tail ───────────────────────────────────────────────────────────────
function LongtailTab({analysis,phraseLen,setPhraseLen,customN,setCustomN}) {
  const [page,setPage]=useState(0); const PS=25;
  const activeN=phraseLen==="custom"?customN:phraseLen;
  const phrases=analysis.phrases[activeN]||[];
  const maxC=phrases[0]?.[1]||1;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Multi-word keyword phrases ranked by frequency">Long-tail keyword phrases</SectionTitle>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:13,color:G.textSec,fontWeight:500}}>Phrase length:</span>
        {[2,3,4,5,6,"custom"].map(n=>(
          <GChip key={n} active={phraseLen===n} onClick={()=>{setPhraseLen(n);setPage(0);}} color={G.blue}>
            {n==="custom"?"Custom":`${n}-word`}
          </GChip>
        ))}
        {phraseLen==="custom"&&(
          <input type="number" min={2} max={10} value={customN}
            onChange={e=>setCustomN(Math.max(2,Math.min(10,parseInt(e.target.value)||2)))}
            style={{width:64,padding:"6px 10px",border:`1px solid ${G.border}`,borderRadius:4,fontFamily:font,fontSize:13,color:G.text,outline:"none"}}/>
        )}
        <GBadge color={G.blue}>{phrases.length} phrases</GBadge>
      </div>
      <GCard padding={0}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:13,fontWeight:500,color:G.textSec}}>{activeN}-word phrases</span>
          <span style={{fontSize:12,color:G.textHint}}>Showing {page*PS+1}–{Math.min((page+1)*PS,phrases.length)} of {phrases.length}</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:G.bg}}>{["#","Phrase","Count","Frequency"].map(h=>(
              <th key={h} style={{padding:"10px 16px",fontSize:12,fontWeight:500,color:G.textSec,textAlign:"left",borderBottom:`1px solid ${G.border}`}}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {phrases.slice(page*PS,(page+1)*PS).map(([phrase,count],i)=>(
                <tr key={phrase} style={{borderBottom:`1px solid ${G.border}`,background:i%2===0?G.surface:"#fafafa"}}>
                  <td style={{padding:"9px 16px",fontSize:12,color:G.textHint,width:40}}>{page*PS+i+1}</td>
                  <td style={{padding:"9px 16px",fontSize:13,color:G.text,fontWeight:500}}>{phrase}</td>
                  <td style={{padding:"9px 16px",fontSize:13,color:G.blue,fontWeight:500,width:80}}>{count}×</td>
                  <td style={{padding:"9px 24px 9px 0",width:200}}><GBar value={count} max={maxC} color={G.blue}/></td>
                </tr>
              ))}
              {phrases.length===0&&<tr><td colSpan={4} style={{padding:32,textAlign:"center",fontSize:13,color:G.textHint}}>No {activeN}-word phrases found. Add more content.</td></tr>}
            </tbody>
          </table>
        </div>
        {phrases.length>PS&&(
          <div style={{padding:"12px 16px",borderTop:`1px solid ${G.border}`,display:"flex",gap:8}}>
            {[["← Previous",()=>setPage(p=>Math.max(0,p-1)),page===0],["Next →",()=>setPage(p=>p+1),(page+1)*PS>=phrases.length]].map(([label,action,disabled])=>(
              <button key={label} onClick={action} disabled={disabled} style={{padding:"6px 16px",background:disabled?"transparent":G.blue,color:disabled?G.textHint:"#fff",border:`1px solid ${disabled?G.border:G.blue}`,borderRadius:4,cursor:disabled?"default":"pointer",fontSize:13,fontFamily:font,fontWeight:500,opacity:disabled?.5:1}}>{label}</button>
            ))}
          </div>
        )}
      </GCard>
    </div>
  );
}

// ── 3. Questions ───────────────────────────────────────────────────────────────
function QuestionsTab({analysis}) {
  const {questions}=analysis;
  const [filter,setFilter]=useState("all");
  const starters=["all",...new Set(questions.map(q=>q.starter))];
  const filtered=filter==="all"?questions:questions.filter(q=>q.starter===filter);
  const scoreColor=s=>s>=80?G.green:s>=50?G.yellow:G.red;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="WH-type questions with SEO opportunity scores">Question phrases detected</SectionTitle>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:13,color:G.textSec,fontWeight:500}}>Filter by starter:</span>
        {starters.map(s=>(
          <GChip key={s} active={filter===s} onClick={()=>setFilter(s)} color={G.teal} bg={G.tealLight}>{s}</GChip>
        ))}
        <GBadge color={G.teal} bg={G.tealLight}>{filtered.length} questions</GBadge>
      </div>
      {filtered.length===0?(
        <GCard>
          <div style={{textAlign:"center",padding:32,color:G.textHint,fontSize:13}}>No question-type phrases found. Add WH-questions to improve SEO coverage and featured snippet opportunities.</div>
        </GCard>
      ):(
        <GCard padding={0}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:G.bg}}>{["Question phrase","Starter","Frequency","SEO Opportunity"].map(h=>(
                <th key={h} style={{padding:"10px 16px",fontSize:12,fontWeight:500,color:G.textSec,textAlign:"left",borderBottom:`1px solid ${G.border}`}}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {filtered.map((q,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${G.border}`,background:i%2===0?G.surface:"#fafafa"}}>
                    <td style={{padding:"10px 16px",fontSize:13,color:G.text,textTransform:"capitalize",maxWidth:360}}>{q.phrase}</td>
                    <td style={{padding:"10px 16px"}}><GBadge color={G.teal} bg={G.tealLight}>{q.starter}</GBadge></td>
                    <td style={{padding:"10px 16px",fontSize:13,color:G.textSec}}>{q.freq}×</td>
                    <td style={{padding:"10px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{color:scoreColor(q.seoScore),fontWeight:600,fontSize:14,minWidth:28}}>{q.seoScore}</span>
                        <GBar value={q.seoScore} max={100} color={scoreColor(q.seoScore)}/>
                        <GBadge color={scoreColor(q.seoScore)} bg={scoreColor(q.seoScore)+"15"}>{q.seoScore>=80?"High":q.seoScore>=50?"Medium":"Low"}</GBadge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GCard>
      )}
      <GCard style={{background:G.blueLight,border:`1px solid ${G.blue}22`}} padding="12px 16px">
        <div style={{fontSize:13,color:G.blue,fontWeight:500,marginBottom:4}}>💡 SEO opportunity scoring</div>
        <div style={{fontSize:12,color:G.textSec}}>Score = frequency × 20 + phrase length × 8. Longer, more-repeated question phrases score higher and have greater featured snippet potential.</div>
      </GCard>
    </div>
  );
}

// ── 4. NLP ─────────────────────────────────────────────────────────────────────
function NLPTab({analysis,isMobile}) {
  const {entities,clusters,lsi}=analysis;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Entity extraction, topic clustering, and semantic keyword opportunities">NLP analysis</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
        {[
          {label:"📍 Locations",data:entities.locations,color:G.green,bg:G.greenLight},
          {label:"👤 Roles & job titles",data:entities.roles,color:G.blue,bg:G.blueLight},
          {label:"🏭 Industries",data:entities.industries,color:G.yellow,bg:G.yellowLight},
          {label:"🏷️ Brands & proper nouns",data:entities.brands,color:G.purple,bg:G.purpleLight},
        ].map(({label,data,color,bg})=>(
          <GCard key={label} padding={0} style={{overflow:"hidden"}}>
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>{label}</div>
            <div style={{maxHeight:200,overflowY:"auto"}}>
              {data.length===0?<div style={{padding:"12px 16px",fontSize:12,color:G.textHint}}>None detected</div>:
                data.slice(0,10).map((item,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 16px",borderBottom:i<data.length-1?`1px solid ${G.border}`:"none"}}>
                    <span style={{fontSize:13,color:G.text,textTransform:"capitalize"}}>{item.word}</span>
                    <GBadge color={color} bg={bg}>{item.count}×</GBadge>
                  </div>
                ))
              }
            </div>
          </GCard>
        ))}
      </div>
      <GCard padding={0}>
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>🧩 Topic clusters (semantic groups)</div>
        <div style={{padding:16,display:"flex",flexWrap:"wrap",gap:10}}>
          {clusters.map(({stem,words},i)=>(
            <div key={i} style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:8,padding:"8px 12px"}}>
              <div style={{fontSize:11,color:G.textHint,marginBottom:6,fontWeight:500}}>~{stem}*</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {words.slice(0,6).map(w=><GBadge key={w} color={G.green} bg={G.greenLight}>{w}</GBadge>)}
              </div>
            </div>
          ))}
          {clusters.length===0&&<span style={{fontSize:13,color:G.textHint}}>No clusters found. Add more varied content.</span>}
        </div>
      </GCard>
      <GCard padding={0}>
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>🔗 LSI & semantic keyword suggestions</div>
        <div style={{padding:"8px 0"}}>
          {lsi.map(({keyword,related},i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 16px",borderBottom:i<lsi.length-1?`1px solid ${G.border}`:"none"}}>
              <span style={{fontSize:13,fontWeight:500,color:G.blue,minWidth:100}}>{keyword}</span>
              <span style={{color:G.border}}>→</span>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {related.map(r=><GBadge key={r} color={G.blue} bg={G.blueLight}>{r}</GBadge>)}
              </div>
            </div>
          ))}
        </div>
      </GCard>
    </div>
  );
}

// ── 5. Optimization ────────────────────────────────────────────────────────────
function OptTab({analysis,isMobile}) {
  const {topKeywords,overused,stuffing,readability,seo}=analysis;
  const rdColor=readability.score>=60?G.green:readability.score>=40?G.yellow:G.red;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Keyword density health, stuffing warnings, and readability">Content optimization</SectionTitle>

      {/* SEO Score breakdown */}
      <GCard padding={0}>
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${G.border}`,display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:52,height:52,borderRadius:12,flexShrink:0,background:scoreColor(seo.total)+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:scoreColor(seo.total)}}>{seo.total}</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:G.text}}>SEO Score · {scoreLabel(seo.total)}</div>
            <div style={{fontSize:12,color:G.textSec,marginTop:2}}>Weighted across 8 ranking factors (out of 100)</div>
          </div>
        </div>
        <div style={{padding:"6px 16px 12px"}}>
          {seo.breakdown.map(b=>{
            const pct=b.score/b.max;
            const c=pct>=0.75?G.green:pct>=0.4?G.yellow:G.red;
            return (
              <div key={b.label} style={{display:"flex",alignItems:"center",gap:12,padding:"7px 0"}}>
                <span style={{fontSize:13,color:G.text,width:isMobile?120:160,flexShrink:0}}>{b.label}</span>
                <GBar value={b.score} max={b.max} color={c} height={7}/>
                <span style={{fontSize:12,fontWeight:700,color:c,width:46,textAlign:"right",flexShrink:0}}>{Math.round(b.score)}/{b.max}</span>
              </div>
            );
          })}
        </div>
      </GCard>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"240px 1fr",gap:16}}>
        <GCard style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}} padding={24}>
          <div style={{fontSize:12,color:G.textSec,fontWeight:500,textAlign:"center",marginBottom:4}}>Flesch-Kincaid Readability</div>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke={G.border} strokeWidth="10"/>
            <circle cx="50" cy="50" r="40" fill="none" stroke={rdColor} strokeWidth="10"
              strokeDasharray={`${(readability.score/100)*251} 251`} strokeLinecap="round"
              transform="rotate(-90 50 50)"/>
            <text x="50" y="46" textAnchor="middle" fontSize="20" fontWeight="700" fill={G.text} fontFamily={font}>{readability.score}</text>
            <text x="50" y="62" textAnchor="middle" fontSize="10" fill={G.textSec} fontFamily={font}>{readability.label}</text>
          </svg>
          <div style={{fontSize:12,color:G.textSec,textAlign:"center"}}>Avg {readability.avgWords} words/sentence</div>
          <div style={{fontSize:12,color:G.textSec}}>Avg {readability.avgSyl} syllables/word</div>
        </GCard>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <GCard padding={0} style={{border:`1px solid ${stuffing.length?G.red+"55":G.border}`}}>
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:stuffing.length?G.red:G.green}}>
              {stuffing.length?"🚨 Keyword stuffing risk (>5%)":"✅ No keyword stuffing detected"}
            </div>
            <div style={{padding:"8px 0",maxHeight:130,overflowY:"auto"}}>
              {stuffing.length===0?<div style={{padding:"8px 16px",fontSize:13,color:G.green}}>All keywords within safe density thresholds.</div>:
                stuffing.map((k,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 16px",borderBottom:`1px solid ${G.border}`}}>
                    <span style={{fontSize:13,color:G.text}}>{k.word}</span>
                    <GBadge color={G.red} bg={G.redLight}>{k.density}%</GBadge>
                  </div>
                ))
              }
            </div>
          </GCard>
          <GCard padding={0} style={{border:`1px solid ${overused.length?G.yellow+"55":G.border}`}}>
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:overused.length?G.yellow:G.textSec}}>
              {overused.length?"⚠️ Overused keywords (>3%)":"✅ Keyword density looks healthy"}
            </div>
            <div style={{padding:"8px 0",maxHeight:130,overflowY:"auto"}}>
              {overused.length===0?<div style={{padding:"8px 16px",fontSize:13,color:G.green}}>No overused keywords.</div>:
                overused.map((k,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 16px",borderBottom:`1px solid ${G.border}`}}>
                    <span style={{fontSize:13,color:G.text}}>{k.word}</span>
                    <GBadge color={G.yellow} bg={G.yellowLight}>{k.density}%</GBadge>
                  </div>
                ))
              }
            </div>
          </GCard>
        </div>
      </div>
      <GCard padding={0}>
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>Top 20 keywords — density analysis</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:G.bg}}>{["#","Keyword","Count","Density","Distribution"].map(h=>(
              <th key={h} style={{padding:"9px 16px",fontSize:12,fontWeight:500,color:G.textSec,textAlign:"left",borderBottom:`1px solid ${G.border}`}}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {topKeywords.map((k,i)=>{
                const d=parseFloat(k.density);
                const color=d>5?G.red:d>3?G.yellow:d>1?G.green:G.blue;
                return (
                  <tr key={k.word} style={{borderBottom:`1px solid ${G.border}`,background:i%2===0?G.surface:"#fafafa"}}>
                    <td style={{padding:"8px 16px",fontSize:12,color:G.textHint,width:36}}>{i+1}</td>
                    <td style={{padding:"8px 16px",fontSize:13,fontWeight:500}}><GBadge color={color} bg={color+"15"}>{k.word}</GBadge></td>
                    <td style={{padding:"8px 16px",fontSize:13,color:G.textSec}}>{k.count}</td>
                    <td style={{padding:"8px 16px"}}><span style={{color,fontWeight:600,fontSize:13}}>{k.density}%</span></td>
                    <td style={{padding:"8px 24px 8px 16px",width:200}}><GBar value={d} max={Math.max(6,parseFloat(topKeywords[0]?.density||6))} color={color}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GCard>
    </div>
  );
}

// ── EEAT analyzer ────────────────────────────────────────────────────────────
function EEATTab({analysis,isMobile}) {
  const {eeat}=analysis;
  const col=scoreColor(eeat.score);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Experience · Expertise · Authoritativeness · Trust — Google's quality signals">EEAT analysis</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"260px 1fr",gap:16}}>
        <GCard style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10}} padding={24}>
          <svg width="120" height="120" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke={G.border} strokeWidth="9"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke={col} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(eeat.score/100)*264} 264`} transform="rotate(-90 50 50)"/>
            <text x="50" y="48" textAnchor="middle" fontSize="26" fontWeight="800" fill={G.text} fontFamily={font}>{eeat.score}</text>
            <text x="50" y="64" textAnchor="middle" fontSize="10" fill={G.textHint} fontFamily={font}>/ 100</text>
          </svg>
          <div style={{fontSize:18,fontWeight:800,color:col}}>{scoreLabel(eeat.score)}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
            <GBadge color={G.blue} bg={G.blueLight}>{eeat.counts.sources} sources</GBadge>
            <GBadge color={G.green} bg={G.greenLight}>{eeat.counts.stats} stats</GBadge>
            <GBadge color={G.purple} bg={G.purpleLight}>{eeat.counts.quotes} quotes</GBadge>
          </div>
        </GCard>
        <GCard padding={0}>
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:600,color:G.textSec}}>Signal checklist</div>
          {eeat.checks.map((c,i)=>(
            <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"12px 16px",borderBottom:i<eeat.checks.length-1?`1px solid ${G.border}`:"none",background:c.ok?G.greenLight+"22":G.redLight+"22"}}>
              <span style={{fontSize:16,lineHeight:1.3,flexShrink:0}}>{c.ok?"✅":"⬜"}</span>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:G.text}}>{c.key}</div>
                {!c.ok&&<div style={{fontSize:12,color:G.textSec,marginTop:2}}>{c.tip}</div>}
              </div>
            </div>
          ))}
        </GCard>
      </div>
      <GCard style={{background:G.blueLight,border:`1px solid ${G.blue}22`}} padding="12px 16px">
        <div style={{fontSize:13,color:G.blue,fontWeight:600,marginBottom:4}}>💡 Why EEAT matters</div>
        <div style={{fontSize:12,color:G.textSec}}>Google's quality raters reward content showing real experience, expertise, authority, and trust — especially for YMYL (health, finance, legal) topics. Each missing signal above is a quick credibility win.</div>
      </GCard>
    </div>
  );
}

// ── AI content signals ───────────────────────────────────────────────────────
function AITab({analysis}) {
  const {aiSignals}=analysis;
  const col=scoreColor(aiSignals.human);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Heuristic estimate of how natural and varied the writing reads">AI content signals</SectionTitle>
      <GCard padding={0}>
        <div style={{padding:"16px",display:"flex",alignItems:"center",gap:16,borderBottom:`1px solid ${G.border}`}}>
          <div style={{width:64,height:64,borderRadius:16,flexShrink:0,background:col+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:800,color:col}}>{aiSignals.human}</div>
          <div>
            <div style={{fontSize:11,color:G.textHint,fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>Human-like score</div>
            <div style={{fontSize:18,fontWeight:800,color:col}}>{aiSignals.human>=71?"Reads naturally":aiSignals.human>=41?"Somewhat uniform":"Very uniform / AI-like"}</div>
            <div style={{fontSize:12,color:G.textSec,marginTop:2}}>Avg {aiSignals.avgSentence} words per sentence</div>
          </div>
        </div>
        <div style={{padding:"8px 16px 14px"}}>
          {aiSignals.metrics.map(m=>{
            const c=scoreColor(m.score);
            return (
              <div key={m.label} style={{padding:"8px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:13,color:G.text}}>{m.label}</span>
                  <span style={{fontSize:12,fontWeight:700,color:c}}>{m.score}</span>
                </div>
                <GBar value={m.score} max={100} color={c} height={7}/>
                {m.score<50&&<div style={{fontSize:11,color:G.textHint,marginTop:4}}>{m.tip}</div>}
              </div>
            );
          })}
        </div>
      </GCard>
      <GCard style={{background:G.yellowLight,border:`1px solid ${G.yellow}33`}} padding="12px 16px">
        <div style={{fontSize:13,color:"#b06000",fontWeight:600,marginBottom:4}}>⚠️ This is a writing-style estimate</div>
        <div style={{fontSize:12,color:G.textSec}}>It measures rhythm and variety, not authorship — it's not a definitive AI detector. Use it to make content read more naturally; varied sentence and paragraph lengths feel more human and keep readers engaged.</div>
      </GCard>
    </div>
  );
}

// ── Internal linking ─────────────────────────────────────────────────────────
function LinkingTab({analysis}) {
  const {internalLinks}=analysis;
  const [copied,setCopied]=useState("");
  const copy=(t)=>{ try{ navigator.clipboard.writeText(t); setCopied(t); setTimeout(()=>setCopied(""),1200); }catch(e){} };
  const typeColor={"Long-tail phrase":G.purple,"Key phrase":G.blue,"Topic page":G.green,"Category page":G.teal,"Keyword":G.yellow};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Suggested anchor texts and internal link opportunities from your content">Internal linking</SectionTitle>
      {internalLinks.length===0?(
        <GCard><div style={{textAlign:"center",padding:24,color:G.textHint,fontSize:13}}>Add more content to surface anchor-text opportunities.</div></GCard>
      ):(
        <GCard padding={0}>
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:600,color:G.textSec}}>Suggested anchor texts ({internalLinks.length})</div>
          <div style={{padding:"4px 0"}}>
            {internalLinks.map((l,i)=>{
              const c=typeColor[l.type]||G.blue;
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:i<internalLinks.length-1?`1px solid ${G.border}`:"none"}}>
                  <span style={{flex:1,fontSize:14,color:G.text,fontWeight:500,textTransform:"capitalize"}}>{l.text}</span>
                  <GBadge color={c} bg={c+"18"}>{l.type}</GBadge>
                  <button onClick={()=>copy(l.text)} style={{border:`1px solid ${G.border}`,background:copied===l.text?G.greenLight:G.surface,color:copied===l.text?G.green:G.textSec,borderRadius:8,padding:"5px 12px",fontSize:12,fontFamily:font,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                    {copied===l.text?"Copied ✓":"Copy"}
                  </button>
                </div>
              );
            })}
          </div>
        </GCard>
      )}
      <GCard style={{background:G.greenLight,border:`1px solid ${G.green}33`}} padding="12px 16px">
        <div style={{fontSize:13,color:G.green,fontWeight:600,marginBottom:4}}>🔗 How to use these</div>
        <div style={{fontSize:12,color:G.textSec,lineHeight:1.8}}>
          <div>· Use these phrases as <b>anchor text</b> linking to relevant pages on your site.</div>
          <div>· Link each topic/keyword to its most relevant pillar or category page.</div>
          <div>· Aim for 3–5 internal links per 1,000 words, with descriptive (not "click here") anchors.</div>
        </div>
      </GCard>
    </div>
  );
}

// ── 6. Competitor ──────────────────────────────────────────────────────────────
function CompTab({compText,setCompText,compAnalysis}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Compare your content against a competitor to find keyword gaps">Competitor gap analysis</SectionTitle>
      <GCard padding={16}>
        <div style={{fontSize:13,fontWeight:500,color:G.textSec,marginBottom:8}}>Competitor content</div>
        <textarea value={compText} onChange={e=>setCompText(e.target.value)}
          placeholder="Paste competitor's page content here to identify missing keywords and phrases..."
          style={{width:"100%",height:120,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 14px",fontFamily:font,fontSize:13,color:G.text,resize:"vertical",outline:"none",boxSizing:"border-box",transition:"border-color .2s"}}
          onFocus={e=>{e.target.style.borderColor=G.blue;e.target.style.boxShadow=`0 0 0 2px ${G.blueLight}`;}}
          onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none";}}/>
      </GCard>
      {!compText.trim()&&<GCard><div style={{textAlign:"center",padding:24,color:G.textHint,fontSize:13}}>Paste competitor content above to see gap analysis</div></GCard>}
      {compAnalysis&&(
        <>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <GStat label="Missing keywords" value={compAnalysis.missingWords.length} icon="🔑" color={G.red}/>
            <GStat label="Missing 2-word phrases" value={compAnalysis.missingPhrases2.length} icon="🔗" color={G.yellow}/>
            <GStat label="Missing 3-word phrases" value={compAnalysis.missingPhrases3.length} icon="🔗" color={G.purple}/>
            <GStat label="Missing WH questions" value={compAnalysis.missingQs.length} icon="❓" color={G.teal}/>
          </div>
          {[
            {label:"🔑 Missing keywords",data:compAnalysis.missingWords,color:G.red,bg:G.redLight,pill:true},
            {label:"🔗 Missing 2-word phrases",data:compAnalysis.missingPhrases2,color:G.yellow,bg:G.yellowLight,pill:true},
            {label:"🔗 Missing 3-word phrases",data:compAnalysis.missingPhrases3,color:G.purple,bg:G.purpleLight,pill:true},
          ].map(({label,data,color,bg})=>(
            <GCard key={label} padding={0}>
              <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>{label}</div>
              <div style={{padding:16,display:"flex",flexWrap:"wrap",gap:8}}>
                {data.length===0?<span style={{color:G.green,fontSize:13}}>✅ No gaps — your content covers this well</span>:
                  data.slice(0,30).map(([phrase,count],i)=>(
                    <span key={i} style={{background:bg,color,borderRadius:999,padding:"4px 12px",fontSize:13,fontWeight:500}}>
                      {phrase} <span style={{opacity:.7,fontSize:12}}>({count}×)</span>
                    </span>
                  ))
                }
              </div>
            </GCard>
          ))}
          {compAnalysis.missingQs.length>0&&(
            <GCard padding={0}>
              <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>❓ WH questions competitor uses that you don't</div>
              <div style={{padding:"8px 0"}}>
                {compAnalysis.missingQs.slice(0,15).map((q,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 16px",borderBottom:`1px solid ${G.border}`}}>
                    <span style={{fontSize:13,color:G.text,textTransform:"capitalize"}}>{q.phrase}</span>
                    <GBadge color={G.teal} bg={G.tealLight}>SEO: {q.seoScore}</GBadge>
                  </div>
                ))}
              </div>
            </GCard>
          )}
        </>
      )}
    </div>
  );
}

// ── 7. Structure ───────────────────────────────────────────────────────────────
function StructTab({analysis,isMobile}) {
  const {structure}=analysis;
  const checks=[
    {label:"H1 headings",value:structure.h1,ideal:"Exactly 1",ok:structure.h1===1,warn:structure.h1===0||structure.h1>1,desc:"One H1 per page for clear primary topic signal"},
    {label:"H2 headings",value:structure.h2,ideal:"3–7",ok:structure.h2>=3&&structure.h2<=7,warn:structure.h2<2,desc:"Section headings for content hierarchy"},
    {label:"H3 headings",value:structure.h3,ideal:"2+",ok:structure.h3>=2,warn:structure.h3===0,desc:"Sub-section structure"},
    {label:"Internal links",value:structure.internal,ideal:"3+",ok:structure.internal>=3,warn:structure.internal===0,desc:"Links to other pages on your site"},
    {label:"External links",value:structure.external,ideal:"1–5",ok:structure.external>=1&&structure.external<=5,warn:structure.external===0,desc:"Outbound authority links"},
    {label:"Images with alt text",value:structure.images,ideal:"2+",ok:structure.images>=2,warn:structure.images===0,desc:"Visual content with alt attributes"},
    {label:"Tables present",value:structure.tables,ideal:"1+",ok:structure.tables>=1,warn:structure.tables===0,desc:"Structured data tables for featured snippets"},
    {label:"Paragraphs",value:structure.paragraphs,ideal:"5+",ok:structure.paragraphs>=5,warn:structure.paragraphs<3,desc:"Content broken into scannable sections"},
    {label:"Long paragraphs (150+ words)",value:structure.longParas,ideal:"0",ok:structure.longParas===0,warn:structure.longParas>2,desc:"Paragraphs that may hurt readability"},
  ];
  const passed=checks.filter(c=>c.ok).length;
  const score=Math.round((passed/checks.length)*100);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Structural SEO elements: headings, links, images, and content layout">SEO structure checker</SectionTitle>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <GStat label="Structure score" value={`${score}%`} icon={score>=70?"✅":"⚠️"} color={score>=70?G.green:G.yellow}/>
        <GStat label="Checks passed" value={passed} icon="✓" color={G.green} sub={`of ${checks.length} total`}/>
        <GStat label="Issues found" value={checks.filter(c=>c.warn).length} icon="⚠️" color={G.red} sub="need attention"/>
      </div>
      <GCard padding={0}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>Checklist</div>
        {checks.map((check,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto":"1fr 80px 100px 80px",alignItems:"center",gap:isMobile?"6px 12px":16,padding:"12px 16px",borderBottom:i<checks.length-1?`1px solid ${G.border}`:"none",background:check.warn?G.redLight+"55":check.ok?G.greenLight+"22":G.surface}}>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:G.text}}>{check.label}</div>
              <div style={{fontSize:11,color:G.textHint,marginTop:2}}>{check.desc}</div>
            </div>
            <span style={{fontSize:20,fontWeight:700,color:G.text,textAlign:"center"}}>{check.value}</span>
            <span style={{fontSize:12,color:G.textHint,textAlign:"center"}}>ideal: {check.ideal}</span>
            <div style={{textAlign:"center"}}>
              {check.ok?<GBadge color={G.green} bg={G.greenLight}>✓ Pass</GBadge>:check.warn?<GBadge color={G.red} bg={G.redLight}>✗ Fix</GBadge>:<GBadge color={G.yellow} bg={G.yellowLight}>~ OK</GBadge>}
            </div>
          </div>
        ))}
      </GCard>
      <GCard style={{background:G.blueLight,border:`1px solid ${G.blue}22`}} padding="12px 16px">
        <div style={{fontSize:13,color:G.blue,fontWeight:500,marginBottom:4}}>📝 Detection note</div>
        <div style={{fontSize:12,color:G.textSec}}>Structure detection uses Markdown formatting (# H1, ## H2, [links], ![images]). For plain text without Markdown, heading and link counts will show 0. Paste content with Markdown for accurate results.</div>
      </GCard>
    </div>
  );
}

// ── 8. Intent ──────────────────────────────────────────────────────────────────
function IntentTab({analysis}) {
  const {intent}=analysis;
  const primary=intent[0];
  const IC={informational:G.teal,commercial:G.yellow,transactional:G.green,navigational:G.blue};
  const IB={informational:G.tealLight,commercial:G.yellowLight,transactional:G.greenLight,navigational:G.blueLight};
  const II={informational:"📚",commercial:"🛍️",transactional:"💳",navigational:"🧭"};
  const ID={
    informational:"User wants to learn. Optimise for featured snippets, FAQ schema, and comprehensive coverage.",
    commercial:"User is comparing options. Add comparison tables, user reviews, and clear differentiators.",
    transactional:"User is ready to act. Strengthen CTAs, trust signals, and above-the-fold value propositions.",
    navigational:"User wants to find a specific page. Ensure brand and navigation keywords are prominent.",
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Classify content intent to align with user search behaviour">Intent classification</SectionTitle>
      {primary&&(
        <GCard style={{background:IB[primary.intent]||G.blueLight,border:`1px solid ${IC[primary.intent]||G.blue}33`}} padding={24}>
          <div style={{fontSize:12,color:G.textSec,fontWeight:500,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Primary intent detected</div>
          <div style={{fontSize:36,marginBottom:8}}>{II[primary.intent]}</div>
          <div style={{fontSize:24,fontWeight:700,color:IC[primary.intent]||G.blue,textTransform:"capitalize",marginBottom:8}}>{primary.intent}</div>
          <div style={{fontSize:13,color:G.textSec}}>{ID[primary.intent]}</div>
        </GCard>
      )}
      <GCard padding={0}>
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>Intent signal breakdown</div>
        {intent.map(({intent:name,score,pct},i)=>(
          <div key={name} style={{padding:"14px 16px",borderBottom:i<intent.length-1?`1px solid ${G.border}`:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:20}}>{II[name]}</span>
                <span style={{fontSize:14,fontWeight:500,color:G.text,textTransform:"capitalize"}}>{name}</span>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:12,color:G.textHint}}>{score} signals</span>
                <GBadge color={IC[name]||G.blue} bg={IB[name]||G.blueLight}>{pct}%</GBadge>
              </div>
            </div>
            <GBar value={pct} max={100} color={IC[name]||G.blue} height={8}/>
          </div>
        ))}
      </GCard>
    </div>
  );
}

// ── 9. Export ──────────────────────────────────────────────────────────────────
function ExportTab({analysis,exportCSV,exportFullCSV,exportJSON,isMobile}) {
  const exports=[
    {label:"Keywords CSV",desc:"Top 200 keywords with count and density",icon:"📊",action:exportCSV,color:G.green,bg:G.greenLight},
    {label:"Full Report CSV",desc:"Keywords + 2/3-gram phrases + WH questions",icon:"📋",action:exportFullCSV,color:G.blue,bg:G.blueLight},
    {label:"JSON Export",desc:"Complete structured analysis data",icon:"📦",action:exportJSON,color:G.purple,bg:G.purpleLight},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Download your analysis in multiple formats">Export analysis</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:12}}>
        {exports.map(({label,desc,icon,action,color,bg})=>(
          <button key={label} onClick={action}
            style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:8,padding:20,cursor:"pointer",textAlign:"left",fontFamily:font,boxShadow:G.shadowSm,transition:"all .15s"}}
            onMouseEnter={e=>{e.currentTarget.style.boxShadow=G.shadow;e.currentTarget.style.borderColor=color;}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow=G.shadowSm;e.currentTarget.style.borderColor=G.border;}}>
            <div style={{fontSize:28,marginBottom:12}}>{icon}</div>
            <div style={{fontSize:14,fontWeight:500,color:G.text,marginBottom:4}}>{label}</div>
            <div style={{fontSize:12,color:G.textSec,marginBottom:16}}>{desc}</div>
            <div style={{background:color,color:"#fff",borderRadius:4,padding:"6px 16px",fontSize:13,fontWeight:500,display:"inline-block"}}>Download</div>
          </button>
        ))}
      </div>
      <GCard padding={0}>
        <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>📈 Analysis summary</div>
        <div style={{padding:16,display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:isMobile?"0":"0 32px"}}>
          {[
            ["Total words",analysis.totalWords.toLocaleString()],
            ["Unique words",analysis.uniqueWords.toLocaleString()],
            ["Readability score",`${analysis.readability.score}/100 — ${analysis.readability.label}`],
            ["Top keyword",`"${analysis.freqEntries[0]?.[0]}" (${analysis.freqEntries[0]?.[1]}×)`],
            ["Bigrams found",(analysis.phrases[2]||[]).length],
            ["Trigrams found",(analysis.phrases[3]||[]).length],
            ["Questions detected",analysis.questions.length],
            ["Primary intent",analysis.intent[0]?.intent||"—"],
            ["Stuffing warnings",analysis.stuffing.length],
            ["Overused keywords",analysis.overused.length],
          ].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${G.border}`}}>
              <span style={{fontSize:13,color:G.textSec}}>{k}</span>
              <span style={{fontSize:13,color:G.text,fontWeight:500,textTransform:"capitalize"}}>{v}</span>
            </div>
          ))}
        </div>
      </GCard>
    </div>
  );
}
