/* Travel tab: leave balances and a compact trip list; each trip opens its own page with the booking timer,
   flight prices and details. Calendar, bridges, holidays and budget sit in collapsible sections. */
import {$,esc,todayStr,addDays,daysBetween,fmtDate,eachDay,parseYmd,ls,toast,guard,UI,bus} from "./util.js";
import {S,saveTrip,removeTrip,saveLeave,seedTrips,saveFares,idToken} from "./store.js";
import {holidays,holidayName,isWorkday,isWeekend,budgetFor,DEFAULT_BUDGET,BLOCK_TYPES,KINDS,DEFAULT_AIRPORTS,blockDays,tripCounts,balances,tripInYear,tripOn,dayMap,problems,bridges,draftPlan2027,candidateDates,shiftTrip,bookingAdvice,bookingWindow} from "./leave.js";

const KIND_PLATE={rome:"push",india:"legs",europe:"pull",other:"home"};
const STATUS={idea:"Idea",planned:"Planned",booked:"Booked"};
const plural=(n,w)=>`${n} ${w}${n===1?"":"s"}`;
const short=ds=>fmtDate(ds,{day:"numeric",month:"short"});
const countText=c=>[c.vacation&&`${c.vacation} vacation`,c.yearEnd&&`${c.yearEnd} year-end`,c.wfi&&`${c.wfi} WFI`].filter(Boolean).join(" · ")||"No leave days";

/* ---------- Today card ---------- */
export function currentTrip(){return tripOn(S.trips,todayStr());}
export function travelToday(){
  const t=todayStr(); const cur=currentTrip();
  if(cur){
    const day=daysBetween(cur.depart,t)+1, len=daysBetween(cur.depart,cur.return)+1;
    const m=dayMap([cur]).get(t); const what=m&&m.type?BLOCK_TYPES[m.type]:holidayName(t)||(isWeekend(t)?"Weekend":"Travel day");
    return `<button class="card tripline ${cur.kind||"other"}" data-gotravel><span class="plate ${KIND_PLATE[cur.kind]||"home"}"></span><span><span class="label">Away · day ${day} of ${len}</span><br><b>${esc(cur.title)}</b> <span class="small muted">· today: ${esc(what)}</span></span></button>`;
  }
  const next=S.trips.filter(x=>x.status!=="idea"&&x.depart>t).sort((a,b)=>a.depart.localeCompare(b.depart))[0];
  if(!next) return bookNudge();
  const n=daysBetween(t,next.depart);
  return bookNudge()+`<button class="card tripline" data-opentrip="${next.id}"><span class="plate ${KIND_PLATE[next.kind]||"home"}"></span><span><span class="label">Next trip · ${n===1?"tomorrow":"in "+n+" days"}</span><br><b>${esc(next.title)}</b> <span class="small muted">· ${short(next.depart)} to ${short(next.return)}</span></span></button>`;
}

// Most urgent "book now / book within N days" across planned trips, shown on Today.
function bookNudge(){
  const t=todayStr();
  const list=S.trips.filter(x=>x.status==="planned").map(x=>({t:x,a:advice(x)})).filter(x=>x.a&&(x.a.state==="now"||x.a.state==="late"||(x.a.state==="window"&&x.a.days<=14)));
  if(!list.length) return "";
  list.sort((a,b)=>(a.a.days??0)-(b.a.days??0));
  const {t:tr,a}=list[0];
  return `<button class="card tripline booknudge ${a.state}" data-opentrip="${tr.id}"><span class="plate ${KIND_PLATE[tr.kind]||"home"}"></span><span><span class="label">Book flights</span><br><b>${esc(tr.title)}</b> <span class="small">· ${esc(a.state==="window"?a.headline.toLowerCase():a.badge.toLowerCase())}</span></span></button>`;
}
// Advice uses the last check's result for the trip's current dates, if that check still matches the trip.
function advice(t){
  const f=S.fares[t.id]; const row=f&&f.key===fareKey(t)?(f.results||[]).find(r=>r.depart===t.depart):null;
  return bookingAdvice(t,row,f&&f.checkedAt,todayStr());
}

