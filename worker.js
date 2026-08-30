
const MONTHS_EN=["january","february","march","april","may","june","july","august","september","october","november","december"];
const MONTHS_ES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function strip(html=""){
 return html
  .replace(/<script[\s\S]*?<\/script>/gi," ")
  .replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ")
  .replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/&quot;|&#34;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'")
  .replace(/&ndash;|&#8211;/gi,"–")
  .replace(/&mdash;|&#8212;/gi,"—")
  .replace(/\s+/g," ")
  .trim();
}
function abs(href){
 if(!href)return null;
 if(href.startsWith("http"))return href;
 return "https://www.jw.org"+(href.startsWith("/")?href:"/"+href);
}
function mondayOf(date){
 const d=new Date(date+"T12:00:00Z");
 const dow=d.getUTCDay();
 const shift=(dow+6)%7;
 d.setUTCDate(d.getUTCDate()-shift);
 return d;
}
function iso(d){return d.toISOString().slice(0,10);}
function firstMonday(year,month0){
 const d=new Date(Date.UTC(year,month0,1,12));
 while(d.getUTCDay()!==1)d.setUTCDate(d.getUTCDate()+1);
 return d;
}
function issueInfo(monday,lang){
 const month=monday.getUTCMonth();
 const year=monday.getUTCFullYear();
 const firstMonth=month%2===0?month:month-1;
 const months=lang==="es"?MONTHS_ES:MONTHS_EN;
 const span=`${months[firstMonth]}-${months[firstMonth+1]}-${year}-mwb`;
 const base=lang==="es"
   ?"https://www.jw.org/es/biblioteca/guia-actividades-reunion-testigos-jehova/"
   :"https://www.jw.org/en/library/jw-meeting-workbook/";
 const first=firstMonday(year,firstMonth);
 const weekIndex=Math.max(0,Math.round((monday-first)/(7*86400000)));
 return {url:base+span+"/",weekIndex};
}
async function getText(url){
 const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 SpiritualRoutine/1.0","Accept-Language":"en,es;q=0.9"}});
 if(!r.ok)throw new Error(`${r.status} ${url}`);
 return await r.text();
}
function links(html){
 const out=[];const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;
 while((m=re.exec(html)))out.push({href:abs(m[1]),text:strip(m[2])});
 return out;
}
function unique(arr){const seen=new Set();return arr.filter(x=>x.href&&!seen.has(x.href)&&(seen.add(x.href),true));}

function workbookCandidates(html,lang){
 const all=unique(links(html));
 return all.filter(x=>{
  const h=x.href.toLowerCase();
  if(lang==="es")return h.includes("/guia-actividades-reunion-testigos-jehova/")&&!h.includes("mwbr")&&h.match(/202\d/);
  return h.includes("/jw-meeting-workbook/")&&h.includes("life-and-ministry-meeting-schedule-for-");
 });
}
function headings(html){
 const out=[];const re=/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;let m;
 while((m=re.exec(html)))out.push({level:+m[1],text:strip(m[2]),index:m.index});
 return out;
}

function spiritualGemsData(html,lang){
 const text=strip(html);
 const li=lang==="es";
 const label=li?/Busquemos perlas escondidas/i:/Spiritual Gems/i;
 const start=text.search(label);
 if(start<0)return {gemsQuestion:"",gemsReference:"",gemsSource:""};
 const tail=text.slice(start,start+1800);
 const stopPatterns=li
   ? [/Lectura de la Biblia/i,/SEAMOS MEJORES MAESTROS/i,/NUESTRA VIDA CRISTIANA/i]
   : [/Bible Reading/i,/APPLY YOURSELF TO THE FIELD MINISTRY/i,/LIVING AS CHRISTIANS/i];
 let end=tail.length;
 for(const p of stopPatterns){const i=tail.search(p);if(i>0&&i<end)end=i;}
 const section=tail.slice(0,end);

 // Capture the first specific research question, not the generic "what gems did you find?"
 const qRe=li
   ? /([1-3]?\s?[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+\s+\d+:\d+(?:[–-]\d+)?)[.\s—-]+([^?]{8,260}\?)/i
   : /([1-3]?\s?[A-Z][A-Za-z]+\s+\d+:\d+(?:[–-]\d+)?)[.\s—-]+([^?]{8,260}\?)/i;
 const m=section.match(qRe);
 if(!m)return {gemsQuestion:"",gemsReference:"",gemsSource:""};
 const sourceMatch=m[0].match(/\(([^()]{2,180})\)/);
 return {
   gemsReference:m[1].trim(),
   gemsQuestion:m[2].replace(/\([^)]*\)\s*$/,"").trim(),
   gemsSource:sourceMatch?sourceMatch[1].trim():""
 };
}


function normalizeRef(s=""){
 return s.replace(/\s+/g," ").replace(/\s*[-–]\s*/g,"–").trim();
}
function parseWeeklyRange(weeklyBible=""){
 // Handles examples such as "Jeremiah 31", "Jeremiah 32–33", "1 Kings 5–6".
 const m=weeklyBible.match(/^(.+?)\s+(\d+)(?:[–-](\d+))?$/);
 if(!m)return null;
 return {book:m[1].trim(),start:+m[2],end:+(m[3]||m[2])};
}
function verseRefsFromSection(text,weeklyBible){
 const range=parseWeeklyRange(weeklyBible);
 if(!range)return [];
 const escaped=range.book.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
 const re=new RegExp(`(${escaped})\\s+(\\d+):(\\d+)(?:[–-](\\d+))?`,"gi");
 const out=[];let m;
 while((m=re.exec(text))){
   const ch=+m[2];
   if(ch<range.start||ch>range.end)continue;
   out.push(normalizeRef(`${m[1]} ${m[2]}:${m[3]}${m[4]?`–${m[4]}`:""}`));
 }
 return [...new Set(out)];
}
function bibleUrlFromReference(ref,lang){
 // Convert a scripture reference into a JW.org chapter URL. Book slug is normalized conservatively.
 const m=ref.match(/^(.+?)\s+(\d+):/);
 if(!m)return null;
 const book=m[1].trim();
 const chapter=m[2];
 const slug=book
   .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .toLowerCase()
   .replace(/\s+/g,"-")
   .replace(/[^a-z0-9-]/g,"");
 if(!slug)return null;
 return lang==="es"
   ? `https://www.jw.org/es/biblioteca/biblia/biblia-estudio/libros/${slug}/${chapter}/`
   : `https://www.jw.org/en/library/bible/study-bible/books/${slug}/${chapter}/`;
}
function chooseAdditionalGems(html,weeklyBible,officialRef,meetingReading,lang){
 const text=strip(html);
 const refs=verseRefsFromSection(text,weeklyBible)
   .filter(r=>r!==normalizeRef(officialRef||"") && r!==normalizeRef(meetingReading||""));
 // Prefer a spread across the page instead of adjacent duplicate references.
 const picked=[];
 for(const ref of refs){
   if(picked.length>=5)break;
   const base=ref.replace(/[–-]\d+$/,"");
   if(picked.some(x=>x.reference.replace(/[–-]\d+$/,"")===base))continue;
   picked.push({reference:ref,url:bibleUrlFromReference(ref,lang)});
 }
 // If workbook references are sparse, derive a few study points from the weekly range.
 if(picked.length<3){
   const range=parseWeeklyRange(weeklyBible);
   if(range){
     const fallbackVerses=[3,7,11,18,25,31];
     for(let ch=range.start;ch<=range.end && picked.length<5;ch++){
       for(const v of fallbackVerses){
         const ref=`${range.book} ${ch}:${v}`;
         if(ref===officialRef||ref===meetingReading||picked.some(x=>x.reference===ref))continue;
         picked.push({reference:ref,url:bibleUrlFromReference(ref,lang)});
         if(picked.length>=5)break;
       }
     }
   }
 }
 return picked.slice(0,5);
}

function pageData(html,lang,url){
 const text=strip(html);
 const hs=headings(html);
 const li=lang==="es";
 let weeklyBible="";
 // First prominent all-caps Bible-book + chapter range style heading.
 for(const h of hs){
  if(/\b\d{1,3}(?:\s*[–-]\s*\d{1,3})?\b/.test(h.text) && h.text.length<80){
    const low=h.text.toLowerCase();
    if(!low.includes("ministry")&&!low.includes("ministerio")&&!low.includes("week")&&!low.includes("semana")){
      weeklyBible=h.text;break;
    }
  }
 }
 let meetingReading="";
 const br=li
  ? text.match(/Lectura de la Biblia[^.]{0,180}?([1-3]?\s?[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+\s+\d+:\d+(?:[–-]\d+)?)/i)
  : text.match(/Bible Reading[^.]{0,180}?([1-3]?\s?[A-Z][A-Za-z]+\s+\d+:\d+(?:[–-]\d+)?)/i);
 if(br)meetingReading=br[1];

 let treasures="",living="",congregation="";
 // Identify likely section headings and next specific heading.
 const treasureLabel=li?"TESOROS DE LA BIBLIA":"TREASURES FROM GOD’S WORD";
 const livingLabel=li?"NUESTRA VIDA CRISTIANA":"LIVING AS CHRISTIANS";
 for(let i=0;i<hs.length;i++){
   const x=hs[i].text.toUpperCase();
   if(!treasures && (x.includes("TREASURES FROM GOD")||x.includes("TESOROS DE LA BIBLIA"))){
     for(let j=i+1;j<hs.length;j++){if(hs[j].text&&hs[j].text.length>4){treasures=hs[j].text;break;}}
   }
   if(!living && (x.includes("LIVING AS CHRISTIANS")||x.includes("NUESTRA VIDA CRISTIANA"))){
     for(let j=i+1;j<hs.length;j++){if(hs[j].text&&hs[j].text.length>4){living=hs[j].text;break;}}
   }
 }
 const cbs=li
  ? text.match(/Estudio bíblico de la congregación[^.]{0,220}?((?:capítulo|cap\.)\s*\d+)/i)
  : text.match(/Congregation Bible Study[^.]{0,220}?((?:chapter|chap\.)\s*\d+)/i);
 if(cbs)congregation=cbs[1];

 const gems=spiritualGemsData(html,lang);
 const additionalGems=chooseAdditionalGems(html,weeklyBible,gems.gemsReference,meetingReading,lang);
 return {weeklyBible,meetingReading,treasures,living,congregation,mwbUrl:url,...gems,additionalGems};
}

function weekNeedles(monday,lang){
 const end=new Date(monday);end.setUTCDate(end.getUTCDate()+6);
 const months=lang==="es"?MONTHS_ES:MONTHS_EN;
 return {
  sd:monday.getUTCDate(),ed:end.getUTCDate(),
  sm:months[monday.getUTCMonth()],em:months[end.getUTCMonth()],
  year:end.getUTCFullYear()
 };
}
function blockMatchesWeek(block,monday,lang){
 const n=weekNeedles(monday,lang);
 const s=strip(block).toLowerCase();
 if(!s.includes(String(n.sd))||!s.includes(String(n.ed)))return false;
 if(!s.includes(n.sm)&&!s.includes(n.em))return false;
 return s.includes(String(n.year));
}
async function watchtowerData(monday,lang){
 const months=lang==="es"?MONTHS_ES:MONTHS_EN;
 const base=lang==="es"
  ?"https://www.jw.org/es/biblioteca/revistas/atalaya-estudio-"
  :"https://www.jw.org/en/library/magazines/watchtower-study-";
 // Probe current month and previous five months. Study issues are normally published ahead of study week.
 for(let back=0;back<6;back++){
   const d=new Date(monday);
   d.setUTCMonth(d.getUTCMonth()-back);
   const url=`${base}${months[d.getUTCMonth()]}-${d.getUTCFullYear()}/`;
   try{
    const html=await getText(url);
    const re=/<h2\b[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2\b|$)/gi;let m;
    while((m=re.exec(html))){
      const title=strip(m[1]);
      const block=m[0];
      if(title && blockMatchesWeek(block,monday,lang)){
        const ls=links(m[1]+m[2]);
        const article=ls.find(x=>x.href&&x.text===title)||ls.find(x=>x.href);
        return {watchtower:title,watchtowerUrl:article?article.href:url};
      }
    }
   }catch(e){}
 }
 return {watchtower:"",watchtowerUrl:""};
}


function monthNames(lang){
  return lang==="es"
    ? ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
    : ["january","february","march","april","may","june","july","august","september","october","november","december"];
}
function weekEnd(monday){
  const d=new Date(monday); d.setUTCDate(d.getUTCDate()+6); return d;
}
function normalizeDateText(s=""){
  return strip(s).toLowerCase().replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
}
function weeklyLinkMatchesDate(linkText,monday,lang){
  const s=normalizeDateText(linkText);
  const end=weekEnd(monday);
  const months=monthNames(lang);
  const sd=monday.getUTCDate(), ed=end.getUTCDate();
  const sm=months[monday.getUTCMonth()], em=months[end.getUTCMonth()];
  if(!s.includes(String(sd)) || !s.includes(String(ed))) return false;
  if(monday.getUTCMonth()===end.getUTCMonth()){
    return s.includes(sm);
  }
  return s.includes(sm) && s.includes(em);
}
async function findExactWeeklyPage(monday,lang){
  // Probe the issue that contains Monday plus the adjacent issue to survive month-boundary weeks.
  const probes=[];
  const m=new Date(monday);
  for(const delta of [0,-1,1]){
    const d=new Date(m);
    d.setUTCMonth(d.getUTCMonth()+delta);
    const info=issueInfo(d,lang);
    if(!probes.includes(info.url))probes.push(info.url);
  }
  for(const issueUrl of probes){
    try{
      const html=await getText(issueUrl);
      let candidates=workbookCandidates(html,lang);
      const exact=candidates.find(x=>weeklyLinkMatchesDate(x.text,monday,lang));
      if(exact)return exact;
    }catch(e){}
  }
  return null;
}


function localizedMonths(lang){
  return lang==="es"
    ? ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
    : ["january","february","march","april","may","june","july","august","september","october","november","december"];
}
function endOfWeek(monday){
  const d=new Date(monday);
  d.setUTCDate(d.getUTCDate()+6);
  return d;
}
function normalizeWeekText(s=""){
  return strip(s).toLowerCase().replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
}
function matchesWeekText(linkText,monday,lang){
  const s=normalizeWeekText(linkText);
  const end=endOfWeek(monday);
  const months=localizedMonths(lang);
  const sd=String(monday.getUTCDate());
  const ed=String(end.getUTCDate());
  const sm=months[monday.getUTCMonth()];
  const em=months[end.getUTCMonth()];

  // JW.org's issue index normally omits the year from weekly link text.
  if(!s.includes(sd) || !s.includes(ed)) return false;

  if(monday.getUTCMonth()===end.getUTCMonth()){
    return s.includes(sm);
  }
  return s.includes(sm) && s.includes(em);
}
async function exactWorkbookWeek(monday,lang){
  // The week belongs to the issue determined by its Monday. Probe adjacent
  // issue pages too, which makes cross-month/cross-issue weeks resilient.
  const urls=[];
  for(const delta of [0,-1,1]){
    const d=new Date(monday);
    d.setUTCMonth(d.getUTCMonth()+delta);
    const info=issueInfo(d,lang);
    if(!urls.includes(info.url)) urls.push(info.url);
  }

  for(const issueUrl of urls){
    try{
      const html=await getText(issueUrl);
      const candidates=workbookCandidates(html,lang);
      const exact=candidates.find(x=>matchesWeekText(x.text,monday,lang));
      if(exact) return exact;
    }catch(e){}
  }
  return null;
}

async function handleCurrentMaterial(request) {
  try {
    const u = new URL(request.url);
    const lang = u.searchParams.get("lang") === "es" ? "es" : "en";
    const date = u.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const monday = mondayOf(date);
    const chosen = await exactWorkbookWeek(monday, lang);
    if (!chosen) throw new Error("No exact weekly workbook page found for the requested date");
    const weekHtml = await getText(chosen.href);
    const mwb = pageData(weekHtml, lang, chosen.href);
    const wt = await watchtowerData(monday, lang);

    return new Response(JSON.stringify({
      weekStart: iso(monday),
      source: "jw.org",
      fetchedAt: new Date().toISOString(),
      ...mwb,
      ...wt
    }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=1800, s-maxage=21600, stale-while-revalidate=86400"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Unable to retrieve current JW.org material",
      detail: String(error?.message || error)
    }), {
      status: 502,
      headers: {"content-type":"application/json; charset=utf-8","cache-control":"no-store"}
    });
  }
}

const STATIC = {
  "/": { body: "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#f5f1e8\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-title\" content=\"Spiritual Routine\">\n<link rel=\"apple-touch-icon\" href=\"/icons/icon-192.png\">\n<link rel=\"manifest\" href=\"/manifest.webmanifest\">\n<link rel=\"stylesheet\" href=\"/styles.css\">\n<title>Spiritual Routine</title>\n</head>\n<body>\n<main class=\"app-shell\">\n<header class=\"hero\">\n  <div><p class=\"eyebrow\" data-i18n=\"weeklyPlan\">WEEKLY SPIRITUAL PLAN</p><h1 data-i18n=\"appTitle\">Spiritual Routine</h1></div>\n  <div id=\"headerDate\" class=\"header-date\"></div>\n</header>\n\n<div class=\"language-row\">\n  <label for=\"language\" data-i18n=\"language\">Language</label>\n  <select id=\"language\"><option value=\"en\">English</option><option value=\"es\">Espa\u00f1ol</option></select>\n</div>\n\n<nav class=\"tabs\" aria-label=\"App sections\">\n  <button type=\"button\" class=\"tab active\" data-tab=\"today\" data-i18n=\"today\">Today</button>\n  <button type=\"button\" class=\"tab\" data-tab=\"week\" data-i18n=\"week\">Week</button>\n  <button type=\"button\" class=\"tab\" data-tab=\"curriculum\" data-i18n=\"curriculum\">Elder Track</button>\n  <button type=\"button\" class=\"tab\" data-tab=\"progress\" data-i18n=\"progress\">Progress</button>\n  <button type=\"button\" class=\"tab\" data-tab=\"settings\" data-i18n=\"settings\">Settings</button>\n</nav>\n\n<section id=\"panel-today\" class=\"panel active\">\n  <section class=\"card\">\n    <p class=\"section-label\" data-i18n=\"todaysPlan\">TODAY'S PLAN</p>\n    <div class=\"row between start\">\n      <div><h2 id=\"todayDay\"></h2><p id=\"todaySummary\" class=\"muted\"></p></div>\n      <div id=\"totalMinutes\" class=\"pill\"></div>\n    </div>\n    <div id=\"todayTasks\" class=\"task-list\"></div>\n\n    <div class=\"official-card\">\n      <p class=\"section-label\" data-i18n=\"officialMaterial\">THIS WEEK'S MEETING MATERIAL</p>\n      <div id=\"officialMaterial\"></div>\n    </div>\n\n    <div class=\"gems-card\">\n      <p class=\"section-label\" data-i18n=\"gemsTitle\">SPIRITUAL GEMS</p>\n      <div id=\"gemsContent\"></div>\n\n      <div class=\"additional-gems\">\n        <div class=\"additional-gems-head\">\n          <strong data-i18n=\"additionalGems\">Additional Gems to Explore</strong>\n          <span data-i18n=\"notOfficial\">Personal research prompts \u2014 not official meeting answers</span>\n        </div>\n        <div id=\"additionalGemsList\"></div>\n      </div>\n\n      <label class=\"field-label\" for=\"gemNote\" data-i18n=\"myGem\">My gem from this week's reading</label>\n      <textarea id=\"gemNote\" rows=\"3\"></textarea>\n      <button type=\"button\" id=\"saveGem\" class=\"secondary full\" data-i18n=\"saveGem\">Save my gem</button>\n      <p id=\"gemStatus\" class=\"status\" aria-live=\"polite\"></p>\n    </div>\n\n    <label class=\"field-label\" for=\"note\" data-i18n=\"note\">What I learned / want to remember</label>\n    <textarea id=\"note\" rows=\"4\"></textarea>\n    <button type=\"button\" id=\"saveNote\" class=\"secondary full\" data-i18n=\"saveNote\">Save note</button>\n    <p id=\"status\" class=\"status\" aria-live=\"polite\"></p>\n  </section>\n</section>\n\n<section id=\"panel-week\" class=\"panel\">\n  <section class=\"card\">\n    <p class=\"section-label\" data-i18n=\"weeklySchedule\">WEEKLY SCHEDULE</p>\n    <h2 data-i18n=\"exactPlan\">Your exact plan</h2>\n    <p class=\"muted\" data-i18n=\"weekHelp\">Bible chapters are assigned automatically. Meeting preparation is divided before each meeting.</p>\n    <div id=\"weekSchedule\" class=\"schedule-list\"></div>\n  </section>\n</section>\n\n<section id=\"panel-curriculum\" class=\"panel\">\n  <section class=\"card\">\n    <p class=\"section-label\" data-i18n=\"elderDevelopment\">ELDER DEVELOPMENT</p>\n    <h2 data-i18n=\"twelveWeek\">12-week curriculum</h2>\n    <div id=\"currentCurriculum\" class=\"current-curriculum\"></div>\n    <div id=\"curriculumList\" class=\"curriculum-list\"></div>\n  </section>\n</section>\n\n<section id=\"panel-progress\" class=\"panel\">\n  <section class=\"card\">\n    <p class=\"section-label\" data-i18n=\"progressUpper\">PROGRESS</p>\n    <h2 data-i18n=\"thisWeek\">This week</h2>\n    <div class=\"progress-track\"><div id=\"progressBar\" class=\"progress-fill\"></div></div>\n    <div class=\"stats\">\n      <div><strong id=\"tasksDone\">0</strong><span data-i18n=\"tasksDone\">tasks done</span></div>\n      <div><strong id=\"daysActive\">0</strong><span data-i18n=\"daysActive\">days active</span></div>\n      <div><strong id=\"bibleChapters\">0</strong><span data-i18n=\"chaptersRead\">chapters read</span></div>\n    </div>\n    <div id=\"progressDays\" class=\"progress-days\"></div>\n  </section>\n</section>\n\n<section id=\"panel-settings\" class=\"panel\">\n  <section class=\"card\">\n    <p class=\"section-label\" data-i18n=\"settingsUpper\">SETTINGS</p>\n    <h2 data-i18n=\"adjustSchedule\">Adjust schedule</h2>\n\n    <label class=\"field-label\" for=\"midweekDay\" data-i18n=\"midweekDay\">Midweek meeting day</label>\n    <select id=\"midweekDay\"></select>\n\n    <label class=\"field-label\" for=\"weekendDay\" data-i18n=\"weekendDay\">Weekend meeting day</label>\n    <select id=\"weekendDay\"></select>\n\n    <label class=\"field-label\" for=\"familyDay\" data-i18n=\"familyDay\">Family worship night</label>\n    <select id=\"familyDay\"></select>\n\n    <label class=\"field-label\" for=\"chaptersPerDay\" data-i18n=\"chaptersPerDay\">Bible chapters per day</label>\n    <select id=\"chaptersPerDay\">\n      <option value=\"1\" data-i18n=\"oneChapter\">1 chapter \u2014 light</option>\n      <option value=\"2\" data-i18n=\"twoChapters\">2 chapters \u2014 moderate</option>\n      <option value=\"3\" data-i18n=\"threeChapters\">3 chapters \u2014 deeper</option>\n    </select>\n\n    <label class=\"field-label\" for=\"startBook\" data-i18n=\"startBook\">Bible reading starts with</label>\n    <select id=\"startBook\">\n      <option value=\"0\" data-i18n=\"genesis\">Genesis</option>\n      <option value=\"39\" data-i18n=\"matthew\">Matthew</option>\n    </select>\n\n    <button type=\"button\" id=\"restartReading\" class=\"secondary full\" data-i18n=\"restartReading\">Restart Bible reading plan today</button>\n    <button type=\"button\" id=\"resetProgress\" class=\"danger full\" data-i18n=\"resetProgress\">Reset progress</button>\n  </section>\n</section>\n</main>\n<script src=\"/app.js\" defer></script>\n</body>\n</html>\n", type: "text/html; charset=utf-8" },
  "/index.html": { body: "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#f5f1e8\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-title\" content=\"Spiritual Routine\">\n<link rel=\"apple-touch-icon\" href=\"/icons/icon-192.png\">\n<link rel=\"manifest\" href=\"/manifest.webmanifest\">\n<link rel=\"stylesheet\" href=\"/styles.css\">\n<title>Spiritual Routine</title>\n</head>\n<body>\n<main class=\"app-shell\">\n<header class=\"hero\">\n  <div><p class=\"eyebrow\" data-i18n=\"weeklyPlan\">WEEKLY SPIRITUAL PLAN</p><h1 data-i18n=\"appTitle\">Spiritual Routine</h1></div>\n  <div id=\"headerDate\" class=\"header-date\"></div>\n</header>\n\n<div class=\"language-row\">\n  <label for=\"language\" data-i18n=\"language\">Language</label>\n  <select id=\"language\"><option value=\"en\">English</option><option value=\"es\">Espa\u00f1ol</option></select>\n</div>\n\n<nav class=\"tabs\" aria-label=\"App sections\">\n  <button type=\"button\" class=\"tab active\" data-tab=\"today\" data-i18n=\"today\">Today</button>\n  <button type=\"button\" class=\"tab\" data-tab=\"week\" data-i18n=\"week\">Week</button>\n  <button type=\"button\" class=\"tab\" data-tab=\"curriculum\" data-i18n=\"curriculum\">Elder Track</button>\n  <button type=\"button\" class=\"tab\" data-tab=\"progress\" data-i18n=\"progress\">Progress</button>\n  <button type=\"button\" class=\"tab\" data-tab=\"settings\" data-i18n=\"settings\">Settings</button>\n</nav>\n\n<section id=\"panel-today\" class=\"panel active\">\n  <section class=\"card\">\n    <p class=\"section-label\" data-i18n=\"todaysPlan\">TODAY'S PLAN</p>\n    <div class=\"row between start\">\n      <div><h2 id=\"todayDay\"></h2><p id=\"todaySummary\" class=\"muted\"></p></div>\n      <div id=\"totalMinutes\" class=\"pill\"></div>\n    </div>\n    <div id=\"todayTasks\" class=\"task-list\"></div>\n\n    <div class=\"official-card\">\n      <p class=\"section-label\" data-i18n=\"officialMaterial\">THIS WEEK'S MEETING MATERIAL</p>\n      <div id=\"officialMaterial\"></div>\n    </div>\n\n    <div class=\"gems-card\">\n      <p class=\"section-label\" data-i18n=\"gemsTitle\">SPIRITUAL GEMS</p>\n      <div id=\"gemsContent\"></div>\n\n      <div class=\"additional-gems\">\n        <div class=\"additional-gems-head\">\n          <strong data-i18n=\"additionalGems\">Additional Gems to Explore</strong>\n          <span data-i18n=\"notOfficial\">Personal research prompts \u2014 not official meeting answers</span>\n        </div>\n        <div id=\"additionalGemsList\"></div>\n      </div>\n\n      <label class=\"field-label\" for=\"gemNote\" data-i18n=\"myGem\">My gem from this week's reading</label>\n      <textarea id=\"gemNote\" rows=\"3\"></textarea>\n      <button type=\"button\" id=\"saveGem\" class=\"secondary full\" data-i18n=\"saveGem\">Save my gem</button>\n      <p id=\"gemStatus\" class=\"status\" aria-live=\"polite\"></p>\n    </div>\n\n    <label class=\"field-label\" for=\"note\" data-i18n=\"note\">What I learned / want to remember</label>\n    <textarea id=\"note\" rows=\"4\"></textarea>\n    <button type=\"button\" id=\"saveNote\" class=\"secondary full\" data-i18n=\"saveNote\">Save note</button>\n    <p id=\"status\" class=\"status\" aria-live=\"polite\"></p>\n  </section>\n</section>\n\n<section id=\"panel-week\" class=\"panel\">\n  <section class=\"card\">\n    <p class=\"section-label\" data-i18n=\"weeklySchedule\">WEEKLY SCHEDULE</p>\n    <h2 data-i18n=\"exactPlan\">Your exact plan</h2>\n    <p class=\"muted\" data-i18n=\"weekHelp\">Bible chapters are assigned automatically. Meeting preparation is divided before each meeting.</p>\n    <div id=\"weekSchedule\" class=\"schedule-list\"></div>\n  </section>\n</section>\n\n<section id=\"panel-curriculum\" class=\"panel\">\n  <section class=\"card\">\n    <p class=\"section-label\" data-i18n=\"elderDevelopment\">ELDER DEVELOPMENT</p>\n    <h2 data-i18n=\"twelveWeek\">12-week curriculum</h2>\n    <div id=\"currentCurriculum\" class=\"current-curriculum\"></div>\n    <div id=\"curriculumList\" class=\"curriculum-list\"></div>\n  </section>\n</section>\n\n<section id=\"panel-progress\" class=\"panel\">\n  <section class=\"card\">\n    <p class=\"section-label\" data-i18n=\"progressUpper\">PROGRESS</p>\n    <h2 data-i18n=\"thisWeek\">This week</h2>\n    <div class=\"progress-track\"><div id=\"progressBar\" class=\"progress-fill\"></div></div>\n    <div class=\"stats\">\n      <div><strong id=\"tasksDone\">0</strong><span data-i18n=\"tasksDone\">tasks done</span></div>\n      <div><strong id=\"daysActive\">0</strong><span data-i18n=\"daysActive\">days active</span></div>\n      <div><strong id=\"bibleChapters\">0</strong><span data-i18n=\"chaptersRead\">chapters read</span></div>\n    </div>\n    <div id=\"progressDays\" class=\"progress-days\"></div>\n  </section>\n</section>\n\n<section id=\"panel-settings\" class=\"panel\">\n  <section class=\"card\">\n    <p class=\"section-label\" data-i18n=\"settingsUpper\">SETTINGS</p>\n    <h2 data-i18n=\"adjustSchedule\">Adjust schedule</h2>\n\n    <label class=\"field-label\" for=\"midweekDay\" data-i18n=\"midweekDay\">Midweek meeting day</label>\n    <select id=\"midweekDay\"></select>\n\n    <label class=\"field-label\" for=\"weekendDay\" data-i18n=\"weekendDay\">Weekend meeting day</label>\n    <select id=\"weekendDay\"></select>\n\n    <label class=\"field-label\" for=\"familyDay\" data-i18n=\"familyDay\">Family worship night</label>\n    <select id=\"familyDay\"></select>\n\n    <label class=\"field-label\" for=\"chaptersPerDay\" data-i18n=\"chaptersPerDay\">Bible chapters per day</label>\n    <select id=\"chaptersPerDay\">\n      <option value=\"1\" data-i18n=\"oneChapter\">1 chapter \u2014 light</option>\n      <option value=\"2\" data-i18n=\"twoChapters\">2 chapters \u2014 moderate</option>\n      <option value=\"3\" data-i18n=\"threeChapters\">3 chapters \u2014 deeper</option>\n    </select>\n\n    <label class=\"field-label\" for=\"startBook\" data-i18n=\"startBook\">Bible reading starts with</label>\n    <select id=\"startBook\">\n      <option value=\"0\" data-i18n=\"genesis\">Genesis</option>\n      <option value=\"39\" data-i18n=\"matthew\">Matthew</option>\n    </select>\n\n    <button type=\"button\" id=\"restartReading\" class=\"secondary full\" data-i18n=\"restartReading\">Restart Bible reading plan today</button>\n    <button type=\"button\" id=\"resetProgress\" class=\"danger full\" data-i18n=\"resetProgress\">Reset progress</button>\n  </section>\n</section>\n</main>\n<script src=\"/app.js\" defer></script>\n</body>\n</html>\n", type: "text/html; charset=utf-8" },
  "/styles.css": { body: "\n:root{--bg:#f5f1e8;--card:#fff;--text:#1f2a25;--muted:#68716c;--accent:#315b46;--accent-soft:#e5eee8;--border:#dfe4df;--danger:#9a3b34}\n*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Text\",\"Segoe UI\",sans-serif}\nbutton,textarea,select{font:inherit}.app-shell{max-width:780px;margin:0 auto;padding:calc(env(safe-area-inset-top) + 18px) 14px calc(env(safe-area-inset-bottom) + 28px)}\n.hero{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding:6px 4px 10px}.eyebrow,.section-label{margin:0 0 6px;font-size:12px;letter-spacing:.12em;font-weight:800;color:var(--accent)}\nh1{margin:0;font-size:32px;letter-spacing:-.03em}h2{margin:0;font-size:21px}.header-date,.muted{color:var(--muted);line-height:1.5}.header-date{font-size:12px;text-align:right}\n.language-row{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:0 3px 10px;color:var(--muted);font-size:13px}.language-row select{width:auto;min-height:40px;padding:0 32px 0 10px}\n.tabs{display:flex;gap:7px;overflow-x:auto;padding:0 1px 12px;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}.tab{border:1px solid var(--border);background:#fff;color:var(--muted);border-radius:999px;min-height:42px;padding:0 14px;font-weight:750;white-space:nowrap}.tab.active{background:var(--accent);color:#fff;border-color:var(--accent)}\n.panel{display:none}.panel.active{display:block}.card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:18px;margin-bottom:14px}.row{display:flex;gap:12px;align-items:center}.between{justify-content:space-between}.start{align-items:flex-start}.pill{background:var(--accent-soft);color:var(--accent);font-weight:800;border-radius:999px;padding:8px 11px;font-size:13px;white-space:nowrap}\n.task-list,.schedule-list,.curriculum-list,.progress-days{display:grid;gap:10px;margin-top:15px}.task{display:flex;gap:12px;align-items:flex-start;padding:13px;border:1px solid var(--border);border-radius:14px;background:#fafaf8}.task input{width:22px;height:22px;flex:0 0 22px;margin-top:2px}.task-body{min-width:0;flex:1}.task-title{font-weight:800;margin:0 0 3px}.task-meta{font-size:12px;color:var(--accent);font-weight:700;margin-bottom:4px}.task-desc{margin:0;color:var(--muted);font-size:14px;line-height:1.45}\n.reading-highlight{background:#eef4ef;border-color:#cddccf}.reading-highlight .task-title{font-size:17px}\n.field-label{display:block;font-size:13px;font-weight:750;margin:16px 0 7px}textarea,select{width:100%;border:1px solid var(--border);border-radius:14px;padding:12px;background:#fff;color:var(--text);font-size:16px;outline:none}textarea{min-height:100px;resize:vertical}select{min-height:48px}\nbutton{min-height:48px;border:0;border-radius:14px;padding:0 14px;font-weight:800}.secondary{background:var(--accent-soft);color:var(--accent)}.danger{background:#f7e9e7;color:var(--danger);border:1px solid #ebc8c3}.full{width:100%;margin-top:10px}.status{min-height:20px;color:var(--muted);font-size:13px;margin:8px 2px 0}\n.day-card{border:1px solid var(--border);border-radius:16px;overflow:hidden}.day-head{display:flex;justify-content:space-between;gap:12px;align-items:center;background:#fafaf8;padding:12px 14px}.day-head strong{font-size:15px}.day-head span{font-size:12px;color:var(--muted)}.day-body{display:grid;gap:7px;padding:10px 12px}.mini-task{padding:9px 10px;border-left:3px solid var(--accent-soft)}.mini-task.read{border-left-color:var(--accent);background:#f7faf7}.mini-task strong{display:block;font-size:13px}.mini-task span{display:block;font-size:12px;color:var(--muted);margin-top:2px}\n.current-curriculum{margin-top:15px;border:1px solid #cddccf;background:var(--accent-soft);border-radius:16px;padding:14px}.current-curriculum .wk{font-size:12px;color:var(--accent);font-weight:800;letter-spacing:.08em}.current-curriculum h3{margin:5px 0 6px;font-size:19px}.current-curriculum p{margin:0;color:var(--muted);line-height:1.45}\n.curriculum-item{display:grid;grid-template-columns:34px 1fr;gap:10px;padding:10px;border:1px solid var(--border);border-radius:13px;background:#fafaf8}.curriculum-item.active{border-color:var(--accent);background:#f1f6f2}.num{width:34px;height:34px;border:1px solid var(--border);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:#fff}.curriculum-item strong{display:block;font-size:13px}.curriculum-item span{display:block;font-size:12px;color:var(--muted);line-height:1.35;margin-top:3px}\n.progress-track{height:10px;background:#edf0ed;border-radius:999px;overflow:hidden;margin:15px 0}.progress-fill{height:100%;background:var(--accent);width:0;border-radius:999px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.stats div{text-align:center;border:1px solid var(--border);border-radius:14px;padding:12px;background:#fafaf8}.stats strong{display:block;font-size:23px}.stats span{display:block;font-size:11px;color:var(--muted);margin-top:3px}.progress-day{display:flex;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid var(--border);border-radius:12px;background:#fafaf8}.progress-day span{font-size:13px;color:var(--muted)}\n@media(max-width:420px){h1{font-size:29px}.hero{align-items:flex-start}.card{padding:16px}.stats{gap:6px}}\n\n.official-card{margin-top:16px;border:1px solid #cddccf;border-radius:16px;background:#f7faf7;padding:14px}\n.official-grid{display:grid;gap:10px}\n.official-block{border:1px solid var(--border);border-radius:13px;background:#fff;padding:11px}\n.official-block .kicker{font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--accent);margin-bottom:4px}\n.official-block strong{display:block;font-size:14px;line-height:1.35}\n.official-block p{margin:5px 0 0;color:var(--muted);font-size:13px;line-height:1.4}\n.official-link{display:inline-flex;margin-top:8px;color:var(--accent);font-size:13px;font-weight:800;text-decoration:none}\n.official-link:focus,.official-link:hover{text-decoration:underline}\n\n.gems-card{margin-top:16px;border:1px solid #d8d9c8;border-radius:16px;background:#fbfbf5;padding:14px}\n.gems-question{border:1px solid var(--border);border-radius:13px;background:#fff;padding:12px}\n.gems-question .ref{font-size:12px;font-weight:800;color:var(--accent);margin-bottom:5px}\n.gems-question strong{display:block;font-size:15px;line-height:1.4}\n.gems-question p{margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.45}\n.gems-empty{color:var(--muted);font-size:13px;line-height:1.45}\n\n.additional-gems{margin-top:13px;border-top:1px solid var(--border);padding-top:13px}\n.additional-gems-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:9px}\n.additional-gems-head strong{font-size:14px}\n.additional-gems-head span{font-size:11px;color:var(--muted)}\n.extra-gems-list{display:grid;gap:8px}\n.extra-gem{border:1px solid var(--border);border-radius:12px;background:#fff;padding:11px}\n.extra-gem .verse{font-size:13px;font-weight:850;color:var(--accent)}\n.extra-gem p{font-size:13px;line-height:1.45;color:var(--muted);margin:5px 0 0}\n.extra-gem a{display:inline-block;margin-top:7px;font-size:12px;font-weight:800;color:var(--accent);text-decoration:none}\n.extra-gem a:hover,.extra-gem a:focus{text-decoration:underline}\n\n.elder-assignment{margin-top:10px;padding:11px;border:1px solid var(--border);border-radius:12px;background:#fff}\n.elder-assignment strong{display:block;font-size:13px;color:var(--accent)}\n.elder-assignment p{margin:5px 0 0;color:var(--muted);font-size:13px;line-height:1.45}\n", type: "text/css; charset=utf-8" },
  "/app.js": { body: "\nconst $=id=>document.getElementById(id);\nconst DAY_MS=86400000;\nconst today=new Date();\ntoday.setHours(12,0,0,0);\nconst iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,\"0\")}-${String(d.getDate()).padStart(2,\"0\")}`;\n\nconst I18N={\nen:{weeklyPlan:\"WEEKLY SPIRITUAL PLAN\",appTitle:\"Spiritual Routine\",language:\"Language\",today:\"Today\",week:\"Week\",curriculum:\"Elder Track\",progress:\"Progress\",settings:\"Settings\",todaysPlan:\"TODAY'S PLAN\",note:\"What I learned / want to remember\",saveNote:\"Save note\",weeklySchedule:\"WEEKLY SCHEDULE\",exactPlan:\"Your exact plan\",weekHelp:\"Bible chapters are assigned automatically. Meeting preparation is divided before each meeting.\",elderDevelopment:\"ELDER DEVELOPMENT\",twelveWeek:\"12-week curriculum\",progressUpper:\"PROGRESS\",thisWeek:\"This week\",tasksDone:\"tasks done\",daysActive:\"days active\",chaptersRead:\"chapters read\",settingsUpper:\"SETTINGS\",adjustSchedule:\"Adjust schedule\",midweekDay:\"Midweek meeting day\",weekendDay:\"Weekend meeting day\",familyDay:\"Family worship night\",chaptersPerDay:\"Bible chapters per day\",oneChapter:\"1 chapter \u2014 light\",twoChapters:\"2 chapters \u2014 moderate\",threeChapters:\"3 chapters \u2014 deeper\",startBook:\"Bible reading starts with\",genesis:\"Genesis\",matthew:\"Matthew\",restartReading:\"Restart Bible reading plan today\",resetProgress:\"Reset progress\",minutes:\"min\",saved:\"Saved.\",confirmReset:\"Reset all completion progress?\",confirmReading:\"Restart the Bible reading sequence from today?\",summary:\"Follow today's scheduled items. Nothing rolls over if you miss a day.\",weekLabel:\"Week\",gemsTitle:\"SPIRITUAL GEMS\",additionalGems:\"Additional Gems to Explore\",notOfficial:\"Personal research prompts \u2014 not official meeting answers\",researchPrompt:\"Research prompt\",whatTeachJehovah:\"What does this verse teach me about Jehovah, his qualities, or his way of doing things?\",practicalPrinciple:\"What practical principle can I draw from it, and how could I use it in teaching or shepherding?\",myGem:\"My gem from this week\\'s reading\",saveGem:\"Save my gem\",officialGemQuestion:\"Official weekly question\",gemSaved:\"Gem saved.\",gemsUnavailable:\"The official Spiritual Gems question could not be retrieved yet.\",officialMaterial:\"THIS WEEK'S MEETING MATERIAL\",lifeMinistry:\"Life and Ministry\",watchtowerStudy:\"Watchtower Study\",weeklyBibleReading:\"Weekly Bible reading\",meetingBibleReading:\"Meeting Bible reading\",treasures:\"Treasures from God's Word\",livingChristians:\"Living as Christians\",congregationStudy:\"Congregation Bible Study\",openJw:\"Open on JW.org\",materialFallback:\"No embedded official material for this week yet. Use the linked workbook/magazine index to confirm the current program.\",days:[\"Sunday\",\"Monday\",\"Tuesday\",\"Wednesday\",\"Thursday\",\"Friday\",\"Saturday\"]},\nes:{weeklyPlan:\"PLAN ESPIRITUAL SEMANAL\",appTitle:\"Rutina Espiritual\",language:\"Idioma\",today:\"Hoy\",week:\"Semana\",curriculum:\"Programa de anciano\",progress:\"Progreso\",settings:\"Ajustes\",todaysPlan:\"PLAN DE HOY\",note:\"Lo que aprend\u00ed / quiero recordar\",saveNote:\"Guardar nota\",weeklySchedule:\"HORARIO SEMANAL\",exactPlan:\"Tu plan exacto\",weekHelp:\"Los cap\u00edtulos de la Biblia se asignan autom\u00e1ticamente. La preparaci\u00f3n para las reuniones se divide antes de cada reuni\u00f3n.\",elderDevelopment:\"DESARROLLO COMO ANCIANO\",twelveWeek:\"Programa de 12 semanas\",progressUpper:\"PROGRESO\",thisWeek:\"Esta semana\",tasksDone:\"tareas hechas\",daysActive:\"d\u00edas activos\",chaptersRead:\"cap\u00edtulos le\u00eddos\",settingsUpper:\"AJUSTES\",adjustSchedule:\"Ajustar horario\",midweekDay:\"D\u00eda de la reuni\u00f3n de entre semana\",weekendDay:\"D\u00eda de la reuni\u00f3n del fin de semana\",familyDay:\"Noche de adoraci\u00f3n en familia\",chaptersPerDay:\"Cap\u00edtulos de la Biblia por d\u00eda\",oneChapter:\"1 cap\u00edtulo \u2014 ligero\",twoChapters:\"2 cap\u00edtulos \u2014 moderado\",threeChapters:\"3 cap\u00edtulos \u2014 m\u00e1s profundo\",startBook:\"La lectura b\u00edblica comienza con\",genesis:\"G\u00e9nesis\",matthew:\"Mateo\",restartReading:\"Reiniciar el plan de lectura b\u00edblica hoy\",resetProgress:\"Borrar progreso\",minutes:\"min\",saved:\"Guardado.\",confirmReset:\"\u00bfBorrar todo el progreso completado?\",confirmReading:\"\u00bfReiniciar la secuencia de lectura b\u00edblica desde hoy?\",summary:\"Sigue las actividades programadas para hoy. Si pierdes un d\u00eda, no se acumula nada.\",weekLabel:\"Semana\",gemsTitle:\"PERLAS ESPIRITUALES\",additionalGems:\"Otras perlas para investigar\",notOfficial:\"Preguntas para investigaci\u00f3n personal \u2014 no son respuestas oficiales\",researchPrompt:\"Pregunta de investigaci\u00f3n\",whatTeachJehovah:\"\u00bfQu\u00e9 me ense\u00f1a este vers\u00edculo sobre Jehov\u00e1, sus cualidades o su forma de actuar?\",practicalPrinciple:\"\u00bfQu\u00e9 principio pr\u00e1ctico puedo sacar, y c\u00f3mo podr\u00eda usarlo al ense\u00f1ar o pastorear?\",myGem:\"Mi perla de la lectura de esta semana\",saveGem:\"Guardar mi perla\",officialGemQuestion:\"Pregunta oficial de la semana\",gemSaved:\"Perla guardada.\",gemsUnavailable:\"Todav\u00eda no se pudo obtener la pregunta oficial de Busquemos perlas escondidas.\",officialMaterial:\"MATERIAL DE LAS REUNIONES DE ESTA SEMANA\",lifeMinistry:\"Vida y Ministerio\",watchtowerStudy:\"Estudio de La Atalaya\",weeklyBibleReading:\"Lectura b\u00edblica semanal\",meetingBibleReading:\"Lectura de la Biblia en la reuni\u00f3n\",treasures:\"Tesoros de la Biblia\",livingChristians:\"Nuestra Vida Cristiana\",congregationStudy:\"Estudio b\u00edblico de la congregaci\u00f3n\",openJw:\"Abrir en JW.org\",materialFallback:\"Todav\u00eda no hay material oficial integrado para esta semana. Usa el enlace de la gu\u00eda o de la revista para confirmar el programa actual.\",days:[\"Domingo\",\"Lunes\",\"Martes\",\"Mi\u00e9rcoles\",\"Jueves\",\"Viernes\",\"S\u00e1bado\"]}\n};\n\nconst BOOKS=[\n[\"Genesis\",\"G\u00e9nesis\",50],[\"Exodus\",\"\u00c9xodo\",40],[\"Leviticus\",\"Lev\u00edtico\",27],[\"Numbers\",\"N\u00fameros\",36],[\"Deuteronomy\",\"Deuteronomio\",34],[\"Joshua\",\"Josu\u00e9\",24],[\"Judges\",\"Jueces\",21],[\"Ruth\",\"Rut\",4],[\"1 Samuel\",\"1 Samuel\",31],[\"2 Samuel\",\"2 Samuel\",24],[\"1 Kings\",\"1 Reyes\",22],[\"2 Kings\",\"2 Reyes\",25],[\"1 Chronicles\",\"1 Cr\u00f3nicas\",29],[\"2 Chronicles\",\"2 Cr\u00f3nicas\",36],[\"Ezra\",\"Esdras\",10],[\"Nehemiah\",\"Nehem\u00edas\",13],[\"Esther\",\"Ester\",10],[\"Job\",\"Job\",42],[\"Psalms\",\"Salmos\",150],[\"Proverbs\",\"Proverbios\",31],[\"Ecclesiastes\",\"Eclesiast\u00e9s\",12],[\"Song of Solomon\",\"Cantar de los Cantares\",8],[\"Isaiah\",\"Isa\u00edas\",66],[\"Jeremiah\",\"Jerem\u00edas\",52],[\"Lamentations\",\"Lamentaciones\",5],[\"Ezekiel\",\"Ezequiel\",48],[\"Daniel\",\"Daniel\",12],[\"Hosea\",\"Oseas\",14],[\"Joel\",\"Joel\",3],[\"Amos\",\"Am\u00f3s\",9],[\"Obadiah\",\"Abd\u00edas\",1],[\"Jonah\",\"Jon\u00e1s\",4],[\"Micah\",\"Miqueas\",7],[\"Nahum\",\"Nah\u00fam\",3],[\"Habakkuk\",\"Habacuc\",3],[\"Zephaniah\",\"Sofon\u00edas\",3],[\"Haggai\",\"Ageo\",2],[\"Zechariah\",\"Zacar\u00edas\",14],[\"Malachi\",\"Malaqu\u00edas\",4],[\"Matthew\",\"Mateo\",28],[\"Mark\",\"Marcos\",16],[\"Luke\",\"Lucas\",24],[\"John\",\"Juan\",21],[\"Acts\",\"Hechos\",28],[\"Romans\",\"Romanos\",16],[\"1 Corinthians\",\"1 Corintios\",16],[\"2 Corinthians\",\"2 Corintios\",13],[\"Galatians\",\"G\u00e1latas\",6],[\"Ephesians\",\"Efesios\",6],[\"Philippians\",\"Filipenses\",4],[\"Colossians\",\"Colosenses\",4],[\"1 Thessalonians\",\"1 Tesalonicenses\",5],[\"2 Thessalonians\",\"2 Tesalonicenses\",3],[\"1 Timothy\",\"1 Timoteo\",6],[\"2 Timothy\",\"2 Timoteo\",4],[\"Titus\",\"Tito\",3],[\"Philemon\",\"Filem\u00f3n\",1],[\"Hebrews\",\"Hebreos\",13],[\"James\",\"Santiago\",5],[\"1 Peter\",\"1 Pedro\",5],[\"2 Peter\",\"2 Pedro\",3],[\"1 John\",\"1 Juan\",5],[\"2 John\",\"2 Juan\",1],[\"3 John\",\"3 Juan\",1],[\"Jude\",\"Judas\",1],[\"Revelation\",\"Apocalipsis\",22]\n];\n\nconst CURRICULUM=[\n{\n en:\"Know the Role of a Shepherd\",es:\"Conozca bien el papel de un pastor\",\n scriptures:[\"Acts 20:28\",\"1 Peter 5:1-4\",\"Proverbs 27:23\"],\n article:{\n  en:\"How Do the Elders Serve the Congregation?\",\n  es:\"\u00bfC\u00f3mo sirven los ancianos a la congregaci\u00f3n?\",\n  enUrl:\"https://www.jw.org/en/library/brochures/jehovahs-will/congregation-elders/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/folletos/voluntad-de-jehova/ancianos-congregacion/\"\n },\n handbook:{en:\"Elder handbook: review the opening chapter/section describing the elder's role and spiritual qualifications in your current authorized edition.\",es:\"Manual para ancianos: repase el cap\u00edtulo o secci\u00f3n inicial que explica el papel del anciano y los requisitos espirituales en su edici\u00f3n autorizada actual.\"},\n practice:{en:\"Write a 3-sentence description of the kind of shepherd you want to be. Choose one publisher you want to know better this month.\",es:\"Escriba en 3 frases qu\u00e9 clase de pastor quiere ser. Escoja a un publicador que quiera conocer mejor este mes.\"}\n},\n{\n en:\"Listen Before Giving Counsel\",es:\"Escuche antes de dar consejo\",\n scriptures:[\"Proverbs 18:13\",\"Proverbs 20:5\",\"James 1:19\"],\n article:{\n  en:\"\u201cCall the Elders\u201d\",\n  es:\"\u201cQue llame a los ancianos\u201d\",\n  enUrl:\"https://www.jw.org/en/library/magazines/watchtower-study-september-2025/Call-the-Elders/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/revistas/atalaya-estudio-septiembre-2025/Que-llame-a-los-ancianos/\"\n },\n handbook:{en:\"Elder handbook: review the section in your current authorized edition on shepherding calls and listening before giving counsel.\",es:\"Manual para ancianos: repase la secci\u00f3n de su edici\u00f3n autorizada actual sobre visitas de pastoreo y escuchar antes de aconsejar.\"},\n practice:{en:\"During one conversation this week, ask two thoughtful questions before offering any advice. Afterwards, note what you learned by listening.\",es:\"En una conversaci\u00f3n esta semana, haga dos preguntas bien pensadas antes de dar consejo. Despu\u00e9s, anote qu\u00e9 aprendi\u00f3 por escuchar.\"}\n},\n{\n en:\"Shepherd With Tenderness\",es:\"Pastoree con ternura\",\n scriptures:[\"Ezekiel 34:11-16\",\"1 Thessalonians 2:7-12\",\"Matthew 18:12-14\"],\n article:{\n  en:\"Lessons We Can Learn From Peter\u2019s Two Letters\",\n  es:\"\u00bfQu\u00e9 lecciones nos ense\u00f1an las dos cartas de Pedro?\",\n  enUrl:\"https://www.jw.org/en/library/magazines/watchtower-study-september-2023/Lessons-We-Can-Learn-From-Peters-Two-Letters/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/revistas/atalaya-estudio-septiembre-2023/Que-lecciones-nos-ensenan-las-dos-cartas-de-Pedro/\"\n },\n handbook:{en:\"Elder handbook: review the current shepherding section dealing with strengthening and encouraging spiritually weak ones.\",es:\"Manual para ancianos: repase la secci\u00f3n actual sobre fortalecer y animar a quienes est\u00e1n d\u00e9biles espiritualmente.\"},\n practice:{en:\"Prepare one 10-minute shepherding outline: one question, two scriptures, one encouraging application. Do not overload it.\",es:\"Prepare un esquema de pastoreo de 10 minutos: una pregunta, dos textos y una aplicaci\u00f3n animadora. No lo sobrecargue.\"}\n},\n{\n en:\"Develop Discernment, Not Assumptions\",es:\"Desarrolle discernimiento, no suposiciones\",\n scriptures:[\"1 Kings 3:9-12\",\"Proverbs 18:17\",\"James 3:17\"],\n article:{\n  en:\"Overseers \u2014 Scriptures for Christian Living\",\n  es:\"Superintendentes \u2014 Textos b\u00edblicos para la vida cristiana\",\n  enUrl:\"https://www.jw.org/en/library/books/scriptures-for-christian-living/overseers/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/libros/textos-biblicos-para-vida-cristiana/superintendentes/\"\n },\n handbook:{en:\"Elder handbook: review the section in your current authorized edition that emphasizes gathering facts and applying Scriptural principles before reaching conclusions.\",es:\"Manual para ancianos: repase la secci\u00f3n de su edici\u00f3n autorizada actual que recalca reunir los hechos y aplicar principios b\u00edblicos antes de llegar a conclusiones.\"},\n practice:{en:\"Take a hypothetical problem and list: facts known, facts unknown, Bible principles, and what questions must be asked before deciding anything.\",es:\"Tome un problema hipot\u00e9tico y haga cuatro listas: hechos conocidos, hechos desconocidos, principios b\u00edblicos y preguntas que deben hacerse antes de decidir algo.\"}\n},\n{\n en:\"Teach Simply and From the Bible\",es:\"Ense\u00f1e de forma sencilla y con la Biblia\",\n scriptures:[\"Nehemiah 8:8\",\"2 Timothy 2:24,25\",\"Titus 1:9\"],\n article:{\n  en:\"Brothers\u2014Are You Reaching Out to Serve as an Elder?\",\n  es:\"\u00bfTiene la meta de ser anciano?\",\n  enUrl:\"https://www.jw.org/en/library/magazines/watchtower-study-november-2024/Brothers-Are-You-Reaching-Out-to-Serve-as-an-Elder/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/revistas/atalaya-estudio-noviembre-2024/Tiene-la-meta-de-ser-anciano/\"\n },\n handbook:{en:\"Elder handbook: review any current section on teaching, handling assignments, or using the Scriptures effectively.\",es:\"Manual para ancianos: repase cualquier secci\u00f3n actual sobre ense\u00f1ar, atender asignaciones o usar bien las Escrituras.\"},\n practice:{en:\"Pick one Bible subject. Explain it in 3 minutes using only two scriptures, one illustration, and one application.\",es:\"Escoja un tema b\u00edblico. Expl\u00edquelo en 3 minutos usando solo dos textos, una ilustraci\u00f3n y una aplicaci\u00f3n.\"}\n},\n{\n en:\"Humility When Corrected or Praised\",es:\"Humildad al recibir correcci\u00f3n o elogios\",\n scriptures:[\"Judges 8:1-3\",\"James 3:13\",\"Philippians 2:3\"],\n article:{\n  en:\"Elders\u2014Learn From Gideon\u2019s Example\",\n  es:\"Ancianos, sigan el ejemplo de Gede\u00f3n\",\n  enUrl:\"https://www.jw.org/en/library/magazines/watchtower-study-june-2023/Elders-Learn-From-Gideons-Example/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/revistas/atalaya-estudio-junio-2023/Ancianos-sigan-el-ejemplo-de-Gedeon/\"\n },\n handbook:{en:\"Elder handbook: review the section in your current authorized edition about working cooperatively with the body of elders.\",es:\"Manual para ancianos: repase la secci\u00f3n de su edici\u00f3n autorizada actual sobre trabajar en cooperaci\u00f3n con el cuerpo de ancianos.\"},\n practice:{en:\"At the next elders' discussion, deliberately listen fully before speaking. Write down one useful point another elder made.\",es:\"En la pr\u00f3xima conversaci\u00f3n de ancianos, escuche completamente antes de hablar. Anote un punto \u00fatil que haya mencionado otro anciano.\"}\n},\n{\n en:\"Work in Unity With Fellow Elders\",es:\"Trabaje en unidad con los dem\u00e1s ancianos\",\n scriptures:[\"Romans 12:10\",\"Acts 15:6-22\",\"James 3:17,18\"],\n article:{\n  en:\"Respect the Place of Others in Jehovah\u2019s Congregation\",\n  es:\"Respetemos el lugar de los dem\u00e1s en la congregaci\u00f3n de Jehov\u00e1\",\n  enUrl:\"https://www.jw.org/en/library/magazines/watchtower-study-august-2020/respect-place-of-others-in-jehovahs-congregation/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/revistas/atalaya-estudio-agosto-2020/Respetemos-el-lugar-de-los-demas-en-la-congregacion-de-Jehova/\"\n },\n handbook:{en:\"Elder handbook: review the current section on body-of-elders cooperation, recommendations, and respectful discussion.\",es:\"Manual para ancianos: repase la secci\u00f3n actual sobre cooperaci\u00f3n del cuerpo de ancianos, recomendaciones y conversaciones respetuosas.\"},\n practice:{en:\"Identify one strength in each fellow elder that benefits the congregation. Pray specifically about showing them honor.\",es:\"Identifique una fortaleza de cada anciano que beneficie a la congregaci\u00f3n. Ore espec\u00edficamente para mostrarles honra.\"}\n},\n{\n en:\"Become a Better Bible Researcher\",es:\"Convi\u00e9rtase en un mejor investigador b\u00edblico\",\n scriptures:[\"Acts 17:11\",\"2 Timothy 2:15\",\"Proverbs 2:1-6\"],\n article:{\n  en:\"Help to Study Regularly\",\n  es:\"Ayuda para estudiar con regularidad\",\n  enUrl:\"https://www.jw.org/en/library/magazines/watchtower-study-november-2024/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/revistas/atalaya-estudio-noviembre-2024/\"\n },\n handbook:{en:\"Elder handbook: choose one paragraph in your current authorized edition and trace every cited scripture and publication reference instead of merely reading the paragraph.\",es:\"Manual para ancianos: escoja un p\u00e1rrafo de su edici\u00f3n autorizada actual y siga cada texto y cada referencia de publicaci\u00f3n en vez de limitarse a leer el p\u00e1rrafo.\"},\n practice:{en:\"Research one question using this sequence: Bible context \u2192 Research Guide/Index \u2192 current publication \u2192 summarize in your own words.\",es:\"Investigue una pregunta siguiendo esta secuencia: contexto b\u00edblico \u2192 Gu\u00eda de estudio/\u00cdndice \u2192 publicaci\u00f3n actual \u2192 resumen con sus propias palabras.\"}\n},\n{\n en:\"Comfort the Discouraged\",es:\"Consuele a los desanimados\",\n scriptures:[\"Isaiah 32:1,2\",\"1 Thessalonians 5:14\",\"Galatians 6:1,2\"],\n article:{\n  en:\"\u201cCall the Elders\u201d\",\n  es:\"\u201cQue llame a los ancianos\u201d\",\n  enUrl:\"https://www.jw.org/en/library/magazines/watchtower-study-september-2025/Call-the-Elders/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/revistas/atalaya-estudio-septiembre-2025/Que-llame-a-los-ancianos/\"\n },\n handbook:{en:\"Elder handbook: review the current section related to giving spiritual assistance and following up after a shepherding visit.\",es:\"Manual para ancianos: repase la secci\u00f3n actual relacionada con dar ayuda espiritual y dar seguimiento despu\u00e9s de una visita de pastoreo.\"},\n practice:{en:\"Prepare three comforting scriptures for three different needs: anxiety, discouragement, and spiritual weakness. Practice introducing each warmly.\",es:\"Prepare tres textos consoladores para tres necesidades distintas: ansiedad, des\u00e1nimo y debilidad espiritual. Practique c\u00f3mo introducir cada uno con calidez.\"}\n},\n{\n en:\"Protect Personal Spiritual Health\",es:\"Proteja su salud espiritual\",\n scriptures:[\"Acts 20:28\",\"1 Timothy 4:15,16\",\"Mark 6:31\"],\n article:{\n  en:\"Elders\u2014Learn From Gideon\u2019s Example\",\n  es:\"Ancianos, sigan el ejemplo de Gede\u00f3n\",\n  enUrl:\"https://www.jw.org/en/library/magazines/watchtower-study-june-2023/Elders-Learn-From-Gideons-Example/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/revistas/atalaya-estudio-junio-2023/Ancianos-sigan-el-ejemplo-de-Gedeon/\"\n },\n handbook:{en:\"Elder handbook: review only a manageable section this week. The objective is balance, not covering material quickly.\",es:\"Manual para ancianos: repase solo una secci\u00f3n manejable esta semana. El objetivo es el equilibrio, no avanzar r\u00e1pidamente.\"},\n practice:{en:\"Audit the past 7 days: Bible reading, personal prayer, family, congregation responsibilities, rest. Identify one imbalance and correct it.\",es:\"Revise los \u00faltimos 7 d\u00edas: lectura b\u00edblica, oraci\u00f3n personal, familia, responsabilidades de congregaci\u00f3n y descanso. Identifique un desequilibrio y corr\u00edjalo.\"}\n},\n{\n en:\"Know the Flock Personally\",es:\"Conozca personalmente al reba\u00f1o\",\n scriptures:[\"Proverbs 27:23\",\"John 10:3,14\",\"Acts 20:35\"],\n article:{\n  en:\"How Do the Elders Serve the Congregation?\",\n  es:\"\u00bfC\u00f3mo sirven los ancianos a la congregaci\u00f3n?\",\n  enUrl:\"https://www.jw.org/en/library/brochures/jehovahs-will/congregation-elders/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/folletos/voluntad-de-jehova/ancianos-congregacion/\"\n },\n handbook:{en:\"Elder handbook: review the current section on shepherding responsibility and caring for individuals, then consider how it applies locally.\",es:\"Manual para ancianos: repase la secci\u00f3n actual sobre la responsabilidad de pastorear y cuidar a las personas, y piense c\u00f3mo aplicarla localmente.\"},\n practice:{en:\"Choose two people or families you do not know well. Without prying, make a natural effort to learn what encourages them and what challenges they face.\",es:\"Escoja a dos personas o familias que no conozca bien. Sin entrometerse, procure saber de manera natural qu\u00e9 las anima y qu\u00e9 dificultades enfrentan.\"}\n},\n{\n en:\"12-Week Review: Build Your Personal Elder Plan\",es:\"Repaso de 12 semanas: cree su plan personal como anciano\",\n scriptures:[\"1 Peter 5:2,3\",\"Philippians 3:16\",\"Psalm 78:72\"],\n article:{\n  en:\"Overseers \u2014 Scriptures for Christian Living\",\n  es:\"Superintendentes \u2014 Textos b\u00edblicos para la vida cristiana\",\n  enUrl:\"https://www.jw.org/en/library/books/scriptures-for-christian-living/overseers/\",\n  esUrl:\"https://www.jw.org/es/biblioteca/libros/textos-biblicos-para-vida-cristiana/superintendentes/\"\n },\n handbook:{en:\"Elder handbook: revisit the section from the past 11 weeks that you found hardest to apply. Study it slowly with every cited scripture.\",es:\"Manual para ancianos: vuelva a la secci\u00f3n de las \u00faltimas 11 semanas que m\u00e1s le cost\u00f3 aplicar. Est\u00fadiela despacio con todos los textos citados.\"},\n practice:{en:\"Write three goals for the next 12 weeks: one shepherding goal, one teaching goal, and one personal-spirituality goal. Make each measurable and moderate.\",es:\"Escriba tres metas para las pr\u00f3ximas 12 semanas: una de pastoreo, una de ense\u00f1anza y una de espiritualidad personal. Haga que cada una sea medible y moderada.\"}\n}\n];\n\n\nconst TASKS={\nprayer:{title:[\"Prayer + Meditation\",\"Oraci\u00f3n + meditaci\u00f3n\"],desc:[\"Review one thought from today's reading and make your prayer specific.\",\"Repasa una idea de la lectura de hoy y haz tu oraci\u00f3n espec\u00edfica.\"],min:5},\nmid1:{title:[\"Midweek Meeting Prep \u2014 Part 1\",\"Preparaci\u00f3n reuni\u00f3n entre semana \u2014 Parte 1\"],desc:[\"Review the assigned Bible reading and Spiritual Gems. Mark 1\u20132 points you want to remember.\",\"Repasa la lectura b\u00edblica asignada y Busquemos Perlas Escondidas. Marca 1 o 2 puntos que quieras recordar.\"],min:20},\nmid2:{title:[\"Midweek Meeting Prep \u2014 Part 2\",\"Preparaci\u00f3n reuni\u00f3n entre semana \u2014 Parte 2\"],desc:[\"Prepare the remaining meeting material and any assignment you have. Focus on personal application, not just completion.\",\"Prepara el resto del material de la reuni\u00f3n y cualquier asignaci\u00f3n que tengas. Conc\u00e9ntrate en la aplicaci\u00f3n personal, no solo en terminar.\"],min:20},\nweek1:{title:[\"Weekend Meeting Prep \u2014 Part 1\",\"Preparaci\u00f3n reuni\u00f3n fin de semana \u2014 Parte 1\"],desc:[\"Study roughly the first half of the Watchtower study material. Mark answers and key scriptures.\",\"Estudia aproximadamente la primera mitad del material de La Atalaya. Marca respuestas y textos clave.\"],min:25},\nweek2:{title:[\"Weekend Meeting Prep \u2014 Part 2\",\"Preparaci\u00f3n reuni\u00f3n fin de semana \u2014 Parte 2\"],desc:[\"Study the second half and prepare 1\u20132 comments in your own words.\",\"Estudia la segunda mitad y prepara 1 o 2 comentarios con tus propias palabras.\"],min:25},\nfamily:{title:[\"Family Worship\",\"Adoraci\u00f3n en familia\"],desc:[\"45 minutes: Bible discussion, family needs, ministry practice, or a spiritual project. Keep it practical and enjoyable.\",\"45 minutos: conversaci\u00f3n b\u00edblica, necesidades familiares, pr\u00e1ctica para la predicaci\u00f3n o un proyecto espiritual. Mantenlo pr\u00e1ctico y agradable.\"],min:45},\nelder1:{title:[\"Elder Development \u2014 Bible Knowledge\",\"Desarrollo como anciano \u2014 Conocimiento b\u00edblico\"],desc:[\"Study this week's elder curriculum theme and its key scriptures. Aim to explain the subject without notes.\",\"Estudia el tema semanal del programa de anciano y sus textos clave. Procura poder explicarlo sin apuntes.\"],min:25},\nelder2:{title:[\"Elder Development \u2014 Shepherding\",\"Desarrollo como anciano \u2014 Pastoreo\"],desc:[\"Apply this week's theme to shepherding: listening, discernment, empathy, judgment, or encouragement.\",\"Aplica el tema semanal al pastoreo: escuchar, discernimiento, empat\u00eda, juicio o \u00e1nimo.\"],min:20},\nelder3:{title:[\"Elder Development \u2014 Teaching\",\"Desarrollo como anciano \u2014 Ense\u00f1anza\"],desc:[\"Practice teaching this week's theme simply: main point, 2 scriptures, one illustration, one application.\",\"Practica ense\u00f1ar el tema de la semana de forma sencilla: punto principal, 2 textos, una ilustraci\u00f3n y una aplicaci\u00f3n.\"],min:20},\nreview:{title:[\"Weekly Review\",\"Repaso semanal\"],desc:[\"Review notes, identify one spiritual improvement, and choose one point to revisit next week.\",\"Repasa tus notas, identifica una mejora espiritual y escoge un punto para volver a estudiar la pr\u00f3xima semana.\"],min:15}\n};\n\nfunction defaults(){\n return {settings:{language:\"en\",midweekDay:3,weekendDay:0,familyDay:5,chaptersPerDay:2,startBook:0,readingStart:iso(today)},done:{},notes:{},gems:{}};\n}\nfunction load(){\n try{\n  const raw=JSON.parse(localStorage.getItem(\"spiritual_v5\")||\"null\");\n  if(!raw)return defaults();\n  return {...defaults(),...raw,settings:{...defaults().settings,...(raw.settings||{})}};\n }catch(e){return defaults();}\n}\nlet state=load();\nfunction save(){localStorage.setItem(\"spiritual_v5\",JSON.stringify(state));}\nfunction langIndex(){return state.settings.language===\"es\"?1:0;}\nfunction t(k){return I18N[state.settings.language][k]||k;}\nfunction dayName(d){return t(\"days\")[d];}\nfunction formatDate(d){return new Intl.DateTimeFormat(state.settings.language===\"es\"?\"es-US\":\"en-US\",{weekday:\"short\",month:\"short\",day:\"numeric\"}).format(d);}\nfunction mondayOf(d){const x=new Date(d);const shift=(x.getDay()+6)%7;x.setDate(x.getDate()-shift);x.setHours(12,0,0,0);return x;}\nfunction dateForDow(dow){const m=mondayOf(today),x=new Date(m);x.setDate(m.getDate()+((dow+6)%7));return x;}\nfunction previous(d,n){return (d-n+7*10)%7;}\n\nfunction totalChaptersFrom(startBook){\n let n=0; for(let i=startBook;i<BOOKS.length;i++)n+=BOOKS[i][2]; return n;\n}\nfunction readingForDate(d){\n const start=new Date(state.settings.readingStart+\"T12:00:00\");\n let days=Math.max(0,Math.floor((d-start)/DAY_MS));\n const cpd=+state.settings.chaptersPerDay;\n let offset=days*cpd;\n const startBook=+state.settings.startBook;\n const total=totalChaptersFrom(startBook);\n if(total>0)offset%=total;\n let bi=startBook;\n while(offset>=BOOKS[bi][2]){offset-=BOOKS[bi][2];bi++;if(bi>=BOOKS.length)bi=startBook;}\n const out=[];\n for(let i=0;i<cpd;i++){\n   out.push([bi,offset+1]);\n   offset++;\n   if(offset>=BOOKS[bi][2]){offset=0;bi++;if(bi>=BOOKS.length)bi=startBook;}\n }\n return out;\n}\nfunction readingLabel(d){\n const arr=readingForDate(d), li=langIndex();\n const groups=[];\n arr.forEach(([bi,ch])=>{\n   const name=BOOKS[bi][li];\n   const last=groups[groups.length-1];\n   if(last&&last.name===name&&last.end===ch-1)last.end=ch;\n   else groups.push({name,start:ch,end:ch});\n });\n return groups.map(g=>g.start===g.end?`${g.name} ${g.start}`:`${g.name} ${g.start}\u2013${g.end}`).join(\"; \");\n}\n\nfunction curriculumIndex(){\n const anchor=new Date(\"2026-08-24T12:00:00\");\n const diff=Math.floor((mondayOf(today)-anchor)/(7*DAY_MS));\n return ((diff%12)+12)%12;\n}\nfunction getSchedule(){\n const s={0:[],1:[],2:[],3:[],4:[],5:[],6:[]};\n for(let d=0;d<7;d++)s[d].push(\"reading\",\"prayer\");\n const m=+state.settings.midweekDay,w=+state.settings.weekendDay,f=+state.settings.familyDay;\n s[previous(m,2)].push(\"mid1\"); s[previous(m,1)].push(\"mid2\");\n s[previous(w,2)].push(\"week1\"); s[previous(w,1)].push(\"week2\");\n s[f].push(\"family\");\n [1,4,6].forEach((d,i)=>s[d].push([\"elder1\",\"elder2\",\"elder3\"][i]));\n s[0].push(\"review\");\n return s;\n}\nfunction taskTitle(type,d){\n if(type===\"reading\")return (state.settings.language===\"es\"?\"Lectura b\u00edblica: \":\"Bible Reading: \")+readingLabel(d);\n if(type.startsWith(\"elder\"))return TASKS[type].title[langIndex()]+\" \u2014 \"+CURRICULUM[curriculumIndex()][state.settings.language===\"es\"?\"es\":\"en\"];\n return TASKS[type].title[langIndex()];\n}\nfunction taskDesc(type){\n if(type===\"reading\")return state.settings.language===\"es\"?\"Lee los cap\u00edtulos completos. Anota una cualidad de Jehov\u00e1, un principio y una pregunta que quieras investigar.\":\"Read the full chapters. Note one quality of Jehovah, one principle, and one question you may want to research.\";\n if(type.startsWith(\"elder\"))return TASKS[type].desc[langIndex()]+\" \"+(state.settings.language===\"es\"?\"Vea el programa de anciano para la lectura, publicaci\u00f3n y pr\u00e1ctica exactas.\":\"See the Elder Track for the exact reading, publication, and practice assignment.\");\n return TASKS[type].desc[langIndex()];\n}\nfunction taskMinutes(type){return type===\"reading\"?Math.max(10,+state.settings.chaptersPerDay*8):TASKS[type].min;}\n\n\n\nasync function renderOfficialMaterial(){\n const li=langIndex();\n const lang=state.settings.language;\n const cacheKey=`official_material_${lang}`;\n let cached=null;\n try{cached=JSON.parse(localStorage.getItem(cacheKey)||\"null\");}catch(e){}\n const render=(w,stale=false)=>{\n  if(!w)return;\n  const freshness=stale\n    ? (lang===\"es\"?\"Mostrando la \u00faltima actualizaci\u00f3n oficial guardada.\":\"Showing the last successfully saved official update.\")\n    : (lang===\"es\"?\"Actualizado autom\u00e1ticamente desde JW.ORG.\":\"Updated automatically from JW.ORG.\");\n  $(\"officialMaterial\").innerHTML=`\n   <div class=\"official-grid\">\n    <div class=\"official-block\">\n      <div class=\"kicker\">${t(\"lifeMinistry\")}</div>\n      <strong>${t(\"weeklyBibleReading\")}: ${w.weeklyBible||\"\u2014\"}</strong>\n      <p>${t(\"meetingBibleReading\")}: ${w.meetingReading||\"\u2014\"}</p>\n      <p>${t(\"treasures\")}: ${w.treasures||\"\u2014\"}</p>\n      <p>${t(\"livingChristians\")}: ${w.living||\"\u2014\"}</p>\n      <p>${t(\"congregationStudy\")}: ${w.congregation||\"\u2014\"}</p>\n      ${w.mwbUrl?`<a class=\"official-link\" href=\"${w.mwbUrl}\" target=\"_blank\" rel=\"noopener\">${t(\"openJw\")} \u2192</a>`:\"\"}\n    </div>\n    <div class=\"official-block\">\n      <div class=\"kicker\">${t(\"watchtowerStudy\")}</div>\n      <strong>${w.watchtower||\"\u2014\"}</strong>\n      ${w.watchtowerUrl?`<a class=\"official-link\" href=\"${w.watchtowerUrl}\" target=\"_blank\" rel=\"noopener\">${t(\"openJw\")} \u2192</a>`:\"\"}\n    </div>\n    <div class=\"official-block sync-state\"><p>${freshness}</p></div>\n   </div>`;\n };\n if(cached&&cached.data){render(cached.data,true);renderGems(cached.data);}else{renderGems(null);}\n try{\n  const response=await fetch(`/api/current-material?lang=${encodeURIComponent(lang)}&date=${encodeURIComponent(iso(today))}`,{headers:{\"Accept\":\"application/json\"}});\n  if(!response.ok)throw new Error(`HTTP ${response.status}`);\n  const data=await response.json();\n  if(!data||!data.weeklyBible)throw new Error(\"Incomplete material\");\n  localStorage.setItem(cacheKey,JSON.stringify({savedAt:new Date().toISOString(),data}));\n  render(data,false); renderGems(data);\n }catch(err){\n  if(!cached||!cached.data){ renderGems(null);\n   $(\"officialMaterial\").innerHTML=`<div class=\"official-grid\"><div class=\"official-block\"><p>${lang===\"es\"?\"No se pudo obtener el material en este momento. Vuelve a abrir la aplicaci\u00f3n cuando tengas conexi\u00f3n.\":\"The material could not be retrieved right now. Reopen the app when you have a connection.\"}</p></div></div>`;\n  }\n }\n}\n\n\nfunction weekKeyFor(d){return iso(mondayOf(d));}\nfunction renderGems(data=null){\n const wk=weekKeyFor(today);\n $(\"gemNote\").value=(state.gems&&state.gems[wk])||\"\";\n if(!data){\n   $(\"gemsContent\").innerHTML=`<div class=\"gems-empty\">${t(\"gemsUnavailable\")}</div>`;\n   $(\"additionalGemsList\").innerHTML=\"\";\n   return;\n }\n const q=data.gemsQuestion||\"\";\n const ref=data.gemsReference||data.weeklyBible||\"\";\n if(!q){\n   $(\"gemsContent\").innerHTML=`<div class=\"gems-empty\">${t(\"gemsUnavailable\")}</div>`;\n   $(\"additionalGemsList\").innerHTML=\"\";\n   return;\n }\n $(\"gemsContent\").innerHTML=`<div class=\"gems-question\"><div class=\"ref\">${t(\"officialGemQuestion\")}${ref?` \u00b7 ${ref}`:\"\"}</div><strong>${q}</strong>${data.gemsSource?`<p>${data.gemsSource}</p>`:\"\"}</div>`;\n const extras=Array.isArray(data.additionalGems)?data.additionalGems:[];\n if(extras.length){\n   $(\"additionalGemsList\").innerHTML=`<div class=\"extra-gems-list\">${extras.slice(0,5).map((g,i)=>`\n     <div class=\"extra-gem\">\n       <div class=\"verse\">${g.reference}</div>\n       <p>${i%2===0?t(\"whatTeachJehovah\"):t(\"practicalPrinciple\")}</p>\n       ${g.url?`<a href=\"${g.url}\" target=\"_blank\" rel=\"noopener\">${t(\"openJw\")} \u2192</a>`:\"\"}\n     </div>`).join(\"\")}</div>`;\n }else{\n   $(\"additionalGemsList\").innerHTML=`<div class=\"gems-empty\">${t(\"gemsUnavailable\")}</div>`;\n }\n}\nfunction renderToday(){\n const sched=getSchedule(),dow=today.getDay(),tasks=sched[dow],key=iso(today);\n $(\"headerDate\").textContent=formatDate(today);$(\"todayDay\").textContent=dayName(dow);$(\"todaySummary\").textContent=t(\"summary\");$(\"note\").value=state.notes[key]||\"\";\n let total=0;\n $(\"todayTasks\").innerHTML=tasks.map(type=>{\n   const taskKey=`${key}|${type}`;const done=!!state.done[taskKey];const mins=taskMinutes(type);total+=mins;\n   return `<label class=\"task ${type===\"reading\"?\"reading-highlight\":\"\"}\"><input class=\"task-check\" type=\"checkbox\" data-key=\"${taskKey}\" ${done?\"checked\":\"\"}><div class=\"task-body\"><p class=\"task-title\">${taskTitle(type,today)}</p><div class=\"task-meta\">${mins} ${t(\"minutes\")}</div><p class=\"task-desc\">${taskDesc(type)}</p></div></label>`;\n }).join(\"\");\n $(\"totalMinutes\").textContent=`${total} ${t(\"minutes\")}`;\n document.querySelectorAll(\".task-check\").forEach(c=>c.addEventListener(\"change\",()=>{state.done[c.dataset.key]=c.checked;save();renderProgress();}));\n}\nfunction renderWeek(){\n const sched=getSchedule(),order=[1,2,3,4,5,6,0];\n $(\"weekSchedule\").innerHTML=order.map(dow=>{\n  const date=dateForDow(dow);\n  return `<div class=\"day-card\"><div class=\"day-head\"><strong>${dayName(dow)}</strong><span>${formatDate(date)}</span></div><div class=\"day-body\">${sched[dow].map(type=>`<div class=\"mini-task ${type===\"reading\"?\"read\":\"\"}\"><strong>${taskTitle(type,date)}</strong><span>${taskMinutes(type)} ${t(\"minutes\")}</span></div>`).join(\"\")}</div></div>`;\n }).join(\"\");\n}\nfunction renderCurriculum(){\n const idx=curriculumIndex(),c=CURRICULUM[idx],li=langIndex();\n const articleTitle=state.settings.language===\"es\"?c.article.es:c.article.en;\n const articleUrl=state.settings.language===\"es\"?c.article.esUrl:c.article.enUrl;\n const labels=state.settings.language===\"es\"\n  ? {week:\"Semana\",bible:\"1. Lea y medite\",article:\"2. Estudie esta publicaci\u00f3n\",handbook:\"3. Manual para ancianos\",practice:\"4. Pr\u00e1ctica esta semana\",open:\"Abrir en JW.ORG\"}\n  : {week:\"Week\",bible:\"1. Read and meditate\",article:\"2. Study this publication\",handbook:\"3. Elder handbook\",practice:\"4. Practice this week\",open:\"Open on JW.ORG\"};\n $(\"currentCurriculum\").innerHTML=`\n   <div class=\"wk\">${labels.week} ${idx+1} / 12</div>\n   <h3>${c[state.settings.language===\"es\"?\"es\":\"en\"]}</h3>\n   <div class=\"elder-assignment\">\n     <strong>${labels.bible}</strong>\n     <p>${c.scriptures.join(\" \u00b7 \")}</p>\n   </div>\n   <div class=\"elder-assignment\">\n     <strong>${labels.article}</strong>\n     <p>${articleTitle}</p>\n     <a class=\"official-link\" href=\"${articleUrl}\" target=\"_blank\" rel=\"noopener\">${labels.open} \u2192</a>\n   </div>\n   <div class=\"elder-assignment\">\n     <strong>${labels.handbook}</strong>\n     <p>${c.handbook[state.settings.language===\"es\"?\"es\":\"en\"]}</p>\n   </div>\n   <div class=\"elder-assignment\">\n     <strong>${labels.practice}</strong>\n     <p>${c.practice[state.settings.language===\"es\"?\"es\":\"en\"]}</p>\n   </div>`;\n $(\"curriculumList\").innerHTML=CURRICULUM.map((x,i)=>`<div class=\"curriculum-item ${i===idx?\"active\":\"\"}\"><div class=\"num\">${i+1}</div><div><strong>${x[state.settings.language===\"es\"?\"es\":\"en\"]}</strong><span>${x.scriptures.join(\" \u00b7 \")}</span></div></div>`).join(\"\");\n}\nfunction renderProgress(){\n const sched=getSchedule(),order=[1,2,3,4,5,6,0];\n let total=0,done=0,days=0,chapters=0,html=\"\";\n order.forEach(dow=>{\n   const date=dateForDow(dow),key=iso(date);let dayDone=0;\n   sched[dow].forEach(type=>{total++;if(state.done[`${key}|${type}`]){done++;dayDone++;if(type===\"reading\")chapters+=+state.settings.chaptersPerDay;}});\n   if(dayDone)days++;\n   html+=`<div class=\"progress-day\"><strong>${dayName(dow)}</strong><span>${dayDone}/${sched[dow].length}</span></div>`;\n });\n $(\"tasksDone\").textContent=done;$(\"daysActive\").textContent=days;$(\"bibleChapters\").textContent=chapters;$(\"progressBar\").style.width=`${total?done/total*100:0}%`;$(\"progressDays\").innerHTML=html;\n}\nfunction renderSettings(){\n const options=t(\"days\").map((n,i)=>`<option value=\"${i}\">${n}</option>`).join(\"\");\n [\"midweekDay\",\"weekendDay\",\"familyDay\"].forEach(id=>{$(id).innerHTML=options;$(id).value=state.settings[id];});\n $(\"chaptersPerDay\").value=state.settings.chaptersPerDay;$(\"startBook\").value=state.settings.startBook;$(\"language\").value=state.settings.language;\n}\nfunction applyLanguage(){\n document.documentElement.lang=state.settings.language;\n document.querySelectorAll(\"[data-i18n]\").forEach(el=>el.textContent=t(el.dataset.i18n));\n $(\"note\").placeholder=state.settings.language===\"es\"?\"Escribe una idea breve...\":\"Write a brief thought...\";\n renderSettings();renderToday();renderOfficialMaterial();renderWeek();renderCurriculum();renderProgress();\n}\n\ndocument.querySelectorAll(\".tab\").forEach(btn=>btn.addEventListener(\"click\",()=>{\n document.querySelectorAll(\".tab\").forEach(x=>x.classList.remove(\"active\"));\n document.querySelectorAll(\".panel\").forEach(x=>x.classList.remove(\"active\"));\n btn.classList.add(\"active\");$(\"panel-\"+btn.dataset.tab).classList.add(\"active\");\n}));\n\n$(\"saveGem\").addEventListener(\"click\",()=>{\n const wk=weekKeyFor(today);\n if(!state.gems)state.gems={};\n state.gems[wk]=$(\"gemNote\").value;\n save();\n $(\"gemStatus\").textContent=t(\"gemSaved\");\n setTimeout(()=>$(\"gemStatus\").textContent=\"\",1400);\n});\n$(\"saveNote\").addEventListener(\"click\",()=>{state.notes[iso(today)]=$(\"note\").value;save();$(\"status\").textContent=t(\"saved\");setTimeout(()=>$(\"status\").textContent=\"\",1400);});\n$(\"language\").addEventListener(\"change\",e=>{state.settings.language=e.target.value;save();applyLanguage();});\n[\"midweekDay\",\"weekendDay\",\"familyDay\",\"chaptersPerDay\",\"startBook\"].forEach(id=>$(id).addEventListener(\"change\",e=>{\n state.settings[id]=+e.target.value;save();applyLanguage();\n}));\n$(\"restartReading\").addEventListener(\"click\",()=>{if(confirm(t(\"confirmReading\"))){state.settings.readingStart=iso(today);save();applyLanguage();}});\n$(\"resetProgress\").addEventListener(\"click\",()=>{if(confirm(t(\"confirmReset\"))){state.done={};state.notes={};save();applyLanguage();}});\n\napplyLanguage();\nif(\"serviceWorker\"in navigator)window.addEventListener(\"load\",()=>navigator.serviceWorker.register(\"/sw.js\").catch(()=>{}));\n", type: "application/javascript; charset=utf-8" },
  "/manifest.webmanifest": { body: "{\n  \"name\": \"Spiritual Routine / Rutina Espiritual\",\n  \"short_name\": \"Study\",\n  \"start_url\": \"/\",\n  \"display\": \"standalone\",\n  \"background_color\": \"#f5f1e8\",\n  \"theme_color\": \"#f5f1e8\",\n  \"description\": \"Bilingual structured spiritual schedule with exact daily Bible readings, meeting preparation, family worship, and elder development.\",\n  \"icons\": [\n    {\n      \"src\": \"/icons/icon-192.png\",\n      \"sizes\": \"192x192\",\n      \"type\": \"image/png\"\n    },\n    {\n      \"src\": \"/icons/icon-512.png\",\n      \"sizes\": \"512x512\",\n      \"type\": \"image/png\"\n    }\n  ]\n}", type: "application/manifest+json; charset=utf-8" },
  "/sw.js": { body: "const CACHE=\"spiritual-routine-cloudflare-v10\";\nconst ASSETS=[\"/\",\"/index.html\",\"/styles.css\",\"/app.js\",\"/manifest.webmanifest\",\"/icons/icon-192.png\",\"/icons/icon-512.png\"];\nself.addEventListener(\"install\",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));\nself.addEventListener(\"activate\",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener(\"fetch\",e=>{\n  if(e.request.method!==\"GET\")return;\n  const url=new URL(e.request.url);\n  if(url.pathname.startsWith(\"/api/\")){\n    e.respondWith(fetch(e.request));\n    return;\n  }\n  e.respondWith(fetch(e.request).then(r=>{\n    const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));return r;\n  }).catch(()=>caches.match(e.request).then(r=>r||caches.match(\"/index.html\"))));\n});", type: "application/javascript; charset=utf-8" }
};

const ICONS = {
  "/icons/icon-192.png": "iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAIAAADdvvtQAAAD3UlEQVR4nO3dsW0VQRSGURtRETE5TSAKoCAXYNEEOTF1kBKQEyANI8DG8u+ZOzN7TgH2+u7nu/vek97e/vj+7Qae61X1AbA3AREREBEBEREQEQERERARAREREBEBEREQEQERERARAREREBEBEREQEQERERARAREREBEBEREQEQERERARAREREJHX1QfwH28/fqg+hHpf7u6rD+FBtwt+uYJoHrFaTGsFJJ0nWiejJQLSzbOVl1R/E62eRPn0KjdQ+R9/kqpVVLaB1POyquZZE5B6RiiZakFA6hln/mxnB6Se0SZPeGpA6plj5pznBaSemaZNe1JA6plvzsxnBKSeKhMmX/9ONFsbHpD1U2v0/McGpJ4VDD0LLmFEBERkYECuX+sYdy5sICKjArJ+VjPojNhARAREREBEhgTkBmhNI86LDUREQEQERERARAREREBEBEREQEQERGTdgL5++lx9CKtYeRRLf0diP7g3798VHsl8K0fTWzqgXhvo2SXt0k2zTUDNeWtpu2h6+wXU2zemraPp7R1Qb4uYjummOSeg3lI3TOdF0zszoKZwLZ3dTXN4QL0JMV0kmt6FAuq9YEwXjKZ30YB6z7thung3jYB+++9aEs3f1v0sjC0IiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIjIug+ca498u/Jj3lZ46vTj1g2o6Yd4hZjWj6a3QUC9g9fSXt00mwXUHLOWNu2m2TWg3nZrafdoeicE1Cy+lk7qpjkqoN46a+nIbppjA2pKSjo7mt75ATUTLnDX6aa5UEC9l11LF+ymuWhAzbPX0pWj6V09oN5T1pJu/uDD1H94qBL1/E1ARAREREBEBERkSEBf7u5H/FhCI86LDUREQEQERGRUQG6DVjPojNhARAYGZAmtY9y5sIGICIjI2IBcxVYw9CwM30AaqjV6/i5hRGYEZAlVmTD5SRtIQ/PNmfm8S5iGZpo27an3QBqaY+acZ99Ea2i0yRMueBWmoXHmz7bmZbyGRiiZatn7QBp6WVXzvP3x/VvJL27efvxQewC7q/1XrH8n2ipKlE+vfgP1bKMnKu+mWSugX2T0iHXS+WXFgHpiulkvmt7qAbG4+ptotiYgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIgIiIiAiAiIiICICIiIgIj8BbEX5iAB876EAAAAASUVORK5CYII=",
  "/icons/icon-512.png": "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"
};

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/current-material") {
      return handleCurrentMaterial(request);
    }

    if (ICONS[url.pathname]) {
      return new Response(b64ToBytes(ICONS[url.pathname]), {
        headers: {
          "content-type": "image/png",
          "cache-control": "public, max-age=86400"
        }
      });
    }

    const asset = STATIC[url.pathname];
    if (asset) {
      const noCache = url.pathname === "/sw.js";
      return new Response(asset.body, {
        headers: {
          "content-type": asset.type,
          "cache-control": noCache ? "no-cache, no-store, must-revalidate" : "public, max-age=300"
        }
      });
    }

    return new Response(STATIC["/"].body, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300"
      }
    });
  }
};
