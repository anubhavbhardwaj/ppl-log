/* Gym module: Jeff Nippard Ultimate PPL (6x sheet, phases 1-3), office-day plans, workout logging. */
import {$,esc,pad,ymd,todayStr,WD,ls,toast,guard,UI,bus,parseYmd} from "./util.js";
import {S,DEFAULT_NEXT,saveState,addLog,removeLog,setLog} from "./store.js";
import {PROGRAM} from "./program.js";

/* ---------- Program: Jeff Nippard Ultimate PPL 6x, Phases 1-3 (13 weeks, 78 sessions) ----------
   Data comes from js/program.js, generated from the spreadsheet with tools/extract_program.py. */
export const DAYS=[
 {id:"push1",name:"Push #1",kind:"push"},{id:"pull1",name:"Pull #1",kind:"pull"},{id:"legs1",name:"Legs #1",kind:"legs"},
 {id:"push2",name:"Push #2",kind:"push"},{id:"pull2",name:"Pull #2",kind:"pull"},{id:"legs2",name:"Legs #2",kind:"legs"}];
const FLAT=[];
PROGRAM.phases.forEach(p=>p.weeks.forEach(w=>w.days.forEach(d=>FLAT.push({phase:p.n,phaseName:p.name,week:w.n,deload:!!w.note,note:w.note,dayId:d.id,ex:d.ex}))));
export const TOTAL=FLAT.length;
export const seqInfo=i=>{const f=FLAT[Math.max(0,Math.min(i,TOTAL-1))];return {seq:i,phase:f.phase,phaseName:f.phaseName,week:f.week,deload:f.deload,note:f.note,day:DAYS.find(d=>d.id===f.dayId)};};
// Each exercise: main movement plus the sheet's two substitutions, each with its own video.
export function exercisesFor(seq){
  return FLAT[seq].ex.map(e=>({n:e.n,v:e.v,wu:e.wu,s:Number(e.s)||1,r:e.r,rpe:e.rpe,rest:e.rest,note:e.note,opts:[{n:e.n,v:e.v},...(e.subs||[])]}));
}
const wk=n=>`P${n.phase} W${n.week}`;
const wkLong=n=>`Phase ${n.phase} · Week ${n.week}${n.deload?" · deload":""}`;

/* ---------- Off-day plans (Tue/Wed/Thu) ---------- */
export const yt=q=>"https://www.youtube.com/results?search_query="+encodeURIComponent(q);
export const OFF={
 run:{title:"Easy run",mins:"30-40 min",why:"Recovery after four gym days. Keep it conversational: you should be able to talk in full sentences.",items:[
  ["5 min brisk walk to warm up","",yt("dynamic warm up before running")],
  ["30-40 min easy run (zone 2)","Nasal breathing pace. Slow down on hills rather than push.",yt("zone 2 running explained")],
  ["5 min walk + calf and hip flexor stretch","",yt("post run stretch routine 5 minutes")]]},
 shortrun:{title:"Short easy run",mins:"20-30 min",why:"Friday is a push or pull day, so a light run is fine.",items:[
  ["20-30 min easy run (zone 2)","Conversational pace only.",yt("zone 2 running explained")],
  ["10 min mobility","90/90 hip switches, open books, couch stretch.",yt("10 minute mobility routine hips thoracic")]]},
 mobility:{title:"Mobility and walk",mins:"20-40 min",why:"Friday is a legs day. Keep your legs fresh: no run today.",items:[
  ["90/90 hip switches, 2 x 10","",yt("90 90 hip switch tutorial")],
  ["Thoracic open book, 2 x 8 per side","",yt("open book thoracic rotation stretch")],
  ["Couch stretch, 2 x 45s per side","",yt("couch stretch hip flexor how to")],
  ["Ankle knee-to-wall, 2 x 10 per side","",yt("knee to wall ankle mobility drill")],
  ["Optional 20-30 min walk","",""]]},
 home:{title:"Home session",mins:"25 min",why:"Adds back some of the volume you lose by training 4 days. Stop each set 1-2 reps before failure so Friday isn't affected.",items:[
  ["Push-ups, 3 sets, 2 reps short of failure","Elevate hands if needed, add a deficit if easy.",yt("Jeff Nippard push up form")],
  ["Backpack or band row, 3 x 12-15","Loaded backpack, resistance band or a sturdy table edge (inverted row).",yt("backpack row home back workout")],
  ["Pike push-up, 2 x 8-10","",yt("pike push up tutorial")],
  ["Lateral raise, 2 x 15-20","Dumbbells, band or water bottles.",yt("band lateral raise form")],
  ["Curl, 2 x 12-15","Band, dumbbells or backpack.",yt("resistance band bicep curl form")],
  ["Dead bug, 2 x 10 per side","",yt("dead bug exercise proper form")],
  ["Side plank, 2 x 30s per side","",yt("side plank proper form")],
  ["Plank, 2 x 45s","",yt("plank proper form")]]},
 travel:{title:"Travel session",mins:"20-30 min",why:"You're away, so the PPL sequence waits for you. A short bodyweight circuit in the room, or just walk the city.",items:[
  ["Push-ups, 3 sets, 2 reps short of failure","Feet on the bed for a harder version.",yt("Jeff Nippard push up form")],
  ["Bulgarian split squat, 3 x 10-12 per leg","Rear foot on a chair or the bed.",yt("bodyweight bulgarian split squat form")],
  ["Towel or backpack row, 3 x 12-15","Loop a towel around a door handle, or row a loaded backpack.",yt("towel door row home back exercise")],
  ["Pike push-up, 2 x 8-10","",yt("pike push up tutorial")],
  ["Single-leg glute bridge, 2 x 12 per side","",yt("single leg glute bridge form")],
  ["Plank, 2 x 45s","",yt("plank proper form")],
  ["Or: 8-10k steps exploring","Counts as your session on a sightseeing day.",""]]}
};
// weekday: 0 Sun .. 6 Sat. Gym: Mon, Fri, Sat, Sun.
const GYM_DAYS=[0,1,5,6];
export const isGymDay=wd=>GYM_DAYS.includes(wd);
export function offPlanFor(wd,nextKind){
  if(wd===2) return "run";
  if(wd===3) return "home";
  if(wd===4) return nextKind==="legs"?"mobility":"shortrun";
  return null;
}

