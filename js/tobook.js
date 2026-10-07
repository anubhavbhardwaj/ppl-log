/* To-book list per trip: what to book, which day it is for, and the date to book it by.
   Stored on the trip document as toBook: [{ id, what, for, by, cost, link, note, done, doneAt }].
   This module is pure (no Firestore); travel.js saves and binds. */
import {esc,todayStr,daysBetween,fmtDate,parseYmd,UI} from "./util.js";

export const SOON=14; // days: "book in N days" turns urgent inside this
const MON=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const short=ds=>fmtDate(ds,{day:"numeric",month:"short"});
const eur=n=>"€"+(Math.round(n*100)/100).toLocaleString(undefined,{maximumFractionDigits:2});
export const newItemId=()=>"b"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
export const items=t=>Array.isArray(t&&t.toBook)?t.toBook:[];
export const openItems=t=>items(t).filter(x=>!x.done);

// Where an item stands today: done, overdue, today, soon (within SOON days), later, or nodate.
export function itemState(x,today=todayStr()){
  if(x.done) return {state:"done",label:"Booked"};
  if(!x.by) return {state:"nodate",label:"No deadline",days:null};
  const d=daysBetween(today,x.by);
  if(d<0) return {state:"overdue",label:d===-1?"1 day late":`${-d} days late`,days:d};
  if(d===0) return {state:"today",label:"Book today",days:0};
  if(d<=SOON) return {state:"soon",label:d===1?"Book tomorrow":`Book in ${d} days`,days:d};
  return {state:"later",label:`By ${short(x.by)}`,days:d};
}
const rank=x=>x.by||"9999-99-99";
export const sortOpen=list=>[...list].sort((a,b)=>rank(a).localeCompare(rank(b))||(a.for||"9").localeCompare(b.for||"9")||String(a.what).localeCompare(String(b.what)));

// The most urgent open items across trips that haven't ended, for the Today screen.
export function urgentItems(trips,today=todayStr()){
  const out=[];
  for(const t of trips){
    if(t.return&&t.return<today) continue;
    for(const x of openItems(t)){const s=itemState(x,today); if(s.state==="overdue"||s.state==="today"||(s.state==="soon"&&s.days<=7)) out.push({t,x,s});}
  }
  return out.sort((a,b)=>rank(a.x).localeCompare(rank(b.x)));
}

/* ---------- Parsing pasted lists ---------- */
// Year for a date written without one: the latest year that doesn't put it after the trip ends.
function inferYear(m,d,trip){
  const anchor=(trip&&(trip.return||trip.depart))||todayStr();
  let y=Number(anchor.slice(0,4));
  const iso=yy=>`${yy}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  if(iso(y)>anchor) y--;
  return iso(y);
}
const valid=(y,m,d)=>{const dt=new Date(y,m-1,d);return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d;};
export function parseDate(s,trip,today=todayStr()){
  s=String(s||"").trim().toLowerCase().replace(/,/g," ").replace(/\s+/g," ");
  if(!s||s==="-"||s==="?") return "";
  if(s==="now"||s==="today"||s==="asap") return today;
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m){const y=+m[1],mo=+m[2],d=+m[3];return valid(y,mo,d)?`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`:null;}
  const mon=w=>MON.indexOf(w.slice(0,3))+1;
  const out=(y,mo,d)=>{if(!mo||!valid(y||2000,mo,d)) return null; if(!y) return inferYear(mo,d,trip); y=y<100?2000+y:y; return valid(y,mo,d)?`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`:null;};
  m=s.match(/^(?:[a-z]{3,9} )?(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})\.?(?: (\d{2,4}))?$/); // 27 Dec, Sun 27 Dec 2026
  if(m) return out(m[3]?+m[3]:0,mon(m[2]),+m[1]);
  m=s.match(/^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?(?: (\d{2,4}))?$/); // Dec 27, Dec 27 2026
  if(m) return out(m[3]?+m[3]:0,mon(m[1]),+m[2]);
  m=s.match(/^(\d{1,2})[./](\d{1,2})[./]?(\d{2,4})?$/); // 27.12., 27/12/2026
  if(m) return out(m[3]?+m[3]:0,+m[2],+m[1]);
  return null;
}
export function parseCost(s){
  const v=String(s||"").replace(/[€\s]/g,"").replace(/eur/i,"");
  if(!v) return null;
  const n=Number(v.includes(",")&&!v.includes(".")?v.replace(",","."):v.replace(/,/g,""));
  return Number.isFinite(n)&&n>=0?n:undefined;
}
export function cleanLink(s){
  s=String(s||"").trim(); if(!s) return "";
  if(/^https?:\/\//i.test(s)) return s;
  if(/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s)) return "https://"+s;
  return "";
}
// One item per line: what ; for ; book by ; cost ; link  (separators ; | or tab). Returns {items, errors}.
export function parseLines(text,trip,today=todayStr()){
  const itemsOut=[], errors=[];
  String(text||"").split(/\r?\n/).forEach((line,i)=>{
    const raw=line.trim().replace(/^[-*•]\s*/,""); if(!raw) return;
    const p=raw.split(/\s*[;|\t]\s*/);
    const what=(p[0]||"").trim(); if(!what){errors.push(`Line ${i+1}: missing what to book`);return;}
    const forD=parseDate(p[1],trip,today), byD=parseDate(p[2],trip,today), cost=parseCost(p[3]), link=cleanLink(p[4]);
    if(forD===null||byD===null||cost===undefined){errors.push(`Line ${i+1}: couldn't read ${[forD===null&&"the 'for' date",byD===null&&"the 'book by' date",cost===undefined&&"the cost"].filter(Boolean).join(", ")}`);return;}
    itemsOut.push({id:newItemId(),what,for:forD||"",by:byD||"",cost:cost??null,link,note:"",done:false});
  });
  return {items:itemsOut,errors};
}

