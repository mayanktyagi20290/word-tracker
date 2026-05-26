import { useState, useMemo } from "react";
import _ from "lodash";

// ── Google font injection ──────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@400;500&display=swap";
document.head.appendChild(fontLink);

// ── Design tokens (Google Material 3) ────────────────────────────────────────
const G = {
  blue:       "#1a73e8",
  blueLight:  "#e8f0fe",
  blueDark:   "#1557b0",
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
  bg:         "#f8f9fa",
  border:     "#dadce0",
  text:       "#202124",
  textSec:    "#5f6368",
  textHint:   "#80868b",
  hover:      "#f1f3f4",
  shadow:     "0 1px 3px 1px rgba(60,64,67,.15), 0 1px 2px rgba(60,64,67,.3)",
  shadowSm:   "0 1px 2px rgba(60,64,67,.3)",
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
function checkStructure(text) {
  return {
    h1:(text.match(/^#{1}\s.+/gm)||[]).length,
    h2:(text.match(/^#{2}\s.+/gm)||[]).length,
    h3:(text.match(/^#{3}\s.+/gm)||[]).length,
    internal:(text.match(/\[.*?\]\((?!https?:\/\/)[^)]+\)/g)||[]).length,
    external:(text.match(/\[.*?\]\(https?:\/\/[^)]+\)/g)||[]).length,
    images:(text.match(/!\[.*?\]\([^)]+\)/g)||[]).length,
    tables:(text.match(/\|.+\|/g)||[]).length>0?1:0,
    paragraphs:text.split(/\n{2,}/).filter(p=>p.trim().length>50).length,
    longParas:text.split(/\n{2,}/).filter(p=>p.split(/\s+/).length>150).length,
  };
}

// ── Google UI primitives ───────────────────────────────────────────────────────
const font = "'Google Sans', 'Roboto', sans-serif";

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

// ── Main app ───────────────────────────────────────────────────────────────────
export default function SEOTracker() {
  const [text, setText] = useState("");
  const [compText, setCompText] = useState("");
  const [tab, setTab] = useState("frequency");
  const [filterStop, setFilterStop] = useState(true);
  const [phraseLen, setPhraseLen] = useState(2);
  const [customN, setCustomN] = useState(4);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
    return {tokens,clean,freqEntries,totalWords,uniqueWords,phrases,questions,entities,intent,readability,structure,topKeywords,overused,stuffing,clusters,lsi};
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
    const data={summary:{totalWords:analysis.totalWords,uniqueWords:analysis.uniqueWords,readability:analysis.readability},topKeywords:analysis.topKeywords,phrases:{bigrams:(analysis.phrases[2]||[]).slice(0,50),trigrams:(analysis.phrases[3]||[]).slice(0,50)},questions:analysis.questions.slice(0,30),intent:analysis.intent,entities:analysis.entities,structure:analysis.structure};
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="seo-analysis.json";a.click();
  };

  const wordCount = text ? tokenize(text).length : 0;

  return (
    <div style={{fontFamily:font,background:G.bg,minHeight:"100vh",display:"flex",flexDirection:"column",color:G.text}}>
      
      {/* ── Google-style top bar ── */}
      <header style={{background:G.surface,borderBottom:`1px solid ${G.border}`,padding:"0 24px",display:"flex",alignItems:"center",gap:16,height:64,flexShrink:0,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {/* Google-style coloured dots logo */}
          <svg width="28" height="28" viewBox="0 0 28 28">
            <circle cx="7" cy="7" r="5.5" fill="#4285f4"/>
            <circle cx="21" cy="7" r="5.5" fill="#ea4335"/>
            <circle cx="7" cy="21" r="5.5" fill="#34a853"/>
            <circle cx="21" cy="21" r="5.5" fill="#fbbc04"/>
          </svg>
          <span style={{fontSize:18,fontWeight:700,color:G.text,letterSpacing:-.3}}>SEO</span>
          <span style={{fontSize:18,fontWeight:400,color:G.textSec}}>Analyzer</span>
        </div>

        {/* Search-bar style input */}
        <div style={{flex:1,maxWidth:720,position:"relative"}}>
          <svg style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",opacity:.5}} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G.textSec} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <textarea
            value={text}
            onChange={e=>setText(e.target.value)}
            placeholder="Paste your content here to analyze (supports 50,000+ words)..."
            style={{
              width:"100%",height:44,background:G.bg,border:`1px solid ${G.border}`,
              borderRadius:24,padding:"10px 20px 10px 46px",fontFamily:font,fontSize:14,
              color:G.text,resize:"none",outline:"none",boxSizing:"border-box",
              lineHeight:"24px",overflow:"hidden",transition:"border-color .2s, box-shadow .2s",
            }}
            onFocus={e=>{e.target.style.borderColor=G.blue;e.target.style.boxShadow=`0 0 0 2px ${G.blueLight}`;e.target.style.height="120px";e.target.style.borderRadius="12px";}}
            onBlur={e=>{e.target.style.borderColor=G.border;e.target.style.boxShadow="none";e.target.style.height="44px";e.target.style.borderRadius="24px";}}
          />
          {text && <div style={{position:"absolute",right:16,bottom:-20,fontSize:11,color:G.textHint}}>{wordCount.toLocaleString()} words · {text.length.toLocaleString()} chars</div>}
        </div>

        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:G.textSec,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}>
          <input type="checkbox" checked={filterStop} onChange={e=>setFilterStop(e.target.checked)} style={{accentColor:G.blue,width:16,height:16}}/>
          Filter stop words
        </label>
      </header>

      <div style={{display:"flex",flex:1,overflow:"hidden",marginTop:8}}>
        
        {/* ── Google-style left nav ── */}
        <nav style={{width:sidebarOpen?240:0,background:G.surface,borderRight:`1px solid ${G.border}`,flexShrink:0,overflowY:"auto",overflowX:"hidden",transition:"width .2s ease"}}>
          <div style={{padding:"8px 0",minWidth:240}}>
            {analysis && (
              <div style={{padding:"8px 12px 16px",borderBottom:`1px solid ${G.border}`,marginBottom:8}}>
                <div style={{fontSize:11,color:G.textHint,textTransform:"uppercase",letterSpacing:.8,marginBottom:10,fontWeight:500}}>Content Overview</div>
                {[
                  {l:"Words",v:analysis.totalWords.toLocaleString(),c:G.blue},
                  {l:"Unique",v:analysis.uniqueWords.toLocaleString(),c:G.green},
                  {l:"Readability",v:`${analysis.readability.score}/100`,c:analysis.readability.score>=60?G.green:analysis.readability.score>=40?G.yellow:G.red},
                  {l:"Intent",v:analysis.intent[0]?.intent,c:G.purple},
                ].map(({l,v,c})=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0"}}>
                    <span style={{fontSize:12,color:G.textSec}}>{l}</span>
                    <span style={{fontSize:12,fontWeight:500,color:c,textTransform:"capitalize"}}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            {TABS.map(t=>{
              const active=tab===t.id;
              return (
                <button key={t.id} onClick={()=>setTab(t.id)}
                  style={{
                    width:"100%",textAlign:"left",padding:"10px 12px",
                    background:active?G.blueLight:"transparent",
                    borderRadius:active?"0 24px 24px 0":"0 24px 24px 0",
                    border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:12,
                    color:active?G.blue:G.textSec,fontFamily:font,fontSize:14,
                    fontWeight:active?500:400,transition:"all .1s",marginRight:12,
                  }}
                  onMouseEnter={e=>{if(!active)e.currentTarget.style.background=G.hover;}}
                  onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}
                >
                  <span style={{fontSize:18,lineHeight:1}}>{
                    {frequency:"📊",longtail:"🔗",questions:"❓",nlp:"🧠",optimization:"⚡",highlighter:"🖍️",competitor:"🆚",structure:"🏗",intent:"🎯",export:"💾"}[t.id]
                  }</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content area ── */}
        <main style={{flex:1,overflowY:"auto",padding:"16px 24px 32px",display:"flex",flexDirection:"column"}}>
          {!text.trim() ? (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:16,textAlign:"center"}}>
              <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke={G.border} strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <div style={{fontSize:22,fontWeight:500,color:G.text}}>Paste content to analyze</div>
              <div style={{fontSize:14,color:G.textSec,maxWidth:400}}>
                Type or paste your text in the search bar above. Supports 50,000+ words with real-time SEO analysis across 9 dimensions.
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginTop:8}}>
                {["Word Frequency","Long-tail Phrases","WH Questions","Intent Detection","Competitor Gap"].map(f=>(
                  <GChip key={f} color={G.blue}>{f}</GChip>
                ))}
              </div>
            </div>
          ) : (
            <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
              <TabRouter tab={tab} analysis={analysis} compText={compText} setCompText={setCompText} compAnalysis={compAnalysis} phraseLen={phraseLen} setPhraseLen={setPhraseLen} customN={customN} setCustomN={setCustomN} exportCSV={exportCSV} exportFullCSV={exportFullCSV} exportJSON={exportJSON} rawText={text} />
            </div>
          )}
        </main>
      </div>
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

// ── Content Highlighter ────────────────────────────────────────────────────────
function HighlighterTab({analysis, rawText}) {
  // Fixed rules: >1.5% = stuffing (red), >1% = overused (yellow), >0.5% = high (blue)
  const STUFFING  = 1.5;
  const OVERUSED  = 1.0;
  const HIGH      = 0.5;

  const hotKeywords = useMemo(() => {
    if (!analysis) return new Map();
    const map = new Map();
    analysis.freqEntries.forEach(([word, count]) => {
      const density = (count / analysis.totalWords) * 100;
      if (density >= HIGH) map.set(word, density);
    });
    return map;
  }, [analysis]);

  const getHighlightStyle = (density) => {
    if (density >= STUFFING) return { background:"#fce8e6", color:"#c5221f", borderBottom:"2px solid #d93025" };
    if (density >= OVERUSED) return { background:"#fef7e0", color:"#b06000", borderBottom:"2px solid #f9ab00" };
    return { background:"#e8f0fe", color:"#1557b0", borderBottom:"2px solid #1a73e8" };
  };

  const renderHighlighted = useMemo(() => {
    if (!rawText || hotKeywords.size === 0) return [<span key="0">{rawText}</span>];
    const words = [...hotKeywords.keys()].sort((a,b) => b.length - a.length);
    const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const regex = new RegExp(`\\b(${escaped.join('|')})\\b`,'gi');
    const parts = []; let lastIndex=0, key=0;
    regex.lastIndex=0;
    let match;
    while ((match=regex.exec(rawText))!==null) {
      if (match.index>lastIndex) parts.push(<span key={key++}>{rawText.slice(lastIndex,match.index)}</span>);
      const word=match[0].toLowerCase();
      const density=hotKeywords.get(word)||0;
      parts.push(
        <mark key={key++} title={`"${word}" — ${density.toFixed(2)}% density`}
          style={{...getHighlightStyle(density), borderRadius:3, padding:"1px 4px", cursor:"help", fontWeight:600, textDecoration:"none"}}>
          {match[0]}
        </mark>
      );
      lastIndex=match.index+match[0].length;
    }
    if (lastIndex<rawText.length) parts.push(<span key={key++}>{rawText.slice(lastIndex)}</span>);
    return parts;
  }, [rawText, hotKeywords]);

  const stuffingKw = [...hotKeywords.entries()].filter(([,d])=>d>=STUFFING).sort((a,b)=>b[1]-a[1]);
  const overusedKw = [...hotKeywords.entries()].filter(([,d])=>d>=OVERUSED&&d<STUFFING).sort((a,b)=>b[1]-a[1]);
  const highKw     = [...hotKeywords.entries()].filter(([,d])=>d>=HIGH&&d<OVERUSED).sort((a,b)=>b[1]-a[1]);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12,flex:1,minHeight:0,height:"100%"}}>

      {/* ── Top control bar ── */}
      <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap",flexShrink:0}}>
        <SectionTitle sub="">Content keyword highlighter</SectionTitle>
        <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
          <span style={{background:"#fce8e6",color:"#c5221f",border:"1px solid #d9302544",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:500}}>
            🔴 Stuffing &gt;{STUFFING}% — {stuffingKw.length} words
          </span>
          <span style={{background:"#fef7e0",color:"#b06000",border:"1px solid #f9ab0044",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:500}}>
            🟡 Overused &gt;{OVERUSED}% — {overusedKw.length} words
          </span>
          <span style={{background:"#e8f0fe",color:"#1557b0",border:"1px solid #1a73e844",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:500}}>
            🔵 High &gt;{HIGH}% — {highKw.length} words
          </span>
        </div>
      </div>

      {/* ── Split screen ── */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, flex:1, minHeight:600, height:"calc(100vh - 220px)"}}>

        {/* LEFT — highlighted text */}
        <div style={{display:"flex",flexDirection:"column",border:`1px solid ${G.border}`,borderRadius:8,background:G.surface,overflow:"hidden",boxShadow:G.shadowSm}}>
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${G.border}`,background:G.bg,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <span style={{fontSize:13,fontWeight:500,color:G.textSec}}>📄 Your content</span>
            <span style={{fontSize:11,color:G.textHint}}>Hover highlighted words for density %</span>
          </div>
          <div style={{
            flex:1, overflowY:"auto",
            padding:"20px 24px",
            fontSize:14, lineHeight:2, color:G.text,
            whiteSpace:"pre-wrap", wordBreak:"break-word",
            fontFamily:"Georgia, 'Times New Roman', serif",
          }}>
            {renderHighlighted}
          </div>
        </div>

        {/* RIGHT — overview panel */}
        <div style={{display:"flex",flexDirection:"column",gap:12,overflowY:"auto"}}>

          {/* Summary stats */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              {l:"Total words",v:analysis.totalWords.toLocaleString(),c:G.blue},
              {l:"Unique words",v:analysis.uniqueWords.toLocaleString(),c:G.green},
              {l:"Stuffing words",v:stuffingKw.length,c:G.red},
              {l:"Overused words",v:overusedKw.length,c:G.yellow},
            ].map(({l,v,c})=>(
              <div key={l} style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:8,padding:"12px 14px",boxShadow:G.shadowSm}}>
                <div style={{fontSize:11,color:G.textSec,fontWeight:500,marginBottom:4}}>{l}</div>
                <div style={{fontSize:22,fontWeight:700,color:c}}>{v}</div>
              </div>
            ))}
          </div>

          {/* Stuffing keywords */}
          {stuffingKw.length>0&&(
            <div style={{background:G.surface,border:`1px solid #d9302533`,borderRadius:8,overflow:"hidden",boxShadow:G.shadowSm}}>
              <div style={{padding:"8px 14px",background:"#fce8e6",borderBottom:`1px solid #d9302522`,fontSize:12,fontWeight:600,color:"#c5221f"}}>
                🔴 Keyword stuffing — above {STUFFING}%
              </div>
              <div style={{maxHeight:180,overflowY:"auto"}}>
                {stuffingKw.map(([word,density],i)=>{
                  const count=analysis.freqEntries.find(([w])=>w===word)?.[1]||0;
                  return (
                    <div key={word} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 14px",borderBottom:i<stuffingKw.length-1?`1px solid ${G.border}`:"none",background:i%2===0?G.surface:"#fafafa"}}>
                      <span style={{background:"#fce8e6",color:"#c5221f",borderRadius:999,padding:"2px 10px",fontSize:13,fontWeight:500}}>{word}</span>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontSize:12,color:G.textSec}}>{count}×</span>
                        <span style={{fontSize:13,fontWeight:700,color:"#d93025"}}>{density.toFixed(2)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overused keywords */}
          {overusedKw.length>0&&(
            <div style={{background:G.surface,border:`1px solid #f9ab0033`,borderRadius:8,overflow:"hidden",boxShadow:G.shadowSm}}>
              <div style={{padding:"8px 14px",background:"#fef7e0",borderBottom:`1px solid #f9ab0022`,fontSize:12,fontWeight:600,color:"#b06000"}}>
                🟡 Overused — {OVERUSED}% to {STUFFING}%
              </div>
              <div style={{maxHeight:160,overflowY:"auto"}}>
                {overusedKw.map(([word,density],i)=>{
                  const count=analysis.freqEntries.find(([w])=>w===word)?.[1]||0;
                  return (
                    <div key={word} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 14px",borderBottom:i<overusedKw.length-1?`1px solid ${G.border}`:"none",background:i%2===0?G.surface:"#fafafa"}}>
                      <span style={{background:"#fef7e0",color:"#b06000",borderRadius:999,padding:"2px 10px",fontSize:13,fontWeight:500}}>{word}</span>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontSize:12,color:G.textSec}}>{count}×</span>
                        <span style={{fontSize:13,fontWeight:700,color:"#f9ab00"}}>{density.toFixed(2)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* High density keywords */}
          {highKw.length>0&&(
            <div style={{background:G.surface,border:`1px solid #1a73e833`,borderRadius:8,overflow:"hidden",boxShadow:G.shadowSm}}>
              <div style={{padding:"8px 14px",background:"#e8f0fe",borderBottom:`1px solid #1a73e822`,fontSize:12,fontWeight:600,color:"#1557b0"}}>
                🔵 High density — {HIGH}% to {OVERUSED}%
              </div>
              <div style={{maxHeight:160,overflowY:"auto"}}>
                {highKw.map(([word,density],i)=>{
                  const count=analysis.freqEntries.find(([w])=>w===word)?.[1]||0;
                  return (
                    <div key={word} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 14px",borderBottom:i<highKw.length-1?`1px solid ${G.border}`:"none",background:i%2===0?G.surface:"#fafafa"}}>
                      <span style={{background:"#e8f0fe",color:"#1557b0",borderRadius:999,padding:"2px 10px",fontSize:13,fontWeight:500}}>{word}</span>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <span style={{fontSize:12,color:G.textSec}}>{count}×</span>
                        <span style={{fontSize:13,fontWeight:700,color:"#1a73e8"}}>{density.toFixed(2)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Safe zone tip */}
          <div style={{background:"#e6f4ea",border:"1px solid #1e8e3e33",borderRadius:8,padding:"12px 16px"}}>
            <div style={{fontSize:12,fontWeight:600,color:G.green,marginBottom:6}}>✅ Safe keyword density guide</div>
            <div style={{fontSize:12,color:G.textSec,lineHeight:1.8}}>
              <div>🟢 <b>0% – {HIGH}%</b> — Safe, no highlight</div>
              <div>🔵 <b>{HIGH}% – {OVERUSED}%</b> — High, monitor</div>
              <div>🟡 <b>{OVERUSED}% – {STUFFING}%</b> — Overused, reduce</div>
              <div>🔴 <b>&gt;{STUFFING}%</b> — Stuffing risk, fix now</div>
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
function StructTab({analysis}) {
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
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 100px 80px",alignItems:"center",gap:16,padding:"12px 16px",borderBottom:i<checks.length-1?`1px solid ${G.border}`:"none",background:check.warn?G.redLight+"55":check.ok?G.greenLight+"22":G.surface}}>
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