/* ---------- Helpers ---------- */
const cleanName=n=>n.replace(/^A\d\.\s*/,"").replace(/\s*\(.*?\)\s*/g," ").trim();
const videoFor=o=>o.v||yt("Jeff Nippard "+cleanName(o.n));
const restSeconds=r=>{const m=String(r).match(/(\d+)/);return m?Number(m[1])*(/sec/i.test(r)?1:60):0};
const topOfRange=r=>{const m=String(r).match(/^(\d+)\s*-\s*(\d+)$/);return m?Number(m[2]):(/^\d+$/.test(r)?Number(r):null)};
/* Sequencing: the next session is the first one at or after the pointer (state.next) that isn't logged yet.
   Logging a session out of order (e.g. Push #1 after Pull #1) is fine: logged sessions are skipped. */
const doneSeqs=()=>new Set(S.logs.filter(l=>l.type==="gym").map(l=>l.seq));
function nextSeq(){const done=doneSeqs();let s=S.state.next??DEFAULT_NEXT;while(s<TOTAL&&done.has(s))s++;return s;}
function queue(n){const done=doneSeqs();const out=[];for(let s=nextSeq();s<TOTAL&&out.length<n;s++) if(!done.has(s)) out.push(s);return out;}
const addDay=(ds,n)=>{const d=parseYmd(ds);d.setDate(d.getDate()+n);return ymd(d)};
// Plan for each day from today: done session, skipped day, trip, projected session, or an office-day activity.
// Skipping a gym day doesn't consume a session, so everything moves to the next gym day.
export function projection(days,tripOn){
  const q=queue(days); let i=0; const out=[]; const t=todayStr();
  for(let k=0;k<days;k++){
    const ds=addDay(t,k); const w=parseYmd(ds).getDay(); const L=logsOn(ds);
    const g=L.find(l=>l.type==="gym"), sk=L.find(l=>l.type==="skip"), h=L.find(l=>l.type==="home");
    if(g){out.push({date:ds,kind:"done",seq:g.seq});continue;}
    if(sk){out.push({date:ds,kind:"skip"});continue;}
    if(tripOn&&tripOn(ds)){out.push({date:ds,kind:"trip",home:h});continue;}
    if(isGymDay(w)&&i<q.length){out.push({date:ds,kind:"gym",seq:q[i++]});continue;}
    out.push({date:ds,kind:"off",home:h});
  }
  return out;
}
function nextGymDate(tripOn){return projection(15,tripOn).find(p=>p.kind==="gym"&&p.date>todayStr());}
function lastFor(name){
  for(const l of S.logs){ if(l.type!=="gym"||!l.exercises) continue;
    const e=l.exercises.find(x=>x.n===name && x.sets && x.sets.some(s=>s.kg||s.reps));
    if(e) return {date:l.date,e}; }
  return null;
}
const logsOn=date=>S.logs.filter(l=>l.date===date);
export function nextGymDayName(){const wd=new Date().getDay();for(let i=1;i<=7;i++){const w=(wd+i)%7;if(isGymDay(w))return i===1?"tomorrow":WD[w];}return "";}

/* ---------- Calorie estimate ----------
   kcal = MET x body weight (kg) x hours (the standard method for resistance training).
   MET comes from training density, kg lifted per minute: ~3.5 for light work up to 6 for heavy, dense sessions.
   Duration is Start to Finish; if that looks wrong (under 15 or over 150 min) it is rebuilt from the logged
   sets, the sheet's rest times and warm-up sets. Bodyweight moves (no kg logged) count 65% of body weight. */
