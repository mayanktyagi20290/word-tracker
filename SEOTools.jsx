import { useState, useMemo, useRef } from "react";
import { useContent } from "./content.jsx";
import _ from "lodash";

// ── Google font injection ──────────────────────────────────────────────────────
if (typeof document !== "undefined") {
  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
  document.head.appendChild(fontLink);
}

// ── Design tokens (Google Material 3) ────────────────────────────────────────
const G = {
  blue:       "#4F46E5",
  blueLight:  "#EEF2FF",
  blueDark:   "#4338CA",
  green:      "#10B981",
  greenLight: "#ECFDF5",
  red:        "#EF4444",
  redLight:   "#FEF2F2",
  yellow:     "#F59E0B",
  yellowLight:"#FFFBEB",
  purple:     "#7C3AED",
  purpleLight:"#F3E8FF",
  teal:       "#0EA5E9",
  tealLight:  "#E0F2FE",
  surface:    "#FFFFFF",
  bg:         "#F8FAFC",
  border:     "#E5E7EB",
  text:       "#111827",
  textSec:    "#6B7280",
  textHint:   "#9CA3AF",
  hover:      "#F3F4F6",
  shadow:     "0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06)",
  shadowSm:   "0 1px 3px rgba(0,0,0,.08)",
  radius:     16,
  radiusBtn:  12,
};