/* ---------- Rendering ---------- */
const dueChip=s=>`<span class="tbdue ${s.state}">${esc(s.label)}</span>`;
function itemRow(t,x,today){
  const s=itemState(x,today);
  const meta=[x.for?`for ${fmtDate(x.for)}`:"",x.cost!=null?eur(x.cost):"",x.done&&x.doneAt?`booked ${short(x.doneAt.slice(0,10))}`:""].filter(Boolean).join(" · ");
  return `<li class="tb ${s.state}">
    <input type="checkbox" class="tbcheck" data-tbdone="${t.id}|${esc(x.id)}"${x.done?" checked":""} aria-label="${x.done?"Mark as not booked":"Mark as booked"}: ${esc(x.what)}">
    <div class="tb-main"><b>${esc(x.what)}</b>${meta?`<span class="small muted">${esc(meta)}</span>`:""}
      ${x.note?`<span class="small">${esc(x.note)}</span>`:""}
      <span class="row small" style="gap:12px">${x.link?`<a href="${esc(x.link)}" target="_blank" rel="noopener">Open link</a>`:""}<button class="linkbtn small" data-tbedit="${t.id}|${esc(x.id)}">Edit</button></span></div>
    ${x.done?"":dueChip(s)}</li>`;
}
function formHtml(t,f){
  const d=f.d; const isNew=!f.id;
  return `<div class="tbform stack" id="tbform">
    <div class="label">${isNew?"Add to book":"Edit item"}</div>
    <label><span class="label">What</span><input class="field" id="tb-what" value="${esc(d.what)}" placeholder="e.g. Alhambra tickets"></label>
    <div class="grid2"><label><span class="label">For (date of use)</span><input class="field" type="date" id="tb-for" value="${esc(d.for)}"></label>
      <label><span class="label">Book by</span><input class="field" type="date" id="tb-by" value="${esc(d.by)}"></label></div>
    <div class="grid2"><label><span class="label">Cost (€)</span><input class="field num" type="number" min="0" step="0.01" inputmode="decimal" id="tb-cost" value="${d.cost??""}"></label>
      <label><span class="label">Link</span><input class="field" id="tb-link" value="${esc(d.link)}" placeholder="https://"></label></div>
    <label><span class="label">Note</span><input class="field" id="tb-note" value="${esc(d.note)}" placeholder="Time slot, which site, cancellation terms…"></label>
    <div class="row"><button class="btn sm primary" data-tbsave="${t.id}">${isNew?"Add":"Save"}</button><button class="btn sm ghost" data-tbcancel>Cancel</button>
      ${isNew?"":`<button class="linkbtn small" style="color:var(--bad);margin-left:auto" data-tbdel="${t.id}|${esc(f.id)}">${UI.confirm==="tbdel:"+f.id?"Tap again to delete":"Delete"}</button>`}</div></div>`;
}
function pasteHtml(t){
  return `<div class="tbform stack" id="tbpaste">
    <div class="label">Paste a list</div>
    <p class="small muted" style="margin:0">One item per line: <b>what ; for ; book by ; cost ; link</b>. Only "what" is required. Dates like <span class="num">27 Dec</span>, <span class="num">2026-12-27</span> or <span class="num">now</span>; a missing year is taken from the trip.</p>
    <textarea rows="6" id="tb-paste" placeholder="Sagrada Família tickets ; 27 Dec ; now ; 52 ; sagradafamilia.org&#10;Travel insurance ; ; 1 Nov"></textarea>
    <div class="row"><button class="btn sm primary" data-tbpasteadd="${t.id}">Add items</button><button class="btn sm ghost" data-tbcancel>Cancel</button></div></div>`;
}
export function toBookCard(t,today=todayStr()){
  const all=items(t); const open=sortOpen(all.filter(x=>!x.done)); const done=all.filter(x=>x.done).sort((a,b)=>(a.for||"").localeCompare(b.for||""));
  const f=UI.bookForm&&UI.bookForm.tripId===t.id?UI.bookForm:null; const paste=UI.bookPaste===t.id;
  const est=all.reduce((s,x)=>s+(Number(x.cost)||0),0), paid=done.reduce((s,x)=>s+(Number(x.cost)||0),0);
  const late=open.filter(x=>itemState(x,today).state==="overdue").length;
  const head=all.length?`${done.length} of ${all.length} booked`:"";
  return `<div class="card tobook" id="tobook"><div class="spread"><div class="label">To book</div><span class="small muted num">${head}</span></div>
    ${all.length?`<div class="meter"><span style="width:${Math.round(done.length/all.length*100)}%;background:var(--vac)"></span></div>`:""}
    ${late?`<p class="small" style="margin:8px 0 0;color:var(--bad)"><b>${late===1?"1 item is":late+" items are"} past the book-by date.</b></p>`:""}
    ${open.length?`<ul class="list tblist">${open.map(x=>f&&f.id===x.id?`<li class="tbedit">${formHtml(t,f)}</li>`:itemRow(t,x,today)).join("")}</ul>`
      :all.length?`<p class="small" style="margin:8px 0 0">Everything is booked.</p>`
      :`<p class="small muted" style="margin:6px 0 0">List what this trip still needs: tickets, trains, tables, insurance. Give each a book-by date and the most urgent shows up on Today.</p>`}
    ${f&&!f.id?formHtml(t,f):""}${paste?pasteHtml(t):""}
    ${!f&&!paste?`<div class="row" style="margin-top:10px"><button class="btn sm" data-tbadd="${t.id}">+ Add item</button><button class="btn sm ghost" data-tbpaste="${t.id}">Paste a list</button></div>`:""}
    ${est?`<p class="small muted num" style="margin:8px 0 0">Costs entered: ${eur(est)} in total · ${eur(paid)} booked · ${eur(est-paid)} still to book</p>`:""}
    ${done.length?`<details style="margin-top:8px"${UI.bookDoneOpen===t.id?" open":""} data-tbdoneopen="${t.id}"><summary>Booked (${done.length})</summary><ul class="list tblist">${done.map(x=>f&&f.id===x.id?`<li class="tbedit">${formHtml(t,f)}</li>`:itemRow(t,x,today)).join("")}</ul></details>`:""}
  </div>`;
}
// Small summary for the trip list row.
export function toBookChip(t,today=todayStr()){
  const open=openItems(t); if(!open.length) return "";
  const urgent=open.filter(x=>{const s=itemState(x,today).state;return s==="overdue"||s==="today"||s==="soon";}).length;
  return `<span class="chip tbchip${urgent?" urgent":""}">${open.length} to book${urgent?` · ${urgent} due soon`:""}</span>`;
}
// Today screen nudge: the most urgent item, plus how many others are close.
export function toBookNudge(trips,today=todayStr()){
  const list=urgentItems(trips,today); if(!list.length) return "";
  const {t,x,s}=list[0]; const more=list.length-1;
  return `<button class="card tripline tbnudge ${s.state}" data-opentrip="${t.id}" data-tbfocus="1"><span class="tbdot ${s.state}" aria-hidden="true"></span><span><span class="label">To book · ${esc(s.label.toLowerCase())}</span><br><b>${esc(x.what)}</b> <span class="small muted">· ${esc(t.title)}${x.for?` · for ${short(x.for)}`:""}${more?` · +${more} more due soon`:""}</span></span></button>`;
}