const restMins=r=>{const m=String(r).match(/(\d+)(?:\s*-\s*(\d+))?/);if(!m)return 0;const mid=(Number(m[1])+Number(m[2]||m[1]))/2;return /sec/i.test(r)?mid/60:mid;};
export function sessionCalories(log,bw){
  if(!bw||log.type!=="gym"||!(log.exercises||[]).length) return null;
  const plan=exercisesFor(log.seq);
  let vol=0,sets=0,planned=0;
  log.exercises.forEach((e,i)=>{
    const done=(e.sets||[]).filter(x=>Number(x.reps)>0); if(!done.length) return;
    sets+=done.length;
    vol+=done.reduce((a,x)=>a+((Number(x.kg)||bw*0.65)*Number(x.reps)),0);
    const pe=plan[i]; planned+=done.length*(0.75+(pe?restMins(pe.rest):2))+(pe?(parseInt(pe.wu)||0)*1.5:0);
  });
  if(!sets) return null;
  let mins=planned, timed=false;
  if(log.started&&log.ts){const el=(new Date(log.ts)-new Date(log.started))/6e4;if(el>=15&&el<=150){mins=el;timed=true;}}
  const met=Math.max(3.5,Math.min(6,3.5+(vol/mins)/100));
  const kcal=met*bw*mins/60, r5=x=>Math.round(x/5)*5;
  return {kcal:r5(kcal),lo:r5(kcal*0.8),hi:r5(kcal*1.2),mins:Math.round(mins),vol:Math.round(vol),sets,met:Math.round(met*10)/10,timed};
}
const bodyweight=()=>Number(S.state.bodyweight)||0;
function kcalLine(log,showVol=true){
  const c=sessionCalories(log,bodyweight());
  if(!c) return "";
  return `<p class="small" style="margin:6px 0 0"><b class="num">≈ ${c.kcal} kcal</b> <span class="muted num">(${c.lo} to ${c.hi}) · ${c.mins} min${c.timed?"":" est."}${showVol?` · ${c.vol.toLocaleString()} kg lifted`:""}</span></p>`;
}
function bwForm(compact){
  return `<div class="${compact?"":"card"}" style="${compact?"margin-top:8px":""}"><label class="label" for="bw">Body weight for calorie estimates</label>
    <div class="row" style="margin-top:4px"><input id="bw" class="field num" style="max-width:110px;margin:0" type="number" inputmode="decimal" min="30" max="250" step="0.1" placeholder="kg" value="${bodyweight()||""}"><span class="small muted">kg</span><button class="btn sm" data-savebw>Save</button></div></div>`;
}