// ── NLP engine (identical logic, Google skin) ─────────────────────────────────
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
function extractSentences(text) { return text.match(/[^.!?]+[.!?]+/g)||[text]; }
function extractQuestions(text) {
  const whP=[]; const lines=text.split(/\n/);
  lines.forEach(line=>{ const low=line.toLowerCase().trim();
    WH_WORDS.forEach(wh=>{ if(low.startsWith(wh+" ")||low.startsWith(wh+"'")){
      const c=line.trim().replace(/\?$/,"").trim();
      if(c.split(/\s+/).length>=3)whP.push(c);
    }});
  });
  (text.match(/[^.!?]*\?[^.!?]*/g)||[]).forEach(s=>{
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
function checkStructureHTML(text) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  const links = Array.from(doc.querySelectorAll("a[href]"));
  const external = links.filter(a => /^https?:\/\//i.test(a.getAttribute("href") || "")).length;
  const imgs = Array.from(doc.querySelectorAll("img"));
  const paras = Array.from(doc.querySelectorAll("p")).filter(p => (p.textContent || "").trim().length > 50);
  return {
    h1: doc.querySelectorAll("h1").length,
    h2: doc.querySelectorAll("h2").length,
    h3: doc.querySelectorAll("h3, h4").length,
    internal: links.length - external,
    external,
    images: imgs.filter(i => (i.getAttribute("alt") || "").trim().length > 0).length,
    tables: doc.querySelectorAll("table").length > 0 ? 1 : 0,
    paragraphs: paras.length,
    longParas: paras.filter(p => (p.textContent || "").split(/\s+/).length > 150).length,
    mode: "html",
  };
}

function checkStructure(text) {
  const looksHtml = /<\/?(h[1-6]|p|a|img|table|ul|ol|li|div|section|article)\b[^>]*>/i.test(text);
  if (looksHtml && typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try { return checkStructureHTML(text); } catch (e) { /* fall back to text parsing */ }
  }
  const md = {
    h1:(text.match(/^#{1}\s.+/gm)||[]).length,
    h2:(text.match(/^#{2}\s.+/gm)||[]).length,
    h3:(text.match(/^#{3}\s.+/gm)||[]).length,
    internal:(text.match(/\[.*?\]\((?!https?:\/\/)[^)]+\)/g)||[]).length,
    external:(text.match(/\[.*?\]\(https?:\/\/[^)]+\)/g)||[]).length,
    images:(text.match(/!\[.*?\]\([^)]+\)/g)||[]).length,
    tables:(text.match(/\|.+\|/g)||[]).length>0?1:0,
  };
  const paras = text.split(/\n{2,}/).filter(p=>p.trim().length>50);
  const paragraphs = paras.length || text.split(/\n/).filter(p=>p.trim().length>50).length;
  const longParas = (paras.length?paras:text.split(/\n/)).filter(p=>p.split(/\s+/).length>150).length;
  if (md.h1+md.h2+md.h3+md.internal+md.external+md.images > 0)
    return { ...md, paragraphs, longParas, mode: "markdown" };
  return {
    h1:0, h2:0, h3:0, internal:0,
    external:(text.match(/https?:\/\/[^\s)]+/g)||[]).length,
    images:0, tables:0, paragraphs, longParas, mode: "plain",
  };
}

// ── Google UI primitives ───────────────────────────────────────────────────────
const font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

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
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:12,color:G.textSec,fontWeight:500,marginBottom:6}}>{label}</div>
          <div style={{fontSize:24,fontWeight:700,color:G.text,lineHeight:1.1,overflowWrap:"anywhere"}}>{value}</div>
          {sub&&<div style={{fontSize:11,color:G.textHint,marginTop:4}}>{sub}</div>}
        </div>
        {icon&&<div style={{fontSize:22,color:color,background:color+"15",borderRadius:8,padding:8,lineHeight:1}}>{icon}</div>}
      </div>
    </GCard>
  );
}

// ── Tabs config ────────────────────────────────────────────────────────────────
const TABS = [
  {id:"frequency",label:"Word Frequency",icon:"bar_chart"},
  {id:"longtail",label:"Long-tail Phrases",icon:"link"},
  {id:"questions",label:"WH Questions",icon:"help_outline"},
  {id:"nlp",label:"NLP & Entities",icon:"psychology"},
  {id:"optimization",label:"Optimization",icon:"tune"},
  {id:"highlighter",label:"Content Highlighter",icon:"🖍️"},
  {id:"competitor",label:"Competitor Gap",icon:"compare_arrows"},
  {id:"structure",label:"SEO Structure",icon:"schema"},
  {id:"intent",label:"Intent",icon:"my_location"},
  {id:"export",label:"Export",icon:"download"},
];

// ── Reusable analysis hooks (extracted from the original single-page shell) ──────
export function useAnalysis(text, filterStop = true) {
  return useMemo(() => {
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
    return {tokens,clean,freqEntries,totalWords,uniqueWords,phrases,questions,entities,intent,readability,structure,topKeywords,overused,stuffing,clusters,lsi};
  },[text,filterStop]);
}

export function useCompAnalysis(compText, analysis) {
  return useMemo(() => {
    if (!compText.trim()||!analysis) return null;
    const ct=cleanTokens(tokenize(compText));
    const cf={};ct.forEach(t=>{cf[t]=(cf[t]||0)+1;});
    // My cleaned-word frequency, apples-to-apples with the competitor.
    const mf={};(analysis.clean||[]).forEach(t=>{mf[t]=(mf[t]||0)+1;});
    const myTotal=analysis.totalWords||1;
    const compTotal=tokenize(compText).length||1;

    const myW=new Set(analysis.clean);
    const compW=new Set(ct);
    const myP2=new Set((analysis.phrases[2]||[]).map(([p])=>p));
    const myP3=new Set((analysis.phrases[3]||[]).map(([p])=>p));

    // Density delta — every term the competitor uses ≥2×, ranked by how much
    // more heavily they emphasise it than you (missing terms have myDensity 0).
    const allTerms=new Set([...Object.keys(cf),...Object.keys(mf)]);
    const densityGaps=[...allTerms].map(w=>{
      const cc=cf[w]||0, mc=mf[w]||0;
      const cd=(cc/compTotal)*100, md=(mc/myTotal)*100;
      return {word:w,compCount:cc,myCount:mc,compDensity:cd,myDensity:md,delta:cd-md};
    }).filter(x=>x.compCount>=2 && x.delta>0.05 && x.word.length>3)
      .sort((a,b)=>b.delta-a.delta).slice(0,25);

    const shared=[...allTerms].filter(w=>cf[w]&&mf[w]&&w.length>3)
      .map(w=>({word:w,myCount:mf[w],compCount:cf[w]}))
      .sort((a,b)=>(b.myCount+b.compCount)-(a.myCount+a.compCount)).slice(0,30);
    const myUnique=Object.entries(mf).filter(([w])=>!compW.has(w)&&w.length>3)
      .sort((a,b)=>b[1]-a[1]).slice(0,30);

    return {
      stats:{
        myWords:myTotal, compWords:compTotal,
        myReadability:analysis.readability.score, compReadability:readabilityScore(compText).score,
        myIntent:analysis.intent[0]?.intent||"—", compIntent:detectIntent(compText)[0]?.intent||"—",
      },
      densityGaps, shared, myUnique,
      missingWords:Object.entries(cf).filter(([w])=>!myW.has(w)&&w.length>3).sort((a,b)=>b[1]-a[1]).slice(0,30),
      missingPhrases2:Object.entries(getNgrams(ct,2)).filter(([p,c])=>!myP2.has(p)&&c>=1).sort((a,b)=>b[1]-a[1]).slice(0,20),
      missingPhrases3:Object.entries(getNgrams(ct,3)).filter(([p,c])=>!myP3.has(p)&&c>=1).sort((a,b)=>b[1]-a[1]).slice(0,20),
      missingQs:extractQuestions(compText).filter(q=>!new Set(analysis.questions.map(q=>q.phrase.slice(0,40))).has(q.phrase.slice(0,40))),
    };
  },[compText,analysis]);
}

export function makeExporters(analysis) {
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
    const data={summary:{totalWords:analysis.totalWords,uniqueWords:analysis.uniqueWords,readability:analysis.readability},topKeywords:analysis.topKeywords,phrases:{bigrams:(analysis.phrases[2]||[]).slice(0,50),trigrams:(analysis.phrases[3]||[]).slice(0,50)},questions:analysis.questions.slice(0,30),intent:analysis.intent,entities:analysis.entities,structure:analysis.structure};
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="seo-analysis.json";a.click();
  };
  return { exportCSV, exportFullCSV, exportJSON };
}


