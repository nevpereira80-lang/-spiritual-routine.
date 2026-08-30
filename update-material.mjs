
import fs from "node:fs/promises";

const DAY=86400000;
const MONTHS={
 en:["January","February","March","April","May","June","July","August","September","October","November","December"],
 es:["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
};

function iso(d){return d.toISOString().slice(0,10)}
function mondayOf(d=new Date()){
 const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),12));
 const shift=(x.getUTCDay()+6)%7;
 x.setUTCDate(x.getUTCDate()-shift);
 return x;
}
function endOfWeek(m){const d=new Date(m);d.setUTCDate(d.getUTCDate()+6);return d}
function issueUrl(m,lang){
 const first=m.getUTCMonth()%2===0?m.getUTCMonth():m.getUTCMonth()-1;
 const low=(lang==="es"
  ?["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
  :["january","february","march","april","may","june","july","august","september","october","november","december"]);
 const slug=`${low[first]}-${low[first+1]}-${m.getUTCFullYear()}-mwb`;
 return lang==="es"
  ?`https://www.jw.org/es/biblioteca/guia-actividades-reunion-testigos-jehova/${slug}/`
  :`https://www.jw.org/en/library/jw-meeting-workbook/${slug}/`;
}
function weeklyUrl(m,lang){
 const e=endOfWeek(m), sd=m.getUTCDate(), ed=e.getUTCDate(), y=e.getUTCFullYear();
 const issue=issueUrl(m,lang);
 const sm=MONTHS[lang][m.getUTCMonth()], em=MONTHS[lang][e.getUTCMonth()];
 if(lang==="es"){
  const slug=m.getUTCMonth()===e.getUTCMonth()
   ?`Vida-y-Ministerio-Cristianos-${sd}-a-${ed}-de-${sm}-de-${y}`
   :`Vida-y-Ministerio-Cristianos-${sd}-de-${sm}-a-${ed}-de-${em}-de-${y}`;
  return issue+slug+"/";
 }
 const slug=m.getUTCMonth()===e.getUTCMonth()
  ?`Life-and-Ministry-Meeting-Schedule-for-${sm}-${sd}-${ed}-${y}`
  :`Life-and-Ministry-Meeting-Schedule-for-${sm}-${sd}-${em}-${ed}-${y}`;
 return issue+slug+"/";
}
async function get(url){
 const r=await fetch(url,{headers:{
  "accept":"text/html,application/xhtml+xml",
  "accept-language":"en-US,en;q=0.9,es;q=0.8",
  "user-agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
 }});
 if(!r.ok)throw new Error(`${r.status} ${url}`);
 return await r.text();
}
function strip(s=""){
 return s.replace(/<script[\s\S]*?<\/script>/gi," ")
  .replace(/<style[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ")
  .replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'")
  .replace(/\s+/g," ").trim();
}
function headingTexts(html){
 const out=[];const re=/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;let m;
 while((m=re.exec(html)))out.push(strip(m[2]));
 return out;
}
function parse(html,lang,url,monday){
 const text=strip(html), hs=headingTexts(html), es=lang==="es";
 const monthWords=MONTHS[lang].map(x=>x.toLowerCase());
 let weeklyBible="";
 for(const h of hs){
  const low=h.toLowerCase();
  if(monthWords.some(x=>low.includes(x)))continue;
  if((es?/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+\s+\d+(?:\s*[,–-]\s*\d+)?$/:/^[A-Z][A-Z\s]+\s+\d+(?:\s*[,–-]\s*\d+)?$/).test(h.trim())){
    weeklyBible=h.trim();break;
  }
 }
 const bibleRe=es?/Lectura de la Biblia[\s\S]{0,300}?([1-3]?\s?[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+\s+\d+:\d+(?:[–-]\d+)?)/i:/Bible Reading[\s\S]{0,300}?([1-3]?\s?[A-Z][A-Za-z]+\s+\d+:\d+(?:[–-]\d+)?)/i;
 const b=text.match(bibleRe);
 const meetingReading=b?b[1]:"";
 const treasuresLabel=es?"TESOROS DE LA BIBLIA":"TREASURES FROM GOD’S WORD";
 const livingLabel=es?"NUESTRA VIDA CRISTIANA":"LIVING AS CHRISTIANS";
 const tIndex=hs.findIndex(x=>x.toUpperCase().includes(treasuresLabel));
 const lIndex=hs.findIndex(x=>x.toUpperCase().includes(livingLabel));
 const treasures=tIndex>=0?(hs.slice(tIndex+1).find(x=>/^\d+\./.test(x))||"").replace(/^\d+\.\s*/,""):"";
 const living=lIndex>=0?(hs.slice(lIndex+1).find(x=>/^\d+\./.test(x))||"").replace(/^\d+\.\s*/,""):"";
 const cbs=text.match(es?/Estudio bíblico de la congregación[\s\S]{0,200}?(wcg\s+(?:cap\.|capítulo)\s*\d+)/i:/Congregation Bible Study[\s\S]{0,200}?(wcg\s+(?:chap\.|chapter)\s*\d+)/i);
 const gem=text.match(es
  ?/Busquemos perlas escondidas[\s\S]{0,900}?([1-3]?\s?[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+\s+\d+:\d+(?:[–-]\d+)?)\s*[.—-]*\s*([^?]{8,300}\?)/i
  :/Spiritual Gems[\s\S]{0,900}?([1-3]?\s?[A-Z][A-Za-z]+\s+\d+:\d+(?:[–-]\d+)?)\s*[.—-]*\s*([^?]{8,300}\?)/i
 );
 return {
  weekStart:iso(monday),weekEnd:iso(endOfWeek(monday)),
  weeklyBible,meetingReading,treasures,living,
  congregation:cbs?cbs[1]:"",
  gemsReference:gem?gem[1]:"",
  gemsQuestion:gem?gem[2].trim():"",
  gemsSource:"",
  additionalGems:[],
  watchtower:"",
  mwbUrl:url,watchtowerUrl:"",
  fetchedAt:new Date().toISOString()
 };
}
async function watchtower(monday,lang){
 const end=endOfWeek(monday);
 const indexes=lang==="es"
  ?["https://www.jw.org/es/biblioteca/revistas/"]
  :["https://www.jw.org/en/library/magazines/"];
 const idx=await get(indexes[0]);
 // Search issue links from the main magazine index, newest first.
 const hrefRe=/<a\b[^>]*href=["']([^"']*(?:atalaya-estudio|watchtower-study)-[^"']+)["'][^>]*>/gi;
 const urls=[];let m;
 while((m=hrefRe.exec(idx))){
  let u=m[1];if(u.startsWith("/"))u="https://www.jw.org"+u;
  if(!urls.includes(u))urls.push(u);
 }
 const sd=monday.getUTCDate(),ed=end.getUTCDate(),y=end.getUTCFullYear();
 for(const issue of urls.slice(0,10)){
  try{
   const h=await get(issue), plain=strip(h);
   const dateNeedles=lang==="es"
    ?[String(sd),String(ed),String(y)]
    :[String(sd),String(ed),String(y)];
   if(!dateNeedles.every(x=>plain.includes(x)))continue;
   const hs=headingTexts(h);
   for(let i=0;i<hs.length;i++){
    const title=hs[i];
    if(title.length<8)continue;
    const pos=plain.indexOf(title);
    if(pos<0)continue;
    const around=plain.slice(pos,pos+500).toLowerCase();
    if(lang==="es"){
      if(around.includes("artículo de estudio para la semana")&&around.includes(String(sd))&&around.includes(String(ed)))return {title,url:issue};
    }else{
      if(around.includes("studied during the week")&&around.includes(String(sd))&&around.includes(String(ed)))return {title,url:issue};
    }
   }
  }catch{}
 }
 return {title:"",url:""};
}

const monday=mondayOf(new Date());
const data={en:[],es:[]};
for(const lang of ["en","es"]){
 const url=weeklyUrl(monday,lang);
 const html=await get(url);
 const item=parse(html,lang,url,monday);
 const wt=await watchtower(monday,lang);
 item.watchtower=wt.title;
 item.watchtowerUrl=wt.url;
 data[lang].push(item);
}
await fs.writeFile("meeting-data.js","export default "+JSON.stringify(data,null,2)+";\n","utf8");
console.log("Updated meeting-data.js for",iso(monday));