/* ---------- Today ---------- */
// tripOn(date) -> trip or null. On trip days the PPL sequence pauses and a travel session is suggested.
export function weekStrip(tripOn){
  const now=new Date(); const wd=now.getDay(); const monOffset=(wd+6)%7;
  const mon=new Date(now); mon.setDate(now.getDate()-monOffset);
  const proj=projection(7,tripOn);
  let html='<div class="week">';
  for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const ds=ymd(d);const w=d.getDay();
    const gym=isGymDay(w); const done=logsOn(ds);
    const g=done.find(l=>l.type==="gym"); const h=done.find(l=>l.type==="home"); const sk=done.find(l=>l.type==="skip");
    let k=gym?"Gym":(w===2?"Run":w===3?"Home":"Easy"); let kind="";
    if(tripOn&&tripOn(ds)) k="Trip";
    const pr=proj.find(p=>p.date===ds);
    if(pr&&pr.kind==="gym"){const n=seqInfo(pr.seq);k=n.day.name.replace(" #","");kind=n.day.kind;}
    if(sk){k="Skip";kind="";}
    if(g){k=DAYS.find(x=>x.id===g.day)?.name.replace(" #","")||k;kind=DAYS.find(x=>x.id===g.day)?.kind||"";}
    html+=`<div class="dayc ${ds===todayStr()?"today":""} ${kind}"><div class="d">${WD[w]}</div><div class="k">${esc(k)}</div><div class="tick">${(g||h)?"✓":""}</div></div>`;}
  return html+"</div>";
}
export function gymToday(trip,tripOn){
  const next=nextSeq(); const wd=new Date().getDay(); const t=todayStr();
  const doneToday=logsOn(t); const gymDone=doneToday.find(l=>l.type==="gym"); const homeDone=doneToday.find(l=>l.type==="home"); const skipped=doneToday.find(l=>l.type==="skip");
  const ng=nextGymDate(tripOn); const ngName=ng?(ng.date===addDay(t,1)?"tomorrow":fmtDay(ng.date)):"your next gym day";
  if(next>=TOTAL) return `<div class="card hero"><div class="label">Program complete</div><h2>All ${TOTAL} sessions done</h2><p class="muted">That's all three phases. The sheet suggests running back through Phase 1 Week 1 next.</p></div>`;
  const n=seqInfo(next);
  const sessionCard=(label,extra)=>`<div class="card hero ${n.day.kind}"><div class="label">${label}</div>
    <div class="spread" style="margin-top:4px"><h2>${n.day.name}</h2><span class="tag"><span class="plate ${n.day.kind}"></span>${wk(n)}${n.deload?" · deload":""}</span></div>
    <p class="muted small">${exercisesFor(next).length} exercises · ${esc(n.phaseName)} · session ${next+1} of ${TOTAL}</p>${extra}</div>`;
  const upNext=`<div class="card"><div class="label">Up next at the gym · ${ngName}</div>
      <div class="spread" style="margin-top:4px"><h3><span class="tag"><span class="plate ${n.day.kind}"></span>${n.day.name} · ${wk(n)}</span></h3>
      <button class="btn sm" data-start="${next}">Train today</button></div></div>`;
  if(gymDone){
    const g=seqInfo(gymDone.seq);
    return `<div class="card hero ${g.day.kind}"><div class="label">Done today</div><h2>${g.day.name} · ${wk(g)}</h2>${bodyweight()?kcalLine(gymDone):`<p class="small muted" style="margin:6px 0 0">Add your body weight to see calories burned.</p>${bwForm(true)}`}
      ${bodyweight()&&sessionCalories(gymDone,bodyweight())?`<details style="margin-top:6px"><summary>How this is estimated</summary><p class="small muted" style="margin:6px 0 0">Body weight × session time × intensity (MET ${sessionCalories(gymDone,bodyweight()).met}). Intensity rises with the kg you lift per minute, from about 3.5 for light work to 6 for heavy, dense sessions. Treat it as a rough range, not an exact number.</p></details>`:""}
      <p class="muted small" style="margin:6px 0 0">Nice work. Next gym day: ${ngName}.</p></div>`+sessionCard("Up next · "+ngName,`<button class="btn ghost sm" data-preview="${next}">Preview exercises</button>`)+comingUp(tripOn);
  }
  if(skipped) return `<div class="card hero"><div class="label">Skipped today</div><h2>Rest day</h2><p class="muted small">${n.day.name} · ${wk(n)} moves to ${ngName}, and the rest of the plan moves along with it.</p>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-unskip="${skipped.id}">Undo skip</button><button class="btn sm ghost" data-start="${next}">Train anyway</button></div></div>`+comingUp(tripOn);
  if(trip) return renderOff(OFF.travel,"travel",homeDone,"Away · "+esc(trip.title))+upNext;
  if(isGymDay(wd)){
    const draft=ls.get("ppl_draft");
    return sessionCard("Today at the gym",`<button class="btn primary block" data-start="${next}">${draft&&draft.seq===next?"Resume workout":"Start workout"}</button>
      <div class="row" style="margin-top:8px;justify-content:space-between"><button class="btn sm ghost" data-preview="${next}">Preview</button>${UI.confirm==="skip"?`<span class="row"><span class="small">Move ${n.day.name} to ${ngName}?</span><button class="btn sm primary" data-skip="${next}">Skip today</button><button class="btn sm" data-cancelconfirm>Keep</button></span>`:`<button class="btn sm" data-askskip>Skip today</button>`}</div>`)+comingUp(tripOn);
  }
  const key=offPlanFor(wd,n.day.kind);
  return renderOff(OFF[key],key,homeDone)+upNext+comingUp(tripOn);
}
const fmtDay=ds=>{const d=parseYmd(ds);return WD[d.getDay()]+" "+d.getDate()+" "+d.toLocaleDateString(undefined,{month:"short"});};
function comingUp(tripOn){
  const rows=projection(10,tripOn).filter(p=>p.date>todayStr()&&(p.kind==="gym"||p.kind==="trip"||p.kind==="skip")).slice(0,5);
  if(!rows.length) return "";
  return `<div class="card"><div class="label">Coming up</div><ul class="list small" style="margin-top:6px">${rows.map(p=>{
    if(p.kind==="gym"){const n=seqInfo(p.seq);return `<li><span>${fmtDay(p.date)}</span><span class="tag" style="font-size:14px"><span class="plate ${n.day.kind}"></span>${n.day.name} · ${wk(n)}</span></li>`;}
    return `<li><span>${fmtDay(p.date)}</span><span class="muted">${p.kind==="trip"?"Trip":"Skipped"}</span></li>`;}).join("")}</ul></div>`;
}
function renderOff(plan,key,done,label){
  return `<div class="card hero home"><div class="label">${label||"Office day"} · ${plan.mins}</div><h2>${plan.title}</h2>
    <p class="small muted">${plan.why}</p>
    <ul class="list" style="margin-top:8px">${plan.items.map((it,i)=>`<li><label class="check" for="off-${i}"><input type="checkbox" id="off-${i}"><span><b>${esc(it[0])}</b>${it[1]?`<br><span class="small muted">${esc(it[1])}</span>`:""}</span></label>${it[2]?`<a class="small" href="${it[2]}" target="_blank" rel="noopener">Video</a>`:""}</li>`).join("")}</ul>
    <details style="margin-top:10px"><summary>Swap for another option</summary><div class="row" style="margin-top:8px">${Object.keys(OFF).filter(k=>k!==key).map(k=>`<button class="btn sm" data-off="${k}">${OFF[k].title}</button>`).join("")}</div></details>
    <div style="margin-top:12px">${done?`<div class="hint up">Logged: ${esc(done.title)}${done.note?" · "+esc(done.note):""}</div>`:`<label class="label" for="off-note">Note (optional)</label><input id="off-note" class="field" placeholder="e.g. 5.2 km in 34 min" style="margin:4px 0 8px"><button class="btn primary block" data-offdone="${key}">Mark done</button>`}</div>
  </div>`;
}

