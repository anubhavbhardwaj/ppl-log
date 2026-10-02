/* Travel tab: leave balances, trips, year calendar, holidays and bridges, trip editor. */
import {$,esc,todayStr,addDays,daysBetween,fmtDate,eachDay,parseYmd,ls,toast,guard,UI,bus} from "./util.js";
import {S,saveTrip,removeTrip,saveLeave,seedTrips,saveFares,idToken} from "./store.js";
import {holidays,holidayName,isWorkday,isWeekend,budgetFor,DEFAULT_BUDGET,BLOCK_TYPES,KINDS,DEFAULT_AIRPORTS,blockDays,tripCounts,balances,tripInYear,tripOn,dayMap,problems,bridges,draftPlan2027,candidateDates,shiftTrip} from "./leave.js";

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
  if(!next) return "";
  const n=daysBetween(t,next.depart);
  return `<button class="card tripline" data-gotravel><span class="plate ${KIND_PLATE[next.kind]||"home"}"></span><span><span class="label">Next trip · ${n===1?"tomorrow":"in "+n+" days"}</span><br><b>${esc(next.title)}</b> <span class="small muted">· ${short(next.depart)} to ${short(next.return)}</span></span></button>`;
}

/* ---------- Travel tab ---------- */
export function renderTravel(){
  if(UI.editTrip) return renderEditor();
  const y=UI.travelYear;
  const trips=S.trips.filter(t=>tripInYear(t,y));
  const bal=balances(S.trips,S.leave,y);
  const probs=problems(S.trips,S.leave,y);
  const tile=(label,b,note)=>{const pct=b.total?Math.min(100,Math.max(0,b.used/b.total*100)):0;
    return `<div class="tile"><div class="label">${label}</div><div class="big num ${b.left<0?"bad":""}">${b.left}</div><div class="small muted">left of ${b.total}</div><div class="meter"><span style="width:${pct}%"></span></div>${note?`<div class="small muted" style="margin-top:4px">${note}</div>`:""}</div>`;};
  const ideaDays=bal.ideas.vacation+bal.ideas.yearEnd+bal.ideas.wfi;
  return `<div class="stack">
    <div class="spread"><h1>Travel</h1><div class="row yearpick"><button class="btn sm ghost" data-year="${y-1}" aria-label="Previous year">‹</button><b class="num">${y}</b><button class="btn sm ghost" data-year="${y+1}" aria-label="Next year">›</button></div></div>
    <div class="tiles">${tile("Vacation",bal.flexible,`${bal.budget.yearEnd} more held for year-end`)}${tile("Year-end",bal.yearEnd)}${tile("WFI",bal.wfi,bal.wfi.left>0?"Use them all":"")}</div>
    ${ideaDays?`<p class="small muted" style="margin:-4px 0 0">Ideas not yet counted: ${countText(bal.ideas)}.</p>`:""}
    ${bal.flexible.left>0?`<p class="small muted" style="margin:-4px 0 0">Unused vacation only carries into ${y+1} as an extension of the year-end block. Add it as a block in early January marked "carried over".</p>`:""}
    ${probs.length?`<div class="card warn"><div class="label">Check these</div><ul class="small" style="margin:6px 0 0;padding-left:18px">${probs.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div>`:""}
    ${!trips.length?`<div class="card"><h3>No trips in ${y} yet</h3>${y===2027?`<p class="small muted">Load the plan we worked out: two Rome weekends in Jan and Feb, India in late May (2 weeks vacation + 1 week WFI) and India in December (10 WFI days + 6 year-end days).</p><button class="btn primary block" data-seed>Load my 2027 plan</button>`:`<p class="small muted">Add a trip to start counting leave for ${y}.</p>`}</div>`:""}
    ${trips.map(tripCard).join("")}
    <button class="btn block" data-newtrip>+ Add trip</button>
    <div class="card"><div class="spread"><div class="label">${y} at a glance</div></div>${legend()}<div class="months">${(()=>{const map=dayMap(S.trips);return Array.from({length:12},(_,m)=>monthGrid(y,m,map)).join("")})()}</div></div>
    <details class="card"><summary>Long weekends and bridges in ${y}</summary>${bridgeList(y)}</details>
    <details class="card"><summary>Public holidays in ${y} (Bavaria, Munich)</summary><ul class="list small" style="margin-top:8px">${[...holidays(y)].map(([d,n])=>`<li><span>${esc(n)}</span><span class="muted ${isWeekend(d)?"strike":""}">${fmtDate(d)}${isWeekend(d)?" · weekend":""}</span></li>`).join("")}</ul></details>
    <details class="card"><summary>Leave budget for ${y}</summary>${budgetForm(y)}</details>
  </div>`;
}
function tripCard(t){
  const c=tripCounts(t,UI.travelYear); const a=t.airports||{}; const f=t.flex||{};
  const nights=t.depart&&t.return?daysBetween(t.depart,t.return):null;
  return `<div class="card trip"><div class="spread"><span class="tag"><span class="plate ${KIND_PLATE[t.kind]||"home"}"></span>${esc(t.title)}</span><span class="badge ${t.status}">${STATUS[t.status]||""}</span></div>
    <p class="small" style="margin:6px 0 0">${t.depart?fmtDate(t.depart):"?"} to ${t.return?fmtDate(t.return):"?"}${nights!=null?` · ${plural(nights,"night")}`:""}</p>
    <div class="chips">${["vacation","yearEnd","wfi"].filter(k=>c[k]).map(k=>`<span class="chip ${k}">${c[k]} ${k==="wfi"?"WFI":BLOCK_TYPES[k].toLowerCase()}</span>`).join("")||`<span class="chip">No leave days</span>`}</div>
    ${(a.from||[]).length||(a.to||[]).length?`<p class="small muted" style="margin:6px 0 0">Flights ${esc((a.from||[]).join("/"))} → ${esc((a.to||[]).join("/")||"?")}${f.departFrom&&f.departTo?` · depart ${short(f.departFrom)} to ${short(f.departTo)}`:""}</p>`:""}
    ${t.note?`<p class="small muted" style="margin:4px 0 0">${esc(t.note)}</p>`:""}
    ${fareSection(t)}
    <button class="linkbtn small" style="margin-top:6px" data-edittrip="${t.id}">Edit</button></div>`;
}

/* ---------- Flight prices ---------- */
const eur=n=>"€"+Math.round(n).toLocaleString();
const fareKey=t=>`${(t.airports?.from||[]).join(",")}>${(t.airports?.to||[]).join(",")}|${t.depart&&t.return?daysBetween(t.depart,t.return):""}`;
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
  const n=candidateDates(t).length;
  const run=UI.fareRun&&UI.fareRun.id===t.id?UI.fareRun:null;
  if(run) return `<div class="fares"><div class="label">Checking prices · ${run.done} of ${run.total}</div><div class="meter"><span style="width:${run.done/run.total*100}%"></span></div></div>`;
  const f=S.fares[t.id];
  const btn=label=>`<button class="btn sm" data-checkfares="${t.id}"${UI.fareRun?" disabled":""}>${label} · ${(n===1?"1 search":n+" searches")}</button>`;
  if(!f||!(f.results||[]).length) return `<div class="fares">${btn("Check flight prices")}</div>`;
  const rows=[...f.results].sort((x,y)=>x.depart.localeCompare(y.depart));
  const priced=rows.filter(r=>r.price!=null);
  const best=priced.reduce((x,y)=>!x||y.price<x.price?y:x,null);
  const cur=rows.find(r=>r.depart===t.depart);
  let head="No prices found for these dates.";
  if(best){
    head=`Cheapest <b>${eur(best.price)}</b> · ${short(best.depart)} to ${short(best.return)}`;
    if(best.depart===t.depart) head+=` · your dates`;
    else if(cur&&cur.price!=null) head+=` · <span class="save">${eur(cur.price-best.price)} less than your dates</span>`;
  }
  return `<div class="fares"><p class="small" style="margin:0">${head}</p>
    ${f.key!==fareKey(t)?`<p class="small" style="margin:4px 0 0;color:var(--warn)">Airports or trip length changed since this check.</p>`:""}
    <details${UI.openFares.has(t.id)?" open":""} data-farelist="${t.id}"><summary>${plural(rows.length,"date")} checked</summary>
    <ul class="list fare-list">${rows.map(r=>{const isCur=r.depart===t.depart;const delta=daysBetween(t.depart,r.depart);
      return `<li class="${best&&r===best?"best":""}"><div><b>${short(r.depart)} to ${short(r.return)}</b><br><span class="small muted">${r.price==null?"no flights found":[r.fromAirport&&r.toAirport?`${r.fromAirport} → ${r.toAirport}`:"",r.airline,r.stops===0?"direct":r.stops!=null?plural(r.stops,"stop"):""].filter(Boolean).map(esc).join(" · ")}</span>${isCur?"":`<br><span class="small ldelta">${leaveDelta(t,delta)}</span>`}</div>
        <div class="fare-r"><b class="num">${r.price==null?"–":eur(r.price)}</b>${r.level?`<span class="lvl ${esc(r.level)}">${esc(r.level)}</span>`:""}
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
  const cands=candidateDates(t);
  try{const a=await api("GET");fares.left=a.searchesLeft;}catch(e){toast(e.message);return;}
  if(fares.left!=null&&fares.left<cands.length){toast(fares.left===1?"Only 1 search left this month":`Only ${fares.left} searches left this month`);bus.render();return;}
  UI.fareRun={id,done:0,total:cands.length}; bus.render();
  const results=[]; let err=null;
  for(const c of cands){
    try{results.push({...c,...await api("POST",{from:t.airports.from,to:t.airports.to,depart:c.depart,return:c.return})});}
    catch(e){err=e;break;}
    UI.fareRun.done++; bus.render();
  }
  try{if(results.length) await saveFares(id,{checkedAt:new Date().toISOString(),key:fareKey(t),results});}catch(e){err=err||e;}
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
const blank=()=>({title:"",kind:"rome",status:"idea",depart:"",return:"",blocks:[],flex:{departFrom:"",departTo:"",nights:""},airports:structuredClone(DEFAULT_AIRPORTS.rome),note:""});
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
  return `<div class="stack"><button class="linkbtn" data-tback>← Travel</button>
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
      <p class="small muted" style="margin:0">The flight watcher will search departures in this window and suggest cheaper dates.</p>
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
  app.querySelectorAll("[data-gotravel]").forEach(b=>b.onclick=()=>{UI.tab="travel";UI.editTrip=null;ls.set("ppl_tab","travel");render();window.scrollTo(0,0)});
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
  if(UI.tab==="travel"&&!UI.editTrip&&fares.left===undefined&&Object.keys(S.fares).length) refreshLeft();
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
  app.querySelectorAll("[data-deltrip]").forEach(b=>b.onclick=async()=>{await guard(removeTrip(t.id));UI.editTrip=null;UI.confirm=null;render();toast("Trip deleted")});
  app.querySelectorAll("[data-savetrip]").forEach(b=>b.onclick=async()=>{
    if(!t.title.trim()){toast("Give the trip a name");return;}
    if(!t.depart||!t.return||t.depart>t.return){toast("Check the travel dates");return;}
    if(t.blocks.some(x=>!x.start||!x.end||x.start>x.end)){toast("Check the leave block dates");return;}
    b.disabled=true;
    try{await guard(saveTrip({...t,title:t.title.trim()}));UI.travelYear=Number(t.depart.slice(0,4));UI.editTrip=null;render();window.scrollTo(0,0);toast("Trip saved")}catch(e){b.disabled=false}
  });
}