/* ---------- Travel tab ---------- */
export function renderTravel(){
  if(UI.editTrip) return renderEditor();
  if(UI.openTrip){const tr=S.trips.find(x=>x.id===UI.openTrip); if(tr) return renderTripPage(tr); UI.openTrip=null;}
  const y=UI.travelYear; const today=todayStr();
  const trips=S.trips.filter(t=>tripInYear(t,y));
  const upcoming=trips.filter(t=>!t.return||t.return>=today), past=trips.filter(t=>t.return&&t.return<today);
  const bal=balances(S.trips,S.leave,y);
  const probs=problems(S.trips,S.leave,y);
  const tile=(label,b,note)=>{const pct=b.total?Math.min(100,Math.max(0,b.used/b.total*100)):0;
    return `<div class="tile"><div class="label">${label}</div><div class="big num ${b.left<0?"bad":""}">${b.left}</div><div class="small muted">left of ${b.total}</div><div class="meter"><span style="width:${pct}%"></span></div>${note?`<div class="small muted" style="margin-top:4px">${note}</div>`:""}</div>`;};
  const ideaDays=bal.ideas.vacation+bal.ideas.yearEnd+bal.ideas.wfi;
  return `<div class="stack">
    <div class="spread"><h1>Travel</h1><div class="row yearpick"><button class="btn sm ghost" data-year="${y-1}" aria-label="Previous year">‹</button><b class="num">${y}</b><button class="btn sm ghost" data-year="${y+1}" aria-label="Next year">›</button></div></div>
    <div class="tiles">${tile("Vacation",bal.flexible,`+${bal.budget.yearEnd} year-end`)}${tile("Year-end",bal.yearEnd)}${tile("WFI",bal.wfi)}</div>
    ${ideaDays?`<p class="small muted" style="margin:-4px 0 0">Ideas not yet counted: ${countText(bal.ideas)}.</p>`:""}
    ${probs.length?`<div class="card warn"><div class="label">Check these</div><ul class="small" style="margin:6px 0 0;padding-left:18px">${probs.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div>`:""}
    ${!trips.length?`<div class="card"><h3>No trips in ${y} yet</h3>${y===2027?`<p class="small muted">Load the plan we worked out: two Rome weekends in Jan and Feb, India in late May (2 weeks vacation + 1 week WFI) and India in December (10 WFI days + 6 year-end days).</p><button class="btn primary block" data-seed>Load my 2027 plan</button>`:`<p class="small muted">Add a trip to start counting leave for ${y}.</p>`}</div>`:""}
    ${upcoming.length?`<div class="triplist">${upcoming.map(tripRow).join("")}</div>`:""}
    <button class="btn block" data-newtrip>+ Add trip</button>
    ${past.length?`<details class="card"><summary>Past trips (${past.length})</summary><div class="triplist" style="margin-top:8px">${past.map(tripRow).join("")}</div></details>`:""}
    <details class="card"${UI.calOpen?" open":""} data-cal><summary>${y} calendar</summary>${legend()}<div class="months">${(()=>{const map=dayMap(S.trips);return Array.from({length:12},(_,m)=>monthGrid(y,m,map)).join("")})()}</div></details>
    <details class="card"><summary>Long weekends and bridges</summary>${bridgeList(y)}</details>
    <details class="card"><summary>Public holidays (Bavaria, Munich)</summary><ul class="list small" style="margin-top:8px">${[...holidays(y)].map(([d,n])=>`<li><span>${esc(n)}</span><span class="muted ${isWeekend(d)?"strike":""}">${fmtDate(d)}${isWeekend(d)?" · weekend":""}</span></li>`).join("")}</ul></details>
    <details class="card"><summary>Leave budget</summary>${budgetForm(y)}<p class="small muted" style="margin:8px 0 0">Unused vacation only carries into ${y+1} as an extension of the year-end block: add it as a January block marked "carried over".</p></details>
  </div>`;
}
const kindChips=c=>["vacation","yearEnd","wfi"].filter(k=>c[k]).map(k=>`<span class="chip ${k}">${c[k]} ${k==="wfi"?"WFI":BLOCK_TYPES[k].toLowerCase()}</span>`).join("");
function tripRow(t){
  const c=tripCounts(t,UI.travelYear); const a=advice(t);
  const nights=t.depart&&t.return?daysBetween(t.depart,t.return):null;
  return `<button class="triprow" data-opentrip="${t.id}">
    <span class="plate ${KIND_PLATE[t.kind]||"home"}"></span>
    <span class="tr-main"><b>${esc(t.title)}</b><span class="small muted">${t.depart?short(t.depart):"?"} to ${t.return?short(t.return):"?"}${nights!=null?` · ${plural(nights,"night")}`:""}${t.status==="idea"?" · idea":""}</span>
      <span class="chips" style="margin-top:4px">${kindChips(c)}</span></span>
    ${a?`<span class="bk ${a.state}">${esc(a.badge)}</span>`:""}<span class="chev" aria-hidden="true">›</span></button>`;
}

/* ---------- Trip page ---------- */
function renderTripPage(t){
  const c=tripCounts(t,null); const nights=t.depart&&t.return?daysBetween(t.depart,t.return):null;
  const a=t.airports||{}; const f=t.flex||{};
  return `<div class="stack"><button class="linkbtn" data-closetrip>← Travel</button>
    <div class="card"><div class="spread"><span class="tag"><span class="plate ${KIND_PLATE[t.kind]||"home"}"></span>${esc(KINDS[t.kind]||"")}</span><span class="badge ${t.status}">${STATUS[t.status]||""}</span></div>
      <h2 style="margin-top:6px;font-size:28px">${esc(t.title)}</h2>
      <p class="small" style="margin:4px 0 0">${t.depart?fmtDate(t.depart):"?"} to ${t.return?fmtDate(t.return):"?"}${nights!=null?` · ${plural(nights,"night")}`:""}</p>
      <div class="chips">${kindChips(c)||`<span class="chip">No leave days</span>`}</div>
      <div class="row" style="margin-top:10px"><button class="btn sm" data-edittrip="${t.id}">Edit trip</button>${t.status==="planned"?`<button class="btn sm ghost" data-markbooked="${t.id}">Mark as booked</button>`:""}</div></div>
    ${bookingCard(t)}
    <div class="card"><div class="label">Flights</div>
      ${(a.from||[]).length?`<p class="small" style="margin:6px 0 8px">${esc((a.from||[]).join(", "))} → ${esc((a.to||[]).join(", ")||"?")}${f.departFrom&&f.departTo?`<br><span class="muted">Searching departures ${short(f.departFrom)} to ${short(f.departTo)}, ${plural(Number(f.nights)||nights||0,"night")}</span>`:""}</p>`:`<p class="small muted">Add airports in Edit trip to check prices.</p>`}
      ${fareSection(t)}</div>
    ${t.note?`<div class="card"><div class="label">Note</div><p class="small" style="margin:6px 0 0">${esc(t.note)}</p></div>`:""}
  </div>`;
}
function bookingCard(t){
  const a=advice(t);
  if(!a) return "";
  if(a.state==="booked") return `<div class="card"><div class="label">When to book</div><p style="margin:6px 0 0"><b>Booked.</b> <button class="linkbtn small" data-unbook="${t.id}">Mark as not booked</button></p></div>`;
  const total=daysBetween(a.open,a.close), into=Math.min(total,Math.max(0,daysBetween(a.open,todayStr())));
  const f=S.fares[t.id]; const row=f&&f.key===fareKey(t)?(f.results||[]).find(r=>r.depart===t.depart):null;
  const facts=[];
  if(row&&row.price!=null){
    facts.push(`Last check ${ago(f.checkedAt)}: <b>${eur(row.price)}</b> for your dates${row.level?`, <span class="lvl ${esc(row.level)}">${esc(row.level)}</span> for this route`:""}${row.typical?` (usually ${eur(row.typical[0])} to ${eur(row.typical[1])})`:""}.`);
    if(row.hist) facts.push(`Past ${row.hist.days} days: ${row.hist.change14>=5?`up ${row.hist.change14}% in the last 2 weeks`:row.hist.change14<=-5?`down ${-row.hist.change14}% in the last 2 weeks`:"roughly flat in the last 2 weeks"}, lowest ${eur(row.hist.min)}.`);
  } else facts.push("No price check yet for these dates. Check prices to refine the timer.");
  const big=a.state==="early"?`<div class="bignum num">${a.days}</div><div class="small muted">days until the window opens on ${fmtDate(a.open)}</div>`
    :a.state==="window"?`<div class="bignum num">${a.days}</div><div class="small muted">days left to book, window closes ${fmtDate(a.close)}${a.rising&&a.fresh?" (shortened: prices rising)":""}</div>`
    :`<div class="bignum now">Book now</div><div class="small muted">${esc(a.headline.replace(/^Book now: /,""))}</div>`;
  const stale=(a.state==="window"||a.state==="late")&&!a.fresh&&!!row;
  return `<div class="card booking ${a.state}"><div class="label">When to book</div>
    <div class="bk-head">${big}</div>
    <div class="bk-bar" aria-hidden="true"><span style="width:${a.state==="early"?0:total?Math.round(into/total*100):100}%"></span></div>
    <div class="spread small muted"><span>Opens ${short(a.open)}</span><span>Closes ${short(a.close)}</span></div>
    <ul class="small bk-facts">${[a.why,...facts].map(x=>`<li>${x===a.why?esc(x):x}</li>`).join("")}</ul>
    ${stale?`<p class="small" style="margin:6px 0 0;color:var(--warn)">Prices haven't been checked in the last week. Check again to keep the timer accurate.</p>`:""}
  </div>`;
}

/* ---------- Flight prices ---------- */
const eur=n=>"€"+Math.round(n).toLocaleString();
// Gulf and wider Middle East hubs. Excluded as layovers when "Avoid Middle East layovers" is on.
const ME_HUBS=["DXB","DWC","AUH","SHJ","DOH","BAH","KWI","MCT","SLL","RUH","JED","DMM","MED","AMM","AQJ","TLV","BEY","BGW","BSR","EBL","ISU","IKA","THR","MHD","SYZ","DAM","CAI","HBE","SSH","HRG","ADE","SAH"];
const STOP_LABEL={any:"Any stops",direct:"Direct only",both:"Compare both"};
const STOP_TEXT={any:"Any stops",direct:"Direct only",both:"Direct vs with stops"};
const prefs=t=>({stops:"any",avoidME:true,...(t.flights||{})});
const searchesPer=t=>prefs(t).stops==="both"?2:1;
const prefText=t=>{const p=prefs(t);return STOP_TEXT[p.stops]+(p.avoidME&&p.stops!=="direct"?" · no Middle East layovers":"");};
const fareKey=t=>{const p=prefs(t);return `${(t.airports?.from||[]).join(",")}>${(t.airports?.to||[]).join(",")}|${t.depart&&t.return?daysBetween(t.depart,t.return):""}|${p.stops}|${p.avoidME?1:0}`;};
const ago=iso=>{const d=Math.floor((Date.now()-new Date(iso))/864e5);return d<=0?"today":d===1?"yesterday":d+" days ago"};
const fares={left:undefined,loading:false};
function leaveDelta(t,delta){
  if(!delta) return "";
  const a=tripCounts(t,null), b=tripCounts(shiftTrip(t,delta),null);
  const parts=["vacation","yearEnd","wfi"].map(k=>{const d=b[k]-a[k];return d?`${d>0?"+":"-"}${Math.abs(d)} ${k==="wfi"?"WFI":BLOCK_TYPES[k].toLowerCase()}`:""}).filter(Boolean);
  return parts.length?parts.join(", "):"same leave";
}
function fareSection(t){
  const a=t.airports||{};
  if(!(a.from||[]).length||!(a.to||[]).length||!t.depart||!t.return) return "";
  const n=candidateDates(t).length*searchesPer(t);
  const run=UI.fareRun&&UI.fareRun.id===t.id?UI.fareRun:null;
  if(run) return `<div class="fares"><div class="label">Checking prices · ${run.done} of ${run.total}</div><div class="meter"><span style="width:${run.done/run.total*100}%"></span></div></div>`;
  const f=S.fares[t.id];
  const btn=label=>`<button class="btn sm" data-checkfares="${t.id}"${UI.fareRun?" disabled":""}>${label} · ${(n===1?"1 search":n+" searches")}</button>`;
  const filt=`<p class="small muted" style="margin:0 0 6px">${esc(prefText(t))}</p>`;
  if(!f||!(f.results||[]).length) return `<div class="fares first">${filt}${btn("Check flight prices")}</div>`;
  const rows=[...f.results].sort((x,y)=>x.depart.localeCompare(y.depart));
  const priced=rows.filter(r=>r.price!=null);
  const best=priced.reduce((x,y)=>!x||y.price<x.price?y:x,null);
  const cur=rows.find(r=>r.depart===t.depart);
  const mode=f.mode||"any";
  const directs=rows.filter(r=>r.direct&&r.direct.price!=null);
  const bestDirect=directs.reduce((x,y)=>!x||y.direct.price<x.direct.price?y:x,null);
  let head=mode==="direct"?"No direct flights found for these dates.":"No prices found for these dates.";
  if(best){
    head=`Cheapest <b>${eur(best.price)}</b> · ${short(best.depart)} to ${short(best.return)}`;
    if(best.depart===t.depart) head+=` · your dates`;
    else if(cur&&cur.price!=null) head+=` · <span class="save">${eur(cur.price-best.price)} less than your dates</span>`;
  }
  const head2=mode!=="both"?"":bestDirect?`<p class="small" style="margin:2px 0 0">Cheapest direct <b>${eur(bestDirect.direct.price)}</b> · ${short(bestDirect.depart)} to ${short(bestDirect.return)}${best?` · ${eur(bestDirect.direct.price-best.price)} more than with stops`:""}</p>`:`<p class="small" style="margin:2px 0 0">No direct flights found for these dates.</p>`;
  return `<div class="fares">${filt}<p class="small" style="margin:0">${head}</p>${head2}
    ${f.key!==fareKey(t)?`<p class="small" style="margin:4px 0 0;color:var(--warn)">Airports, trip length or flight filters changed since this check.</p>`:""}
    <details${UI.openFares.has(t.id)?" open":""} data-farelist="${t.id}"><summary>${plural(rows.length,"date")} checked</summary>
    <ul class="list fare-list">${rows.map(r=>{const isCur=r.depart===t.depart;const delta=daysBetween(t.depart,r.depart);
      return `<li class="${best&&r===best?"best":""}"><div><b>${short(r.depart)} to ${short(r.return)}</b><br><span class="small muted">${r.price==null?"no flights found":[r.fromAirport&&r.toAirport?`${r.fromAirport} → ${r.toAirport}`:"",r.airline,r.stops===0?"direct":r.stops!=null?plural(r.stops,"stop")+((r.via||[]).length?" via "+r.via.join(", "):""):""].filter(Boolean).map(esc).join(" · ")}</span>${isCur?"":`<br><span class="small ldelta">${leaveDelta(t,delta)}</span>`}</div>
        <div class="fare-r"><b class="num">${r.price==null?"–":eur(r.price)}</b>${mode==="both"&&r.stops!==0?`<span class="small muted num">${r.direct&&r.direct.price!=null?"direct "+eur(r.direct.price):"no direct"}</span>`:""}${r.level?`<span class="lvl ${esc(r.level)}">${esc(r.level)}</span>`:""}
        <span class="row" style="gap:8px;justify-content:flex-end">${r.url?`<a class="small" href="${esc(r.url)}" target="_blank" rel="noopener">Google Flights</a>`:""}${isCur?`<span class="small muted">your dates</span>`:r.price!=null?`<button class="linkbtn small" data-usefare="${t.id}|${r.depart}">Use</button>`:""}</span></div></li>`;}).join("")}</ul></details>
    <div class="spread" style="margin-top:6px"><span class="small muted">Checked ${ago(f.checkedAt)}${fares.left!=null?` · ${fares.left} searches left this month`:""}</span>${btn("Check again")}</div></div>`;
}
async function api(method,body){
  const token=await idToken();
  const r=await fetch("/api/fares",{method,headers:{authorization:"Bearer "+token,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({error:"Flight search isn't available (HTTP "+r.status+")."}));
  if(!r.ok) throw new Error(j.error||"HTTP "+r.status);
  return j;
}
async function refreshLeft(){
  if(fares.loading) return; fares.loading=true;
  try{const a=await api("GET");fares.left=a.searchesLeft;}catch(e){fares.left=null;}
  fares.loading=false; bus.render();
}
async function checkPrices(id){
  const t=S.trips.find(x=>x.id===id); if(!t||UI.fareRun) return;
  const cands=candidateDates(t); const p=prefs(t); const total=cands.length*searchesPer(t);
  const exclude=p.avoidME?ME_HUBS:[];
  try{const a=await api("GET");fares.left=a.searchesLeft;}catch(e){toast(e.message);return;}
  if(fares.left!=null&&fares.left<total){toast(fares.left===1?"Only 1 search left this month":`Only ${fares.left} searches left this month`);bus.render();return;}
  UI.fareRun={id,done:0,total}; bus.render();
  const base={from:t.airports.from,to:t.airports.to};
  const step=async body=>{const r=await api("POST",{...base,...body});UI.fareRun.done++;bus.render();return r;};
  const results=[]; let err=null;
  for(const c of cands){
    const dates={depart:c.depart,return:c.return};
    try{
      if(p.stops==="direct") results.push({...c,...await step({...dates,stops:"direct"})});
      else{
        const any=await step({...dates,stops:"any",excludeConns:exclude});
        const row={...c,...any};
        if(p.stops==="both"){
          if(any.price!=null&&any.stops===0){row.direct={price:any.price,airline:any.airline,url:any.url};UI.fareRun.total--;bus.render();}
          else{const d=await step({...dates,stops:"direct"});row.direct=d.price!=null?{price:d.price,airline:d.airline,url:d.url}:null;}
        }
        results.push(row);
      }
    }catch(e){err=e;break;}
  }
  try{if(results.length) await saveFares(id,{checkedAt:new Date().toISOString(),key:fareKey(t),mode:p.stops,avoidME:p.avoidME,results});}catch(e){err=err||e;}
  UI.fareRun=null; UI.openFares.add(id);
  if(err) toast(err.message||"Price check failed"); else toast("Prices updated");
  refreshLeft();
}
function legend(){
  return `<div class="legend small">${[["vacation","Vacation"],["yearEnd","Year-end"],["wfi","WFI"],["intrip","Trip, no leave"],["hol","Holiday"]].map(([k,l])=>`<span><i class="cd ${k}"></i>${l}</span>`).join("")}</div>`;
}
function monthGrid(y,m,map){
  const first=`${y}-${String(m+1).padStart(2,"0")}-01`;
  const lead=(parseYmd(first).getDay()+6)%7; const t=todayStr();
  let cells=Array.from({length:lead},()=>`<span></span>`).join("");
  for(let d=first;d.slice(5,7)===first.slice(5,7);d=addDays(d,1)){
    const e=map.get(d); const hol=holidayName(d);
    const cls=[isWeekend(d)?"we":"",hol?"hol":"",e?(e.type||"intrip"):"",d===t?"now":""].join(" ");
    const tip=[hol,e&&e.trip.title,e&&e.type&&BLOCK_TYPES[e.type]].filter(Boolean).join(" · ");
    cells+=`<span class="cd ${cls}"${tip?` title="${esc(tip)}"`:""}>${Number(d.slice(8))}</span>`;
  }
  return `<div class="month"><div class="mname">${parseYmd(first).toLocaleDateString(undefined,{month:"long"})}</div><div class="mgrid">${["M","T","W","T","F","S","S"].map(x=>`<span class="wd">${x}</span>`).join("")}${cells}</div></div>`;
}
function bridgeList(y){
  const list=bridges(y);
  if(!list.length) return `<p class="small muted">None this year.</p>`;
  return `<p class="small muted" style="margin:8px 0">Days off in a row, and how many vacation days each costs.</p><ul class="list small">${list.map(b=>`<li><span>${short(b.start)} to ${short(b.end)}</span><span class="num"><b>${b.days} days</b> <span class="muted">for ${b.cost===0?"free":plural(b.cost,"day")}</span></span></li>`).join("")}</ul>`;
}
function budgetForm(y){
  const b=budgetFor(S.leave,y);
  const f=(k,l)=>`<label class="small"><span class="label">${l}</span><input class="field num" type="number" min="0" max="60" inputmode="numeric" id="bud-${k}" value="${b[k]}"></label>`;
  return `<div class="grid3" style="margin-top:8px">${f("vacation","Vacation")}${f("yearEnd","Of which year-end")}${f("wfi","Work from India")}</div>
    <button class="btn sm" style="margin-top:8px" data-savebudget="${y}">Save budget</button>`;
}

/* ---------- Trip editor ---------- */
const blank=()=>({title:"",kind:"rome",status:"idea",depart:"",return:"",blocks:[],flights:{stops:"any",avoidME:true},flex:{departFrom:"",departTo:"",nights:""},airports:structuredClone(DEFAULT_AIRPORTS.rome),note:""});
function renderEditor(){
  const t=UI.editTrip; const isNew=!t.id; const a=t.airports||{from:[],to:[]}; const f=t.flex||{};
  const c=tripCounts(t,null);
  const others=S.trips.filter(x=>x.id!==t.id);
  const y=Number((t.depart||String(UI.travelYear)).slice(0,4));
  const after=balances([...others,{...t,status:t.status==="idea"?"planned":t.status}],S.leave,y);
  const p=problems([...others,t],S.leave,y).filter(x=>x.startsWith((t.title||"Untitled")+":")||x.includes(t.title||"Untitled"));
  const blockRow=(b,i)=>{const n=blockDays(b).length; const jan=b.start&&b.start.slice(5,7)==="01";
    return `<div class="lblock ${b.type}"><div class="brow">
      <select data-f="blocks.${i}.type" aria-label="Block type">${Object.entries(BLOCK_TYPES).map(([k,l])=>`<option value="${k}"${b.type===k?" selected":""}>${l}</option>`).join("")}</select>
      <button class="btn sm ghost" data-rmblock="${i}" aria-label="Remove block">✕</button></div>
      <div class="grid2"><input class="field" type="date" data-f="blocks.${i}.start" value="${esc(b.start)}" aria-label="Block start"><input class="field" type="date" data-f="blocks.${i}.end" value="${esc(b.end)}" aria-label="Block end"></div>
      <div class="small muted">${plural(n,"workday")} charged${jan?` · <label><input type="checkbox" data-f="blocks.${i}.carry"${b.carry?" checked":""}> carried over from ${Number(b.start.slice(0,4))-1}</label>`:""}</div></div>`;};
  return `<div class="stack"><button class="linkbtn" data-tback>← ${t.id?"Trip":"Travel"}</button>
    <h1>${isNew?"New trip":"Edit trip"}</h1>
    <div class="card stack">
      <label><span class="label">Name</span><input class="field" data-f="title" value="${esc(t.title)}" placeholder="e.g. Rome, Easter weekend"></label>
      <div class="grid2"><label><span class="label">Where</span><select class="field" data-f="kind">${Object.entries(KINDS).map(([k,l])=>`<option value="${k}"${t.kind===k?" selected":""}>${l}</option>`).join("")}</select></label>
        <label><span class="label">Status</span><select class="field" data-f="status">${Object.entries(STATUS).map(([k,l])=>`<option value="${k}"${t.status===k?" selected":""}>${l}</option>`).join("")}</select></label></div>
      <div class="grid2"><label><span class="label">Depart</span><input class="field" type="date" data-f="depart" value="${esc(t.depart)}"></label>
        <label><span class="label">Return</span><input class="field" type="date" data-f="return" value="${esc(t.return)}"></label></div>
      ${t.status==="idea"?`<p class="small muted" style="margin:0">Ideas don't count against your balance until you mark them planned.</p>`:""}
    </div>
    <div class="card stack"><div class="spread"><div class="label">Leave charged</div><span class="small"><b>${countText(c)}</b></span></div>
      ${t.blocks.map(blockRow).join("")||`<p class="small muted" style="margin:0">No leave blocks. Weekends and holidays inside the trip are free; add a block for the workdays you'll be away.</p>`}
      <div class="row">${t.depart&&t.return&&!t.blocks.length?`<button class="btn sm primary" data-autoblock>Charge trip workdays as vacation</button>`:""}<button class="btn sm" data-addblock>+ Add block</button></div>
      <p class="small muted" style="margin:0">With this trip, ${y} leaves you ${after.flexible.left} vacation, ${after.yearEnd.left} year-end and ${after.wfi.left} WFI days.</p>
    </div>
    <div class="card stack"><div class="label">Flights</div>
      <div class="grid2"><label><span class="label">From airports</span><input class="field" data-f="airports.from" value="${esc((a.from||[]).join(", "))}" placeholder="MUC, NUE"></label>
        <label><span class="label">To airports</span><input class="field" data-f="airports.to" value="${esc((a.to||[]).join(", "))}" placeholder="FCO, CIA"></label></div>
      <div class="grid2"><label><span class="label">Earliest departure</span><input class="field" type="date" data-f="flex.departFrom" value="${esc(f.departFrom)}"></label>
        <label><span class="label">Latest departure</span><input class="field" type="date" data-f="flex.departTo" value="${esc(f.departTo)}"></label></div>
      <div class="grid2"><label><span class="label">Nights</span><input class="field num" type="number" min="1" inputmode="numeric" data-f="flex.nights" value="${esc(f.nights)}"></label></div>
      <div class="grid2"><label><span class="label">Stops</span><select class="field" data-f="flights.stops">${Object.entries(STOP_LABEL).map(([k,l])=>`<option value="${k}"${prefs(t).stops===k?" selected":""}>${l}</option>`).join("")}</select></label>
        <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" data-f="flights.avoidME"${prefs(t).avoidME?" checked":""}><span class="small"><b>Avoid Middle East layovers</b></span></label></div>
      <p class="small muted" style="margin:0">Searches departures in this window and suggests cheaper dates. ${prefs(t).stops==="both"?"Compare uses up to 2 searches per date. ":""}Avoiding layovers skips connections in the Gulf, Iran, Iraq, the Levant and Egypt; a flight can still pass over the region.</p>
    </div>
    <div class="card"><label><span class="label">Note</span><textarea rows="2" data-f="note">${esc(t.note)}</textarea></label></div>
    ${p.length?`<div class="card warn"><ul class="small" style="margin:0;padding-left:18px">${p.map(x=>`<li>${esc(x.replace(/^[^:]*:\s*/,""))}</li>`).join("")}</ul></div>`:""}
    <button class="btn primary block" data-savetrip>${isNew?"Add trip":"Save trip"}</button>
    ${isNew?"":UI.confirm==="deltrip"?`<div class="row"><span class="small">Delete this trip?</span><button class="btn sm" data-deltrip>Delete</button><button class="btn sm" data-cancelconfirm>Keep</button></div>`:`<button class="linkbtn small" style="color:var(--muted)" data-askdeltrip>Delete trip</button>`}
  </div>`;
}
const codes=v=>String(v).toUpperCase().split(/[^A-Z]+/).filter(x=>/^[A-Z]{3}$/.test(x));
function setField(t,path,value){
  const k=path.split("."); let o=t;
  for(let i=0;i<k.length-1;i++){o[k[i]]=o[k[i]]??{};o=o[k[i]];}
  const last=k[k.length-1];
  if(path.startsWith("airports.")) o[last]=codes(value);
  else if(path==="flex.nights") o[last]=value===""?"":Number(value);
  else o[last]=value;
}
function onTripChange(t,path,prevKind){
  if(path==="kind"){const old=DEFAULT_AIRPORTS[prevKind]; const a=t.airports||{};
    if(!old||(JSON.stringify(a.from)===JSON.stringify(old.from)&&JSON.stringify(a.to)===JSON.stringify(old.to))||(!(a.from||[]).length&&!(a.to||[]).length)) t.airports=structuredClone(DEFAULT_AIRPORTS[t.kind]);}
  if((path==="depart"||path==="return")&&t.depart&&t.return&&t.depart<=t.return){
    const f=t.flex=t.flex||{};
    if(!f.departFrom) f.departFrom=addDays(t.depart,-7);
    if(!f.departTo) f.departTo=addDays(t.depart,7);
    if(!f.nights) f.nights=daysBetween(t.depart,t.return);
  }
  if(/^blocks\.\d+\.start$/.test(path)){const b=t.blocks[Number(path.split(".")[1])]; if(b.start&&(!b.end||b.end<b.start)) b.end=b.start; if(b.start.slice(5,7)!=="01") delete b.carry;}
}

export function bindTravel(app){
  const render=()=>bus.render();
  app.querySelectorAll("[data-gotravel]").forEach(b=>b.onclick=()=>{UI.tab="travel";UI.editTrip=null;UI.openTrip=null;ls.set("ppl_tab","travel");render();window.scrollTo(0,0)});
  app.querySelectorAll("[data-opentrip]").forEach(b=>b.onclick=()=>{UI.tab="travel";UI.editTrip=null;UI.openTrip=b.dataset.opentrip;UI.confirm=null;ls.set("ppl_tab","travel");render();window.scrollTo(0,0)});
  app.querySelectorAll("[data-closetrip]").forEach(b=>b.onclick=()=>{UI.openTrip=null;render();window.scrollTo(0,0)});
  app.querySelectorAll("[data-cal]").forEach(d=>d.ontoggle=()=>{if(d.isConnected)UI.calOpen=d.open});
  const setStatus=async(id,status,msg)=>{const t=S.trips.find(x=>x.id===id);if(!t)return;await guard(saveTrip({...t,status}));toast(msg)};
  app.querySelectorAll("[data-markbooked]").forEach(b=>b.onclick=()=>setStatus(b.dataset.markbooked,"booked","Marked as booked"));
  app.querySelectorAll("[data-unbook]").forEach(b=>b.onclick=()=>setStatus(b.dataset.unbook,"planned","Back to planned"));
  app.querySelectorAll("[data-year]").forEach(b=>b.onclick=()=>{UI.travelYear=Number(b.dataset.year);ls.set("cad_year",UI.travelYear);render()});
  app.querySelectorAll("[data-seed]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await guard(seedTrips(draftPlan2027().map(t=>({...t,blocks:t.blocks.map(x=>({...x}))})),2027,S.leave["2027"]?null:{...DEFAULT_BUDGET}));toast("2027 plan loaded")}catch(e){b.disabled=false}});
  app.querySelectorAll("[data-newtrip]").forEach(b=>b.onclick=()=>{UI.editTrip=blank();UI.confirm=null;render();window.scrollTo(0,0)});
  app.querySelectorAll("[data-edittrip]").forEach(b=>b.onclick=()=>{const t=S.trips.find(x=>x.id===b.dataset.edittrip);if(!t)return;
    UI.editTrip={...blank(),...structuredClone(t)};UI.confirm=null;render();window.scrollTo(0,0)});
  app.querySelectorAll("[data-savebudget]").forEach(b=>b.onclick=async()=>{const y=b.dataset.savebudget;const v=k=>Math.max(0,Number($("#bud-"+k).value)||0);
    const bud={vacation:v("vacation"),yearEnd:v("yearEnd"),wfi:v("wfi")};
    if(bud.yearEnd>bud.vacation){toast("Year-end can't exceed vacation");return;}
    await guard(saveLeave(y,bud));toast("Budget saved")});
  app.querySelectorAll("[data-checkfares]").forEach(b=>b.onclick=()=>checkPrices(b.dataset.checkfares));
  app.querySelectorAll("[data-farelist]").forEach(d=>d.ontoggle=()=>{if(!d.isConnected)return;d.open?UI.openFares.add(d.dataset.farelist):UI.openFares.delete(d.dataset.farelist)});
  app.querySelectorAll("[data-usefare]").forEach(b=>b.onclick=async()=>{const [id,dep]=b.dataset.usefare.split("|");const t=S.trips.find(x=>x.id===id);if(!t)return;
    const moved=shiftTrip(t,daysBetween(t.depart,dep));
    await guard(saveTrip(moved));toast(`Moved to ${short(moved.depart)} to ${short(moved.return)}`)});
  if(UI.tab==="travel"&&UI.openTrip&&!UI.editTrip&&fares.left===undefined&&Object.keys(S.fares).length) refreshLeft();
  // editor
  const t=UI.editTrip; if(!t) return;
  app.querySelectorAll("[data-tback]").forEach(b=>b.onclick=()=>{UI.editTrip=null;UI.confirm=null;render();window.scrollTo(0,0)});
  app.querySelectorAll("[data-f]").forEach(el=>{
    const path=el.dataset.f;
    const read=()=>el.type==="checkbox"?el.checked:el.value;
    if(el.tagName==="TEXTAREA"||(el.tagName==="INPUT"&&el.type==="text")||(el.tagName==="INPUT"&&!el.type)) el.oninput=()=>setField(t,path,read());
    el.onchange=()=>{const prev=t.kind;setField(t,path,read());onTripChange(t,path,prev);
      if(el.tagName==="SELECT"||el.type==="date"||el.type==="checkbox"||el.type==="number") render();};
  });
  app.querySelectorAll("[data-addblock]").forEach(b=>b.onclick=()=>{const last=t.blocks[t.blocks.length-1];
    const start=last&&last.end?addDays(last.end,1):(t.depart||"");
    t.blocks.push({type:t.kind==="india"&&last?"wfi":"vacation",start,end:t.return&&start&&start<=t.return?t.return:start});render()});
  app.querySelectorAll("[data-autoblock]").forEach(b=>b.onclick=()=>{t.blocks=[{type:"vacation",start:t.depart,end:t.return}];render()});
  app.querySelectorAll("[data-rmblock]").forEach(b=>b.onclick=()=>{t.blocks.splice(Number(b.dataset.rmblock),1);render()});
  app.querySelectorAll("[data-askdeltrip]").forEach(b=>b.onclick=()=>{UI.confirm="deltrip";render()});
  app.querySelectorAll("[data-cancelconfirm]").forEach(b=>b.onclick=()=>{UI.confirm=null;render()});
  app.querySelectorAll("[data-deltrip]").forEach(b=>b.onclick=async()=>{await guard(removeTrip(t.id));UI.editTrip=null;UI.openTrip=null;UI.confirm=null;render();toast("Trip deleted")});
  app.querySelectorAll("[data-savetrip]").forEach(b=>b.onclick=async()=>{
    if(!t.title.trim()){toast("Give the trip a name");return;}
    if(!t.depart||!t.return||t.depart>t.return){toast("Check the travel dates");return;}
    if(t.blocks.some(x=>!x.start||!x.end||x.start>x.end)){toast("Check the leave block dates");return;}
    b.disabled=true;
    try{await guard(saveTrip({...t,title:t.title.trim()}));UI.travelYear=Number(t.depart.slice(0,4));UI.editTrip=null;render();window.scrollTo(0,0);toast("Trip saved")}catch(e){b.disabled=false}
  });
}