/* ---------- Gym tab: plan, preview, history ---------- */
export function renderGym(){
  const seg=`<div class="seg" role="tablist" aria-label="Gym views">${[["plan","Plan"],["history","History"]].map(([k,l])=>`<button role="tab" data-gymview="${k}" aria-selected="${UI.gymView===k}">${l}</button>`).join("")}</div>`;
  if(UI.gymView==="plan"&&UI.preview!=null) return renderPreview(UI.preview);
  return `<div class="stack"><h1>Gym</h1>${seg}${UI.gymView==="history"?renderHistory():renderPlan()}</div>`;
}
function renderPlan(){
  const next=nextSeq(); const done=doneSeqs(); const cur=seqInfo(next);
  let g=`<div class="pgrid"><div></div>${DAYS.map(d=>`<div class="h">${d.name.replace(" #","")}</div>`).join("")}`;
  let seq=0;
  PROGRAM.phases.forEach(p=>{
    g+=`<div class="ph">Phase ${p.n} · ${esc(p.name)}</div>`;
    p.weeks.forEach(w=>{g+=`<div class="h" style="align-self:center;text-align:left">W${w.n}${w.note?"<br><span class='dl'>deload</span>":""}</div>`;
      DAYS.forEach(d=>{const s=seq++;g+=`<button class="cell ${done.has(s)?"done":""} ${s===next?"next":""}" data-preview="${s}" aria-label="${d.name} phase ${p.n} week ${w.n}"><span class="plate ${d.kind}"></span>${done.has(s)?"✓":s===next?"Next":""}</button>`;});});
  });
  g+="</div>";
  const pct=Math.round(done.size/TOTAL*100);
  const ph=PROGRAM.phases.find(p=>p.n===cur.phase);
  return `<div class="card"><div class="spread"><div><div class="label">Program progress</div><h2 class="num">${done.size} / ${TOTAL}</h2></div><div class="num muted">${pct}%</div></div>
    <p class="small muted" style="margin:6px 0 0">Now in Phase ${ph.n}, ${esc(ph.name)}: ${esc(ph.desc.toLowerCase())}. Phase 1 has 6 weeks (week 6 is a semi-deload), Phase 2 has 4, Phase 3 has 3 (week 3 is a full deload). At 4 gym days a week the whole program takes about 20 calendar weeks.</p></div>
    <div class="card">${g}<p class="small muted" style="margin:10px 0 0">Tap a session to preview it or move your position.</p></div>`;
}
function renderPreview(s){
  const n=seqInfo(s); const ex=exercisesFor(s); const next=nextSeq();
  return `<div class="stack"><button class="linkbtn" data-back>← Plan</button>
    <div class="card hero ${n.day.kind}"><div class="label">${wkLong(n)}</div><h2>${n.day.name}</h2>
    ${n.note?`<p class="small" style="margin:4px 0 0;color:var(--warn)">${esc(n.note)}</p>`:""}
    <div class="row" style="margin-top:8px">${s===next?`<span class="small muted">This is your next session.</span>`:UI.confirm==="setnext"?`<span class="small">Set ${n.day.name} ${wk(n)} as next?</span><button class="btn primary sm" data-setnext="${s}">Yes, set it</button><button class="btn sm" data-cancelconfirm>Cancel</button>`:`<button class="btn sm" data-askset>Set as next session</button>`}
    <button class="btn sm" data-start="${s}">Start this workout</button></div></div>
    ${ex.map(e=>`<div class="ex"><div class="ex-h"><h3>${esc(e.n)}</h3><a class="small" href="${esc(videoFor(e))}" target="_blank" rel="noopener">Video</a></div>
      <div class="spec"><div><b>${esc(e.wu)}</b><span>Warm-up</span></div><div><b>${e.s} × ${esc(e.r)}</b><span>Work</span></div><div><b>${esc(e.rpe)}</b><span>RPE</span></div><div><b>${esc(e.rest.replace(" min","m"))}</b><span>Rest</span></div></div>
      ${altLinks(e)}
      <p class="small muted" style="margin:8px 0 0">${esc(e.note)}</p></div>`).join("")}</div>`;
}
const altLinks=e=>e.opts.length>1?`<p class="small" style="margin:8px 0 0"><span class="muted">Alternatives:</span> ${e.opts.slice(1).map(o=>`${esc(o.n)} <a href="${esc(videoFor(o))}" target="_blank" rel="noopener">Video</a>`).join(" · ")}</p>`:"";
function renderHistory(){
  return renderHistoryList()+bwForm(false);
}
function renderHistoryList(){
  if(!S.logs.length) return `<div class="card"><h3>Nothing logged yet</h3><p class="muted small">Finished workouts and office-day sessions appear here, newest first.</p></div>`;
  return S.logs.map(l=>{
    const dl=parseYmd(l.date).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
    if(l.type==="skip") return `<div class="card"><div class="spread"><span class="tag" style="color:var(--muted)">Skipped gym day</span><span class="small muted">${dl}</span></div>${delCtl(l)}</div>`;
    if(l.type==="home") return `<div class="card"><div class="spread"><span class="tag"><span class="plate home"></span>${esc(l.title)}</span><span class="small muted">${dl}</span></div>${l.note?`<p class="small muted" style="margin:6px 0 0">${esc(l.note)}</p>`:""}${delCtl(l)}</div>`;
    const n=seqInfo(l.seq); const open=UI.openLog===l.id;
    const vol=(l.exercises||[]).reduce((a,e)=>a+(e.sets||[]).reduce((b,s)=>b+(Number(s.kg)||0)*(Number(s.reps)||0),0),0);
    return `<div class="card"><div class="spread"><span class="tag"><span class="plate ${n.day.kind}"></span>${n.day.name} · ${wk(n)}</span><span class="small muted">${dl}</span></div>
      <p class="small muted" style="margin:4px 0 0">${l.untracked?"Done before the app, no sets recorded.":`${(l.exercises||[]).length} exercises${vol?` · ${Math.round(vol).toLocaleString()} kg total volume`:""}`}</p>${l.untracked?"":kcalLine(l,false)}
      ${(l.exercises||[]).length?`<button class="linkbtn small" data-openlog="${l.id}">${open?"Hide sets":"Show sets"}</button>`:""}
      ${open?`<ul class="list small" style="margin-top:8px">${l.exercises.map(e=>`<li><div><b>${esc(e.used||e.n)}</b></div><div class="num muted" style="text-align:right">${(e.sets||[]).filter(s=>s.kg||s.reps).map(s=>`${s.kg||"–"}×${s.reps||"–"}`).join(", ")||"–"}</div></li>`).join("")}</ul>${l.note?`<p class="small muted">${esc(l.note)}</p>`:""}`:""}
      ${delCtl(l)}</div>`;}).join("");
}
function delCtl(l){return UI.confirm==="del:"+l.id?`<div class="row" style="margin-top:8px"><span class="small">Delete this entry?</span><button class="btn sm" data-del="${l.id}">Delete</button><button class="btn sm" data-cancelconfirm>Keep</button></div>`:`<button class="linkbtn small" style="margin-top:6px;color:var(--muted)" data-askdel="${l.id}">Delete</button>`}