function TabRouter(props) {
  const {tab}=props;
  if(tab==="frequency") return <FreqTab {...props}/>;
  if(tab==="longtail")  return <LongtailTab {...props}/>;
  if(tab==="questions") return <QuestionsTab {...props}/>;
  if(tab==="nlp")       return <NLPTab {...props}/>;
  if(tab==="optimization") return <OptTab {...props}/>;
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
function HighlighterTab({analysis, rawText}) {
  const { setText } = useContent();
  const taRef = useRef(null);
  const bdRef = useRef(null);
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
  const gradeInfo     = getGradeLevel(analysis?.readability?.score ?? 0);

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
      const st = d>=STUFFING ? {background:"#fce8e6",boxShadow:"inset 0 -2px 0 #d93025"}
               : d>=OVERUSED ? {background:"#fef7e0",boxShadow:"inset 0 -2px 0 #f9ab00"}
               :               {background:"#e8f0fe",boxShadow:"inset 0 -2px 0 #1a73e8"};
      parts.push(<mark key={k++} style={{...st,borderRadius:2,color:"inherit"}}>{m[0]}</mark>);
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
        advParts.push(<mark key={`a${aK++}`} style={{background:"#e8d5f5",boxShadow:"inset 0 -2px 0 #7b1fa2",borderRadius:2,color:"inherit"}}>{aM[0]}</mark>);
        aLast=aM.index+aM[0].length;
      }
      if(aLast<sentStr.length) advParts.push(<span key={`a${aK++}`}>{sentStr.slice(aLast)}</span>);

      const sentBg = isVH ? {background:"#fce8e6",borderRadius:2}
                   : isH  ? {background:"#fff3e0",borderRadius:2}
                   : isPas? {background:"#e8f5e9",borderRadius:2}
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
          const kst=d>=STUFFING?{background:"#fca5a5",boxShadow:"inset 0 -2px 0 #ef4444"}
                   :d>=OVERUSED?{background:"#fde68a",boxShadow:"inset 0 -2px 0 #f59e0b"}
                   :            {background:"#93c5fd",boxShadow:"inset 0 -2px 0 #3b82f6"};
          sParts.push(<mark key={`s${sK++}`} style={{...kst,borderRadius:2,color:"inherit"}}>{sM[0]}</mark>);
          sLast=sM.index+sM[0].length;
        }
        if(sLast<sent.length) sParts.push(<span key={`s${sK++}`}>{sent.slice(sLast)}</span>);
        parts.push(<span key={k++} style={{background:sentBg,borderRadius:2}}>{sParts}</span>);
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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,flex:1,height:"calc(100vh - 230px)",minHeight:500}}>

        {/* LEFT — highlighted text */}
        <div style={{display:"flex",flexDirection:"column",border:`1px solid ${G.border}`,borderRadius:8,background:"#fff",overflow:"hidden",boxShadow:G.shadowSm}}>
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,background:G.bg,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <span style={{fontSize:13,fontWeight:500,color:G.textSec}}>✏️ Your content</span>
            <span style={{fontSize:11,color:G.textHint}}>Type here — highlights update live</span>
          </div>
          <div style={{position:"relative",flex:1,minHeight:0}}>
            <div ref={bdRef} aria-hidden="true" style={{position:"absolute",inset:0,overflow:"hidden",padding:"20px 24px",fontSize:14,lineHeight:2.1,color:"transparent",whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"Georgia,'Times New Roman',serif",pointerEvents:"none",boxSizing:"border-box",margin:0}}>
              {rendered}{"\n"}
            </div>
            <textarea ref={taRef} value={rawText} onChange={e=>setText(e.target.value)} onScroll={()=>{if(bdRef.current&&taRef.current)bdRef.current.scrollTop=taRef.current.scrollTop;}} spellCheck={false} placeholder="Paste or write your content here…"
              style={{position:"absolute",inset:0,width:"100%",height:"100%",overflow:"auto",padding:"20px 24px",fontSize:14,lineHeight:2.1,color:G.text,whiteSpace:"pre-wrap",wordBreak:"break-word",fontFamily:"Georgia,'Times New Roman',serif",background:"transparent",border:"none",outline:"none",resize:"none",boxSizing:"border-box",caretColor:G.text,margin:0}}/>
          </div>
        </div>

        {/* RIGHT — overview panel */}
        <div style={{overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>

          {/* Grade level card */}
          <div style={{background:"#fff",border:`2px solid ${gradeInfo.color}44`,borderRadius:10,padding:"14px 18px",boxShadow:G.shadowSm,display:"flex",alignItems:"center",gap:16}}>
            <div style={{background:gradeInfo.color+"18",borderRadius:8,padding:"10px 14px",textAlign:"center",minWidth:80}}>
              <div style={{fontSize:22,fontWeight:700,color:gradeInfo.color}}>{analysis?.readability?.score ?? 0}</div>
              <div style={{fontSize:10,color:gradeInfo.color,fontWeight:500}}>FK Score</div>
            </div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:G.text}}>{gradeInfo.grade}</div>
              <div style={{fontSize:12,color:gradeInfo.color,fontWeight:500}}>{gradeInfo.desc}</div>
              <div style={{fontSize:11,color:G.textHint,marginTop:3}}>Avg {analysis?.readability?.avgWords ?? 0} words/sentence</div>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {l:"Total words",   v:(analysis?.totalWords ?? 0).toLocaleString(), c:G.blue},
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
function NLPTab({analysis}) {
  const {entities,clusters,lsi}=analysis;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Entity extraction, topic clustering, and semantic keyword opportunities">NLP analysis</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
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
function OptTab({analysis}) {
  const {topKeywords,overused,stuffing,readability}=analysis;
  const rdColor=readability.score>=60?G.green:readability.score>=40?G.yellow:G.red;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Keyword density health, stuffing warnings, and readability">Content optimization</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16}}>
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

// ── 6. Competitor ──────────────────────────────────────────────────────────────
function CompTab({compText,setCompText,compAnalysis}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Compare your content against a competitor — density gaps, shared terms, and what each side covers">Competitor gap analysis</SectionTitle>
      <GCard padding={16}>
        <div style={{fontSize:13,fontWeight:500,color:G.textSec,marginBottom:8}}>Competitor content</div>
        <textarea value={compText} onChange={e=>setCompText(e.target.value)}
          placeholder="Paste competitor's page content here to identify density gaps, missing keywords and phrases..."
          style={{width:"100%",height:120,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 14px",fontFamily:font,fontSize:13,color:G.text,resize:"vertical",outline:"none",boxSizing:"border-box",transition:"border-color .2s"}}
          onFocus={e=>{e.target.style.borderColor=G.blue;e.target.style.boxShadow=`0 0 0 2px ${G.blueLight}`;}}
          onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none";}}/>
      </GCard>
      {!compText.trim()&&<GCard><div style={{textAlign:"center",padding:24,color:G.textHint,fontSize:13}}>Paste competitor content above to see gap analysis</div></GCard>}
      {compAnalysis&&(()=>{
        const {stats,densityGaps,shared,myUnique,missingWords,missingPhrases2,missingPhrases3,missingQs}=compAnalysis;
        const maxDelta=densityGaps[0]?.delta||1;
        const rows=[
          {label:"Word count",my:stats.myWords.toLocaleString(),comp:stats.compWords.toLocaleString(),
            myBetter:stats.myWords>=stats.compWords},
          {label:"Readability",my:`${stats.myReadability}/100`,comp:`${stats.compReadability}/100`,
            myBetter:stats.myReadability>=stats.compReadability},
          {label:"Primary intent",my:stats.myIntent,comp:stats.compIntent,myBetter:null},
        ];
        return (
          <>
            {/* ── Side-by-side comparison ── */}
            <GCard padding={0}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:G.bg,borderBottom:`1px solid ${G.border}`}}>
                <div style={{padding:"10px 16px",fontSize:12,fontWeight:500,color:G.textSec}}>Metric</div>
                <div style={{padding:"10px 16px",fontSize:12,fontWeight:600,color:G.blue,textAlign:"center"}}>You</div>
                <div style={{padding:"10px 16px",fontSize:12,fontWeight:600,color:G.purple,textAlign:"center"}}>Competitor</div>
              </div>
              {rows.map((r,i)=>(
                <div key={r.label} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:i<rows.length-1?`1px solid ${G.border}`:"none"}}>
                  <div style={{padding:"11px 16px",fontSize:13,color:G.text}}>{r.label}</div>
                  <div style={{padding:"11px 16px",fontSize:14,fontWeight:600,textAlign:"center",textTransform:"capitalize",color:r.myBetter===true?G.green:r.myBetter===false?G.text:G.text}}>{r.my}{r.myBetter===true&&<span style={{color:G.green,fontSize:11,marginLeft:4}}>▲</span>}</div>
                  <div style={{padding:"11px 16px",fontSize:14,fontWeight:600,textAlign:"center",textTransform:"capitalize",color:r.myBetter===false?G.green:G.text}}>{r.comp}{r.myBetter===false&&<span style={{color:G.green,fontSize:11,marginLeft:4}}>▲</span>}</div>
                </div>
              ))}
            </GCard>

            {/* ── Density gaps (hero) ── */}
            <GCard padding={0}>
              <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>🎯 Keyword density gaps — terms the competitor emphasises more than you</div>
              {densityGaps.length===0?(
                <div style={{padding:24,textAlign:"center",fontSize:13,color:G.green}}>✅ No major density gaps — your emphasis matches or beats the competitor.</div>
              ):(
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{background:G.bg}}>{["Keyword","You","Competitor","Gap"].map(h=>(
                      <th key={h} style={{padding:"9px 16px",fontSize:12,fontWeight:500,color:G.textSec,textAlign:h==="Keyword"?"left":"center",borderBottom:`1px solid ${G.border}`}}>{h}</th>
                    ))}</tr></thead>
                    <tbody>
                      {densityGaps.map((g,i)=>{
                        const missing=g.myCount===0;
                        const color=missing?G.red:G.yellow;
                        return (
                          <tr key={g.word} style={{borderBottom:`1px solid ${G.border}`,background:i%2===0?G.surface:"#fafafa"}}>
                            <td style={{padding:"9px 16px",fontSize:13}}><span style={{background:color+"15",color,padding:"2px 10px",borderRadius:999,fontWeight:500}}>{g.word}</span>{missing&&<span style={{fontSize:11,color:G.red,marginLeft:8}}>missing</span>}</td>
                            <td style={{padding:"9px 16px",fontSize:13,color:G.textSec,textAlign:"center"}}>{g.myCount}× · {g.myDensity.toFixed(2)}%</td>
                            <td style={{padding:"9px 16px",fontSize:13,color:G.text,textAlign:"center",fontWeight:500}}>{g.compCount}× · {g.compDensity.toFixed(2)}%</td>
                            <td style={{padding:"9px 24px 9px 16px",minWidth:160}}><div style={{display:"flex",alignItems:"center",gap:8}}><GBar value={g.delta} max={maxDelta} color={color}/><span style={{fontSize:12,fontWeight:600,color,minWidth:42,textAlign:"right"}}>+{g.delta.toFixed(2)}%</span></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </GCard>

            {/* ── Three-way keyword split ── */}
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <GStat label="Missing keywords" value={missingWords.length} icon="🔑" color={G.red} sub="they have, you don't"/>
              <GStat label="Shared keywords" value={shared.length} icon="🤝" color={G.green} sub="both cover"/>
              <GStat label="Your unique terms" value={myUnique.length} icon="⭐" color={G.blue} sub="your edge"/>
              <GStat label="Missing questions" value={missingQs.length} icon="❓" color={G.teal}/>
            </div>
            {[
              {label:"🔑 Missing keywords — they cover, you don't",data:missingWords,color:G.red,bg:G.redLight},
              {label:"🤝 Shared keywords — both of you cover these",data:shared.map(s=>[s.word,s.compCount]),color:G.green,bg:G.greenLight},
              {label:"⭐ Your unique terms — competitor is missing these",data:myUnique,color:G.blue,bg:G.blueLight},
            ].map(({label,data,color,bg})=>(
              <GCard key={label} padding={0}>
                <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>{label}</div>
                <div style={{padding:16,display:"flex",flexWrap:"wrap",gap:8}}>
                  {data.length===0?<span style={{color:G.textHint,fontSize:13}}>— none —</span>:
                    data.slice(0,30).map(([phrase,count],i)=>(
                      <span key={i} style={{background:bg,color,borderRadius:999,padding:"4px 12px",fontSize:13,fontWeight:500}}>
                        {phrase} <span style={{opacity:.7,fontSize:12}}>({count}×)</span>
                      </span>
                    ))
                  }
                </div>
              </GCard>
            ))}

            {/* ── Phrase gaps ── */}
            {[
              {label:"🔗 Missing 2-word phrases",data:missingPhrases2,color:G.yellow,bg:G.yellowLight},
              {label:"🔗 Missing 3-word phrases",data:missingPhrases3,color:G.purple,bg:G.purpleLight},
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
            {missingQs.length>0&&(
              <GCard padding={0}>
                <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>❓ WH questions competitor uses that you don't</div>
                <div style={{padding:"8px 0"}}>
                  {missingQs.slice(0,15).map((q,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 16px",borderBottom:`1px solid ${G.border}`}}>
                      <span style={{fontSize:13,color:G.text,textTransform:"capitalize"}}>{q.phrase}</span>
                      <GBadge color={G.teal} bg={G.tealLight}>SEO: {q.seoScore}</GBadge>
                    </div>
                  ))}
                </div>
              </GCard>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ── 7. Structure ───────────────────────────────────────────────────────────────
function StructTab({analysis}) {
  const {structure}=analysis;
  const mode=structure.mode||"markdown";
  const plain=mode==="plain";
  const checks=[
    {label:"H1 headings",value:structure.h1,ideal:"Exactly 1",ok:structure.h1===1,warn:structure.h1===0||structure.h1>1,desc:"One H1 per page for a clear primary topic",na:plain},
    {label:"H2 headings",value:structure.h2,ideal:"3–7",ok:structure.h2>=3&&structure.h2<=7,warn:structure.h2<2,desc:"Section headings for content hierarchy",na:plain},
    {label:"H3 headings",value:structure.h3,ideal:"2+",ok:structure.h3>=2,warn:structure.h3===0,desc:"Sub-section structure",na:plain},
    {label:"Internal links",value:structure.internal,ideal:"3+",ok:structure.internal>=3,warn:structure.internal===0,desc:"Links to other pages on your site",na:plain},
    {label:"External links",value:structure.external,ideal:"1–5",ok:structure.external>=1&&structure.external<=5,warn:structure.external===0,desc:"Outbound authority links (raw URLs count in plain text)",na:false},
    {label:"Images with alt text",value:structure.images,ideal:"2+",ok:structure.images>=2,warn:structure.images===0,desc:"Visual content with alt attributes",na:plain},
    {label:"Tables present",value:structure.tables,ideal:"1+",ok:structure.tables>=1,warn:structure.tables===0,desc:"Structured data tables for featured snippets",na:plain},
    {label:"Paragraphs",value:structure.paragraphs,ideal:"5+",ok:structure.paragraphs>=5,warn:structure.paragraphs<3,desc:"Content broken into scannable sections",na:false},
    {label:"Long paragraphs (150+ words)",value:structure.longParas,ideal:"0",ok:structure.longParas===0,warn:structure.longParas>2,desc:"Paragraphs that may hurt readability",na:false},
  ];
  const scored=checks.filter(c=>!c.na);
  const passed=scored.filter(c=>c.ok).length;
  const score=Math.round((passed/(scored.length||1))*100);
  const issues=scored.filter(c=>c.warn).length;
  const banner=mode==="html"
    ?{label:"HTML mode",bg:G.greenLight,col:G.green,txt:"Parsed your pasted HTML — headings, links and images were read from real tags."}
    :mode==="markdown"
    ?{label:"Markdown mode",bg:G.blueLight,col:G.blue,txt:"Markdown formatting detected (# H1, ## H2, [links], ![images])."}
    :{label:"Plain-text mode",bg:G.yellowLight,col:G.yellow,txt:"Plain text can't reveal headings, links or images. Paste your page's HTML (or Markdown) for a full audit — below we only score what plain text can show."};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Structural SEO elements: headings, links, images, and content layout">SEO structure checker</SectionTitle>
      <div style={{background:banner.bg,border:`1px solid ${banner.col}33`,borderRadius:12,padding:"10px 14px",fontSize:12.5,color:G.textSec,lineHeight:1.5}}>
        <b style={{color:banner.col}}>{banner.label}</b> — {banner.txt}
      </div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <GStat label="Structure score" value={`${score}%`} icon={score>=70?"✅":"⚠️"} color={score>=70?G.green:G.yellow}/>
        <GStat label="Checks passed" value={passed} icon="✓" color={G.green} sub={`of ${scored.length} scored`}/>
        <GStat label="Issues found" value={issues} icon="⚠️" color={issues>0?G.red:G.green} sub="need attention"/>
      </div>
      <GCard padding={0}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${G.border}`,fontSize:13,fontWeight:500,color:G.textSec}}>Checklist</div>
        {checks.map((check,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 100px 110px",alignItems:"center",gap:16,padding:"12px 16px",borderBottom:i<checks.length-1?`1px solid ${G.border}`:"none",background:check.na?G.surface:check.warn?G.redLight+"55":check.ok?G.greenLight+"22":G.surface}}>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:check.na?G.textHint:G.text}}>{check.label}</div>
              <div style={{fontSize:11,color:G.textHint,marginTop:2}}>{check.desc}</div>
            </div>
            <span style={{fontSize:20,fontWeight:700,color:check.na?G.textHint:G.text,textAlign:"center"}}>{check.na?"—":check.value}</span>
            <span style={{fontSize:12,color:G.textHint,textAlign:"center"}}>ideal: {check.ideal}</span>
            <div style={{textAlign:"center"}}>
              {check.na?<GBadge color={G.textSec} bg={G.hover}>Needs HTML</GBadge>:check.ok?<GBadge color={G.green} bg={G.greenLight}>✓ Pass</GBadge>:check.warn?<GBadge color={G.red} bg={G.redLight}>✗ Fix</GBadge>:<GBadge color={G.yellow} bg={G.yellowLight}>~ OK</GBadge>}
            </div>
          </div>
        ))}
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
function ExportTab({analysis,exportCSV,exportFullCSV,exportJSON}) {
  const exports=[
    {label:"Keywords CSV",desc:"Top 200 keywords with count and density",icon:"📊",action:exportCSV,color:G.green,bg:G.greenLight},
    {label:"Full Report CSV",desc:"Keywords + 2/3-gram phrases + WH questions",icon:"📋",action:exportFullCSV,color:G.blue,bg:G.blueLight},
    {label:"JSON Export",desc:"Complete structured analysis data",icon:"📦",action:exportJSON,color:G.purple,bg:G.purpleLight},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle sub="Download your analysis in multiple formats">Export analysis</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
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
        <div style={{padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 32px"}}>
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



// ── SEO Score (target-keyword aware) ─────────────────────────────────────────
export function computeSeoScore(analysis, text, targetKeyword) {
  if (!analysis) return null;
  const checks = [];
  const add = (label, status, max, earned, detail) => checks.push({ label, status, max, earned, detail });
  const tw = analysis.totalWords;

  if (tw >= 300) add("Content length", "pass", 15, 15, `${tw} words`);
  else if (tw >= 150) add("Content length", "warn", 15, 8, `${tw} words — aim 300+`);
  else add("Content length", "fail", 15, 0, `${tw} words — too short`);

  const fk = analysis.readability.score;
  if (fk >= 60) add("Readability", "pass", 15, 15, `${fk}/100`);
  else if (fk >= 40) add("Readability", "warn", 15, 8, `${fk}/100 — a bit hard`);
  else add("Readability", "fail", 15, 0, `${fk}/100 — hard to read`);

  if (analysis.stuffing.length === 0) add("No keyword stuffing", "pass", 15, 15, "");
  else add("No keyword stuffing", "fail", 15, 0, `${analysis.stuffing.length} over 5%`);

  if (analysis.questions.length > 0) add("Question coverage", "pass", 10, 10, `${analysis.questions.length} found`);
  else add("Question coverage", "warn", 10, 4, "Add Q&A for snippets");

  const rich = analysis.uniqueWords / (tw || 1);
  if (rich >= 0.3) add("Vocabulary variety", "pass", 10, 10, `${Math.round(rich * 100)}%`);
  else add("Vocabulary variety", "warn", 10, 5, `${Math.round(rich * 100)}% — repetitive`);

  const kw = (targetKeyword || "").trim().toLowerCase();
  if (kw) {
    const low = (text || "").toLowerCase();
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (low.match(new RegExp(`\\b${esc}\\b`, "g")) || []).length;
    const density = (count / (tw || 1)) * 100;
    const intro = analysis.tokens.slice(0, 100).join(" ");
    const inIntro = (" " + intro + " ").includes(" " + kw + " ") || intro.includes(kw);

    if (count > 0) add("Target keyword used", "pass", 15, 15, `“${targetKeyword}” ×${count}`);
    else add("Target keyword used", "fail", 15, 0, `“${targetKeyword}” not found`);

    if (count > 0 && density >= 0.5 && density <= 2.5) add("Target density", "pass", 10, 10, `${density.toFixed(2)}%`);
    else if (count > 0) add("Target density", "warn", 10, 5, `${density.toFixed(2)}% — aim 0.5–2.5%`);
    else add("Target density", "fail", 10, 0, "0%");

    if (inIntro) add("Keyword in intro", "pass", 10, 10, "first 100 words");
    else add("Keyword in intro", "warn", 10, 3, "use it early");
  }

  const max = checks.reduce((a, c) => a + c.max, 0) || 1;
  const earned = checks.reduce((a, c) => a + c.earned, 0);
  const score = Math.round((earned / max) * 100);
  const status = score >= 90 ? { label: "Excellent", color: G.green }
               : score >= 75 ? { label: "Good", color: G.green }
               : score >= 50 ? { label: "Needs work", color: G.yellow }
               :               { label: "Poor", color: G.red };
  return { score, status, checks, hasTarget: !!kw };
}

export function SeoScore({ analysis, text, targetKeyword }) {
  const data = computeSeoScore(analysis, text, targetKeyword);
  if (!data) {
    return (
      <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 16, padding: 18, boxShadow: G.shadowSm, marginBottom: 20, fontFamily: font, color: G.textSec, fontSize: 13 }}>
        Paste content to see your SEO score.
      </div>
    );
  }
  const { score, status, checks, hasTarget } = data;
  const R = 32, C = 2 * Math.PI * R;
  return (
    <div style={{ background: G.surface, border: `1px solid ${G.border}`, borderRadius: 16, padding: 20, boxShadow: G.shadowSm, marginBottom: 20, fontFamily: font }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <svg width="84" height="84" viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
          <circle cx="42" cy="42" r={R} fill="none" stroke={G.border} strokeWidth="8" />
          <circle cx="42" cy="42" r={R} fill="none" stroke={status.color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * C} ${C}`} transform="rotate(-90 42 42)" />
          <text x="42" y="46" textAnchor="middle" fontSize="22" fontWeight="700" fill={G.text} fontFamily={font}>{score}</text>
          <text x="42" y="60" textAnchor="middle" fontSize="9" fill={G.textSec} fontFamily={font}>/ 100</text>
        </svg>
        <div>
          <div style={{ fontSize: 12, color: G.textSec, fontWeight: 500 }}>SEO score</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: status.color }}>{status.label}</div>
          {!hasTarget && <div style={{ fontSize: 11, color: G.textHint, marginTop: 4 }}>Add a target keyword to unlock keyword checks</div>}
        </div>
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {checks.map((c, i) => {
          const ic = c.status === "pass" ? { m: "\u2713", col: G.green } : c.status === "warn" ? { m: "!", col: G.yellow } : { m: "\u2715", col: G.red };
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
              <span style={{ width: 18, height: 18, borderRadius: 999, background: ic.col + "22", color: ic.col, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{ic.m}</span>
              <span style={{ flex: 1, fontSize: 12.5, color: G.text }}>{c.label}</span>
              <span style={{ fontSize: 11, color: G.textHint, textAlign: "right" }}>{c.detail}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export { G, font, FreqTab, LongtailTab, QuestionsTab, NLPTab, OptTab, HighlighterTab, CompTab, StructTab, IntentTab, ExportTab };