/* ---------- Bindings shared by Today and Gym ---------- */
export function bindGym(app){
  const render=()=>bus.render();
  app.querySelectorAll("[data-start]").forEach(b=>b.onclick=()=>startWorkout(Number(b.dataset.start)));
  app.querySelectorAll("[data-gymview]").forEach(b=>b.onclick=()=>{UI.gymView=b.dataset.gymview;UI.preview=null;UI.confirm=null;ls.set("cad_gymview",UI.gymView);render()});
  app.querySelectorAll("[data-preview]").forEach(b=>b.onclick=()=>{UI.tab="gym";UI.gymView="plan";UI.preview=Number(b.dataset.preview);UI.confirm=null;render();window.scrollTo(0,0)});
  app.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>{UI.preview=null;UI.confirm=null;render()});
  app.querySelectorAll("[data-askset]").forEach(b=>b.onclick=()=>{UI.confirm="setnext";render()});
  app.querySelectorAll("[data-cancelconfirm]").forEach(b=>b.onclick=()=>{UI.confirm=null;render()});
  app.querySelectorAll("[data-setnext]").forEach(b=>b.onclick=async()=>{UI.confirm=null;await guard(saveState({...S.state,next:Number(b.dataset.setnext)}));toast("Next session updated");render()});
  app.querySelectorAll("[data-openlog]").forEach(b=>b.onclick=()=>{UI.openLog=UI.openLog===b.dataset.openlog?null:b.dataset.openlog;render()});
  app.querySelectorAll("[data-askdel]").forEach(b=>b.onclick=()=>{UI.confirm="del:"+b.dataset.askdel;render()});
  app.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{UI.confirm=null;await guard(removeLog(b.dataset.del));toast("Entry deleted")});
  app.querySelectorAll("[data-off]").forEach(b=>b.onclick=()=>{const k=b.dataset.off;const card=b.closest(".card");card.outerHTML=renderOff(OFF[k],k,null);bindGym(app)});
  app.querySelectorAll("[data-savebw]").forEach(b=>b.onclick=async()=>{const v=Math.round(Number(($("#bw")?.value||"").replace(",","."))*10)/10;
    if(!(v>=30&&v<=250)){toast("Enter your weight in kg");return;}
    await guard(saveState({...S.state,bodyweight:v}));toast("Body weight saved")});
  app.querySelectorAll("[data-askskip]").forEach(b=>b.onclick=()=>{UI.confirm="skip";render()});
  app.querySelectorAll("[data-skip]").forEach(b=>b.onclick=async()=>{UI.confirm=null;await guard(addLog({type:"skip",date:todayStr(),seq:Number(b.dataset.skip)}));toast("Skipped. The plan moves one gym day.")});
  app.querySelectorAll("[data-unskip]").forEach(b=>b.onclick=async()=>{await guard(removeLog(b.dataset.unskip));toast("Skip undone")});
  migrateOrder();
  app.querySelectorAll("[data-offdone]").forEach(b=>b.onclick=async()=>{const k=b.dataset.offdone;const note=($("#off-note")?.value||"").trim();
    await guard(addLog({type:"home",date:todayStr(),title:OFF[k].title,key:k,note}));toast("Logged")});
}

/* One-time fix for the first week: Push #1 was done on Fri 2 Oct (not Pull #1), Pull #1 is on Sat 3 Oct, then Legs #1.
   Rewrites the seeded start entry as Push #1 and points the program at Pull #1. Runs only while the seed is the only gym entry. */
let migrating=false;
function migrateOrder(){
  if(migrating||S.state.order2||S.mode!=="db") return;
  const gyms=S.logs.filter(l=>l.type==="gym");
  const seed=gyms.find(l=>l.id==="seed-pull1-w1"&&l.untracked);
  if(!seed||gyms.length!==1) return;
  migrating=true;
  Promise.all([setLog(seed.id,{...seed,id:undefined,day:"push1",seq:0}),saveState({...S.state,next:1,order2:true})])
    .catch(e=>console.error(e)).finally(()=>{migrating=false;bus.render();});
}

/* ---------- Workout ---------- */
function startWorkout(seq){
  const ex=exercisesFor(seq);
  let draft=ls.get("ppl_draft");
  if(!draft||draft.seq!==seq||!Array.isArray(draft.ex)||draft.ex.length!==ex.length){
    // Start each exercise on the variation you used last time (e.g. DB Bench if the bench was taken).
    const lastSub=e=>{const l=lastFor(e.n);const k=l?e.opts.findIndex(o=>o.n===l.e.used):-1;return k>0?k:0;};
    draft={seq,started:new Date().toISOString(),ex:ex.map(e=>({sub:lastSub(e),done:false,sets:Array.from({length:e.s},()=>({kg:"",reps:""}))})),note:""};
  }
  UI.workout=draft; ls.set("ppl_draft",draft); bus.render(); window.scrollTo(0,0);
}
export function renderWorkout(){
  const w=UI.workout; const n=seqInfo(w.seq); const ex=exercisesFor(w.seq);
  const doneCount=w.ex.filter(x=>x.done).length;
  return `<div class="stack">
    <div class="spread"><button class="linkbtn" data-exit>← Save and close</button><span class="small muted num">${doneCount}/${ex.length} done</span></div>
    <div class="card hero ${n.day.kind}"><div class="label">${wkLong(n)}${n.deload?", avoid failure":""}</div><h2>${n.day.name}</h2>
      <p class="small muted" style="margin:4px 0 0">Log working sets only. Weights in kg.</p></div>
    ${ex.map((e,i)=>{const st=w.ex[i]; const cho=e.opts[st.sub]||e.opts[0]; const subName=cho.n; const last=lastFor(e.n);
      const top=topOfRange(e.r); let hint="";
      if(last){const sets=last.e.sets.filter(s=>s.kg||s.reps);hint=`<div class="hint num">Last (${last.date.slice(5)}${last.e.used&&last.e.used!==e.n?", "+esc(last.e.used):""}): ${sets.map(s=>`${s.kg||"–"}×${s.reps||"–"}`).join(", ")}</div>`;
        if(top&&sets.length&&sets.every(s=>Number(s.reps)>=top)&&!n.deload) hint+=`<div class="hint up">You hit ${top} reps on every set last time. Try adding 2.5 kg.</div>`;}
      return `<div class="ex ${st.done?"done":""}" id="ex-${i}">
        <div class="ex-h"><h3>${esc(subName)}</h3><a class="small" href="${esc(videoFor(cho))}" target="_blank" rel="noopener">Video</a></div>
        ${st.sub?`<p class="small muted" style="margin:2px 0 0">Instead of ${esc(e.n)}</p>`:""}
        <div class="spec"><div><b>${esc(e.wu)}</b><span>Warm-up</span></div><div><b>${e.s} × ${esc(e.r)}</b><span>Work</span></div><div><b>${esc(e.rpe)}</b><span>RPE</span></div><div><b>${esc(e.rest.replace(" min","m"))}</b><span>Rest</span></div></div>
        ${e.opts.length>1?`<div class="opts" role="radiogroup" aria-label="Variation for ${esc(e.n)}">${e.opts.map((o,k)=>`<button class="optc ${st.sub===k?"on":""}" role="radio" aria-checked="${st.sub===k}" data-sub="${i}" data-k="${k}">${k===0?"":`<span class="muted">Alt ${k}:</span> `}${esc(o.n)}</button>`).join("")}</div>`:""}
        ${hint?`<div class="stack" style="gap:6px;margin-top:8px">${hint}</div>`:""}
        <div class="sets"><span></span><span class="label" style="text-align:center">kg</span><span class="label" style="text-align:center">reps</span>
          ${st.sets.map((s,j)=>`<span class="sn">Set ${j+1}</span><input id="kg-${i}-${j}" inputmode="decimal" data-kg="${i}-${j}" value="${esc(s.kg)}" aria-label="Set ${j+1} weight"><input id="rp-${i}-${j}" inputmode="numeric" data-rp="${i}-${j}" value="${esc(s.reps)}" aria-label="Set ${j+1} reps">`).join("")}
        </div>
        <div class="row" style="margin-top:10px;justify-content:space-between">
          <div class="row">${restSeconds(e.rest)?`<button class="btn sm" data-rest="${restSeconds(e.rest)}">Rest ${e.rest.replace("~","")}</button>`:""}<button class="btn sm ghost" data-addset="${i}">+ Set</button></div>
          <button class="btn sm ${st.done?"":"primary"}" data-done="${i}">${st.done?"Undo":"Done"}</button></div>
        <details style="margin-top:8px"><summary>Coaching notes</summary><p class="small muted" style="margin:6px 0 0">${esc(e.note)}</p>
          ${e.opts.length>1?`<p class="small" style="margin:6px 0 0">Videos: ${e.opts.map((o,k)=>`<a href="${esc(videoFor(o))}" target="_blank" rel="noopener">${esc(o.n)}</a>`).join(" · ")}</p>`:""}</details>
      </div>`;}).join("")}
    <div class="card"><label class="label" for="wnote">Session note</label><textarea id="wnote" rows="2" placeholder="Energy, gym, anything to remember">${esc(w.note)}</textarea></div>
    ${UI.confirm==="finish"?`<div class="card"><p style="margin:0 0 8px">Finish and save ${n.day.name} ${wk(n)}? ${doneCount<ex.length?`${ex.length-doneCount} exercises aren't marked done.`:""}</p><div class="row"><button class="btn primary" data-finish>Save workout</button><button class="btn" data-cancelconfirm>Keep training</button></div></div>`:`<button class="btn primary block" data-askfinish>Finish workout</button>`}
    ${UI.confirm==="discard"?`<div class="row"><span class="small">Discard this workout?</span><button class="btn sm" data-discard>Discard</button><button class="btn sm" data-cancelconfirm>Keep</button></div>`:`<button class="linkbtn small" style="color:var(--muted)" data-askdiscard>Discard workout</button>`}
  </div>`;
}
const saveDraft=()=>ls.set("ppl_draft",UI.workout);
export function bindWorkout(app){
  const w=UI.workout; const render=()=>bus.render();
  app.querySelectorAll("[data-kg]").forEach(inp=>inp.oninput=()=>{const [i,j]=inp.dataset.kg.split("-").map(Number);w.ex[i].sets[j].kg=inp.value.replace(",",".");saveDraft()});
  app.querySelectorAll("[data-rp]").forEach(inp=>inp.oninput=()=>{const [i,j]=inp.dataset.rp.split("-").map(Number);w.ex[i].sets[j].reps=inp.value;saveDraft()});
  app.querySelectorAll("[data-sub]").forEach(b=>b.onclick=()=>{w.ex[Number(b.dataset.sub)].sub=Number(b.dataset.k);saveDraft();
    const y=window.scrollY;render();window.scrollTo(0,y)});
  app.querySelectorAll("[data-addset]").forEach(b=>b.onclick=()=>{w.ex[Number(b.dataset.addset)].sets.push({kg:"",reps:""});saveDraft();render()});
  app.querySelectorAll("[data-done]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.done);w.ex[i].done=!w.ex[i].done;saveDraft();render();
    const nx=document.getElementById("ex-"+(i+1)); if(w.ex[i].done&&nx) nx.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});});
  app.querySelectorAll("[data-rest]").forEach(b=>b.onclick=()=>startTimer(Number(b.dataset.rest)));
  const note=$("#wnote"); if(note) note.oninput=()=>{w.note=note.value;saveDraft()};
  app.querySelector("[data-exit]").onclick=()=>{UI.workout=null;UI.confirm=null;render();toast("Draft saved on this phone")};
  app.querySelectorAll("[data-askfinish]").forEach(b=>b.onclick=()=>{UI.confirm="finish";render();window.scrollTo(0,document.body.scrollHeight)});
  app.querySelectorAll("[data-askdiscard]").forEach(b=>b.onclick=()=>{UI.confirm="discard";render();window.scrollTo(0,document.body.scrollHeight)});
  app.querySelectorAll("[data-cancelconfirm]").forEach(b=>b.onclick=()=>{UI.confirm=null;render()});
  app.querySelectorAll("[data-discard]").forEach(b=>b.onclick=()=>{ls.del("ppl_draft");UI.workout=null;UI.confirm=null;render()});
  app.querySelectorAll("[data-finish]").forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    const n=seqInfo(w.seq); const ex=exercisesFor(w.seq);
    const log={type:"gym",seq:w.seq,phase:n.phase,week:n.week,day:n.day.id,date:todayStr(),note:w.note||"",started:w.started||null,
      exercises:ex.map((e,i)=>({n:e.n,used:(e.opts[w.ex[i].sub]||e.opts[0]).n,sets:w.ex[i].sets.filter(s=>s.kg!==""||s.reps!=="")}))};
    try{
      await guard(addLog(log));
      const cur=nextSeq();
      if(w.seq>=cur) await guard(saveState({...S.state,next:w.seq+1}));
      ls.del("ppl_draft"); UI.workout=null; UI.confirm=null; UI.tab="today"; stopTimer(); render(); window.scrollTo(0,0); toast("Workout saved");
    }catch(e){b.disabled=false}
  });
}
/* rest timer */
let timerInt=null,timerEnd=0;
function startTimer(sec){timerEnd=Date.now()+sec*1000;clearInterval(timerInt);tick();timerInt=setInterval(tick,250)}
function stopTimer(){clearInterval(timerInt);$("#timer").hidden=true}
function tick(){const el=$("#timer");const left=Math.max(0,Math.round((timerEnd-Date.now())/1000));
  el.hidden=false;el.innerHTML=`<span>${left>0?"Rest "+Math.floor(left/60)+":"+pad(left%60):"Go: next set"}</span><button id="t-add">+30s</button><button id="t-stop">${left>0?"Skip":"Close"}</button>`;
  $("#t-add").onclick=()=>{timerEnd=Math.max(timerEnd,Date.now())+30000;tick()};$("#t-stop").onclick=stopTimer;
  if(left<=0){clearInterval(timerInt);beep();}}
function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)();const o=c.createOscillator();const g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;g.gain.value=.15;o.start();o.stop(c.currentTime+.35)}catch(e){}}
