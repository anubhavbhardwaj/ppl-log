/* Gym module: Jeff Nippard Ultimate PPL Phase 1 program, office-day plans, workout logging. */
import {$,esc,pad,ymd,todayStr,WD,ls,toast,guard,UI,bus,parseYmd} from "./util.js";
import {S,DEFAULT_NEXT,saveState,addLog,removeLog} from "./store.js";

/* ---------- Program: Jeff Nippard Ultimate PPL, Phase 1 (weeks 1-6) ---------- */
export const DAYS=[
 {id:"push1",name:"Push #1",kind:"push"},{id:"pull1",name:"Pull #1",kind:"pull"},{id:"legs1",name:"Legs #1",kind:"legs"},
 {id:"push2",name:"Push #2",kind:"push"},{id:"pull2",name:"Pull #2",kind:"pull"},{id:"legs2",name:"Legs #2",kind:"legs"}];
export const WEEKS=6, TOTAL=WEEKS*DAYS.length;
// [name, warmups, sets, reps, rpe, rest, sub1, sub2, note, weekRepsOverride, week6 [sets,rpe,reps?]]
const P={
push1:[
["Bench Press","3-4",1,"3-5","8-9","3-4 min","DB Bench Press","Machine Chest Press","Set up a comfortable arch, quick pause on the chest and explode up on each rep.",{3:"2-4",4:"2-4"},[1,"7"]],
["Larsen Press","0",2,"10","8-9","3-4 min","DB Bench Press (No Leg Drive)","Machine Chest Press (No Leg Drive)","Shoulder blades still retracted and depressed. Slight arch in upper back. Zero leg drive.",null,[2,"7"]],
["Standing Dumbbell Arnold Press","2",3,"8-10","8-9","2-3 min","Seated DB Shoulder Press","Machine Shoulder Press","Start with elbows in front, palms facing in. Rotate so palms face forward as you press.",null,[2,"7"]],
["A1. Press-Around","1",2,"12-15","9-10","0 min","DB Flye","Deficit Push Up","Brace with your non-working arm, squeeze your pecs by pressing the cable across your body.",null,[2,"8"]],
["A2. Pec Static Stretch 30s","0",2,"30s hold","N/A","0 min","","","Hold a pec stretch for 30 seconds at about 7/10 intensity.",null,null],
["Cross-Body Cable Y-Raise (Side Delt)","1",3,"12-15","9-10","1-2 min","DB Lateral Raise","Machine Lateral Raise","Think about swinging the cable out and up as if drawing a sword from your side.",null,[2,"8"]],
["Squeeze-Only Triceps Pressdown + Stretch-Only Overhead Triceps Extension","1",3,"8 + 8","9-10","1-2 min","Triceps Pressdown (12-15 reps)","DB Skull Crusher (12-15 reps)","Second half of the ROM for pressdowns (the squeeze), first half of the ROM for overhead extensions (the stretch).",null,[2,"8"]],
["N1-Style Cross-Body Triceps Extension","0",2,"10-12","10","1-2 min","Single-Arm Tricep Pressdown","Single-Arm Cable Tricep Kickback","Arm more out to the side than a regular pressdown. Feel the stretch as the cable moves across your torso.",null,[2,"8"]]],
pull1:[
["Lat Pulldown (Feeder Sets)","0",4,"10","See notes","2-3 min","Machine Pulldown","Pull-Up","4 feeder sets of 10, building weight each set: RPE 4-5, 6-7, 7-8, then set 4 to failure at 10 reps.",null,null],
["Lat Pulldown (Failure Set)","0",1,"10+5","10","2-3 min","Machine Pulldown","Pull-Up","After failure at ~10 reps, strip 30-50% and do another 5 controlled reps.",null,null],
["Omni-Grip Machine Chest-Supported Row","2",3,"10-12","8-9","2-3 min","Incline Chest-Supported DB Row","Cable Seated Row","Use 3 different grips for the 3 working sets, wider to closer.",null,[3,"7"]],
["A1. Bottom-Half DB Lat Pullover","1",2,"10-12","9-10","0 min","Cable Lat Pullover","1-Arm Lat Pull-In","Cut out the top half of the ROM, stay in the stretched part.",null,[2,"8"]],
["A2. Lat Static Stretch 30s","0",2,"30s hold","N/A","0 min","","","Hold a lat stretch for 30 seconds at about 7/10 intensity.",null,null],
["Omni-Direction Face Pull","1",3,"12-15","9-10","1-2 min","Reverse Cable Flye","Bent-Over Reverse DB Flye","Set 1 low-to-high, set 2 mid-range, set 3 high-to-low.",null,[3,"8"]],
["EZ-Bar Curl","1",3,"6-8","9-10","1-2 min","DB Curl","Cable Curl","Focus on contracting your biceps, minimize torso momentum.",null,[2,"8"]],
["Bottom-Half Preacher Curl","0",2,"10-12","10","1-2 min","Bottom-Half Spider Curl","Bottom-Half Bayesian Curl","Cut out the top half of the ROM, stay in the stretched part.",null,[2,"8"]]],
legs1:[
["Squat","3-4",1,"2-4","8-9","3-4 min","Hack Squat","DB Bulgarian Split Squat","Sit back and down, keep your upper back tight to the bar.",{2:"3-5",3:"4-6",4:"3-5",5:"2-4",6:"1-3"},[1,"7"]],
["Pause Squat (Back off)","0",2,"5","8-9","3-4 min","Pause Hack Squat","Pause DB Bulgarian Split Squat","Drop ~25% from your top set. 2 second pause.",null,[2,"7"]],
["Barbell RDL","2",3,"8-10","8-9","2-3 min","DB RDL","45° Hyperextension","Neutral lower back, hips back, don't let your spine round.",null,[2,"7"]],
["Walking Lunge","1",2,"10","8-9","2-3 min","DB Step-Up","Goblet Squat","Medium strides, minimize push-off from the rear leg.",null,[2,"7"]],
["Seated Leg Curl","1",3,"10-12","9-10","1-2 min","Lying Leg Curl","Nordic Ham Curl","Focus on squeezing your hamstrings to move the weight.",null,[2,"8"]],
["Leg Press Toe Press","1",4,"10-12","9-10","1-2 min","Seated Calf Raise","Standing Calf Raise","All the way up on your toes, stretch at the bottom, don't bounce.",null,[2,"8"]],
["Decline Plate-Weighted Crunch","1",3,"10-12","9-10","1-2 min","Cable Crunch","Machine Crunch","Hold a plate or DB to your chest and crunch hard.",null,[2,"8"]]],
push2:[
["Close-Grip Barbell Incline Press","2-3",3,"8, 5, 12","8-9","3-4 min","Close-Grip DB Incline Press","Close-Grip Machine Press","~45° incline, grip just outside shoulder width.",null,[2,"7","8, 5"]],
["Machine Shoulder Press","2",3,"10-12","8-9","2-3 min","Seated DB Shoulder Press","Standing DB Arnold Press","Don't stop between reps, keep smooth tension on the delts.",null,[2,"7"]],
["Floor Skull Crusher (Heavy)","1",3,"6-8","8-9","1-2 min","DB Floor Skull Crusher","Overhead Cable Triceps Extension","Arc the bar behind your head, dead stop on the floor between reps.",null,[2,"7"]],
["Bent-Over Cable Pec Flye","1",3,"10-12","9-10","1-2 min","Pec Deck","DB Flye","Squeeze your pecs together at the top, big stretch at the bottom.",null,[2,"8"]],
["Eccentric-Accentuated + Constant-Tension Cable Lateral Raise","1",3,"5, 15","9-10","1-2 min","DB Lateral Raise","Machine Lateral Raise","First 5 reps with a 5-second lowering, last 15 constant tension.",null,[2,"8"]],
["Plate Front Raise","1",2,"15-20","9-10","1-2 min","DB Front Raise","Cable Front Raise","Turn one side up like a steering wheel as you lift.",null,[2,"8"]],
["Diamond Push Up","0",1,"AMRAP","10","0 min","Close-Grip Push Up","Kneeling Modified Push Up","Hands together in a diamond, as many reps as possible with a smooth tempo.",null,null]],
pull2:[
["1-Arm Half-Kneeling Lat Pulldown","1",3,"12-15","8-9","1-2 min","1-Arm Lat Pull-In","Cable Lat Pullover","Chest tall, elbow tucked close to your torso, squeeze the lat.",null,[2,"7"]],
["Pull-Up (1 AMRAP set)","2",1,"AMRAP","10","2-3 min","Lat Pulldown (8-15 rep AMRAP)","Machine Pulldown","1.5x shoulder width grip, pull your chest to the bar.",null,null],
["Kroc Row","2",3,"10-12","8-9","2-3 min","Single-Arm DB Row","Meadows Row","A DB row with mild cheating and a more upright posture. Go heavy, use straps if grip limits.",null,[2,"7"]],
["Cable Shrug-In","1",3,"10-12","9-10","1-2 min","DB Shrug","Plate Shrug","Two cable handles low, shrug up and in. Squeeze your upper traps.",null,[2,"8"]],
["Reverse Pec Deck","1",3,"10-12","9-10","1-2 min","Reverse Cable Flye","Bent-Over Reverse DB Flye","Swing the weight out, not back.",null,[2,"8"]],
["N1-Style Cross-Body Cable Bicep Curl","1",3,"10-12","9-10","1-2 min","DB Incline Curl","DB Curl","Curl across your body with your arm out to the side at ~60°.",null,[2,"8"]]],
legs2:[
["Deadlift","3-4",1,"5","8-9","3-5 min","Trap Bar Deadlift","Barbell Hip Thrust","Brace your lats, chest tall, pull the slack out of the bar before lifting.",{2:"4",3:"3",4:"2",5:"1",6:"4"},[1,"5-6"]],
["Stiff-Leg Deadlift","0",2,"8","8-9","3-4 min","Barbell RDL","DB RDL","A high-hip conventional deadlift with a slight knee bend.",null,[2,"7"]],
["Leg Press","2-3",4,"10-12","8-9","2-3 min","Goblet Squat","Walking Lunge","Medium foot width, don't let your lower back round.",null,[2,"7"]],
["Glute Ham Raise","1",3,"8-10","9-10","1-2 min","Nordic Ham Curl","Lying Leg Curl","Keep your hips straight. Nordics if there's no GHR.",null,[2,"8"]],
["Slow-Eccentric Leg Extension","1",3,"8-10","9-10","1-2 min","DB Step-Up","Goblet Squat","3-4 second negative.",null,[2,"8"]],
["Seated Calf Raise","1",4,"15-20","9-10","1-2 min","Standing Calf Raise","Leg Press Toe Press","All the way up on your toes, stretch at the bottom, don't bounce.",null,[2,"8"]],
["Roman Chair Leg Raise","1",3,"10-20","9-10","1-2 min","Hanging Leg Raise","Reverse Crunch","No swinging. Tuck knees if straight legs are too hard.",null,[2,"8"]]]
};
export function exercisesFor(dayId,week){
  return P[dayId].map(a=>{
    const e={n:a[0],wu:a[1],s:a[2],r:a[3],rpe:a[4],rest:a[5],s1:a[6],s2:a[7],note:a[8]};
    if(a[9]&&a[9][week]) e.r=a[9][week];
    if(week===6&&a[10]){e.s=a[10][0];e.rpe=a[10][1];if(a[10][2])e.r=a[10][2];}
    return e;});
}
export const seqInfo=i=>({week:Math.floor(i/6)+1,day:DAYS[i%6],seq:i});

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
const videoFor=n=>yt("Jeff Nippard "+cleanName(n));
const restSeconds=r=>{const m=String(r).match(/(\d+)/);return m?Number(m[1])*60:0};
const topOfRange=r=>{const m=String(r).match(/^(\d+)\s*-\s*(\d+)$/);return m?Number(m[2]):(/^\d+$/.test(r)?Number(r):null)};
const nextSeq=()=>S.state.next??DEFAULT_NEXT;
function lastFor(name){
  for(const l of S.logs){ if(l.type!=="gym"||!l.exercises) continue;
    const e=l.exercises.find(x=>x.n===name && x.sets && x.sets.some(s=>s.kg||s.reps));
    if(e) return {date:l.date,e}; }
  return null;
}
const logsOn=date=>S.logs.filter(l=>l.date===date);
export function nextGymDayName(){const wd=new Date().getDay();for(let i=1;i<=7;i++){const w=(wd+i)%7;if(isGymDay(w))return i===1?"tomorrow":WD[w];}return "";}

/* ---------- Today ---------- */
// tripOn(date) -> trip or null. On trip days the PPL sequence pauses and a travel session is suggested.
export function weekStrip(tripOn){
  const now=new Date(); const wd=now.getDay(); const monOffset=(wd+6)%7;
  const mon=new Date(now); mon.setDate(now.getDate()-monOffset);
  let html='<div class="week">';
  for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const ds=ymd(d);const w=d.getDay();
    const gym=isGymDay(w); const done=logsOn(ds);
    const g=done.find(l=>l.type==="gym"); const h=done.find(l=>l.type==="home");
    let k=gym?"Gym":(w===2?"Run":w===3?"Home":"Easy");
    if(tripOn&&tripOn(ds)) k="Trip";
    if(g) k=DAYS.find(x=>x.id===g.day)?.name.replace(" #","") || k;
    html+=`<div class="dayc ${ds===todayStr()?"today":""}"><div class="d">${WD[w]}</div><div class="k">${esc(k)}</div><div class="tick">${(g||h)?"✓":""}</div></div>`;}
  return html+"</div>";
}
export function gymToday(trip){
  const next=nextSeq(); const wd=new Date().getDay(); const t=todayStr();
  const doneToday=logsOn(t); const gymDone=doneToday.find(l=>l.type==="gym"); const homeDone=doneToday.find(l=>l.type==="home");
  if(next>=TOTAL) return `<div class="card hero"><div class="label">Phase 1 complete</div><h2>All 36 sessions done</h2><p class="muted">Phase 2 isn't loaded yet. Share the Phase 2 tab of your sheet and it can be added here.</p></div>`;
  const n=seqInfo(next);
  const sessionCard=(label,extra)=>`<div class="card hero ${n.day.kind}"><div class="label">${label}</div>
    <div class="spread" style="margin-top:4px"><h2>${n.day.name}</h2><span class="tag"><span class="plate ${n.day.kind}"></span>Week ${n.week}${n.week===6?" · deload":""}</span></div>
    <p class="muted small">${exercisesFor(n.day.id,n.week).length} exercises · session ${next+1} of ${TOTAL}</p>${extra}</div>`;
  const upNext=`<div class="card"><div class="label">Up next at the gym${trip?"":" · "+nextGymDayName()}</div>
      <div class="spread" style="margin-top:4px"><h3><span class="tag"><span class="plate ${n.day.kind}"></span>${n.day.name} · Week ${n.week}</span></h3>
      <button class="btn sm" data-start="${next}">Train today</button></div></div>`;
  if(gymDone){
    const g=seqInfo(gymDone.seq);
    return `<div class="card hero ${g.day.kind}"><div class="label">Done today</div><h2>${g.day.name} · Week ${g.week}</h2><p class="muted small">Nice work. Next gym day: ${nextGymDayName()}.</p></div>`+sessionCard("Up next",`<button class="btn ghost sm" data-preview="${next}">Preview exercises</button>`);
  }
  if(trip) return renderOff(OFF.travel,"travel",homeDone,"Away · "+esc(trip.title))+upNext;
  if(isGymDay(wd)){
    const draft=ls.get("ppl_draft");
    return sessionCard("Today at the gym",`<button class="btn primary block" data-start="${next}">${draft&&draft.seq===next?"Resume workout":"Start workout"}</button>`);
  }
  const key=offPlanFor(wd,n.day.kind);
  return renderOff(OFF[key],key,homeDone)+upNext;
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
  const next=nextSeq();
  let g=`<div class="pgrid"><div></div>${DAYS.map(d=>`<div class="h">${d.name.replace(" #","")}</div>`).join("")}`;
  for(let w=1;w<=WEEKS;w++){g+=`<div class="h" style="align-self:center;text-align:left">W${w}</div>`;
    DAYS.forEach((d,i)=>{const s=(w-1)*6+i;g+=`<button class="cell ${s<next?"done":""} ${s===next?"next":""}" data-preview="${s}" aria-label="${d.name} week ${w}"><span class="plate ${d.kind}"></span>${s<next?"✓":s===next?"Next":""}</button>`;});}
  g+="</div>";
  const pct=Math.round(Math.min(next,TOTAL)/TOTAL*100);
  return `<div class="card"><div class="spread"><div><div class="label">Phase 1 progress</div><h2 class="num">${Math.min(next,TOTAL)} / ${TOTAL}</h2></div><div class="num muted">${pct}%</div></div>
    <p class="small muted" style="margin:6px 0 0">Base hypertrophy, moderate volume and intensity. Week 6 is a semi-deload: lighter, fewer sets, avoid failure. At 4 gym days a week this phase takes about 9 calendar weeks.</p></div>
    <div class="card">${g}<p class="small muted" style="margin:10px 0 0">Tap a session to preview it or move your position.</p></div>`;
}
function renderPreview(s){
  const n=seqInfo(s); const ex=exercisesFor(n.day.id,n.week); const next=nextSeq();
  return `<div class="stack"><button class="linkbtn" data-back>← Plan</button>
    <div class="card hero ${n.day.kind}"><div class="label">Week ${n.week}${n.week===6?" · semi-deload":""}</div><h2>${n.day.name}</h2>
    <div class="row" style="margin-top:8px">${s===next?`<span class="small muted">This is your next session.</span>`:UI.confirm==="setnext"?`<span class="small">Set ${n.day.name} W${n.week} as next?</span><button class="btn primary sm" data-setnext="${s}">Yes, set it</button><button class="btn sm" data-cancelconfirm>Cancel</button>`:`<button class="btn sm" data-askset>Set as next session</button>`}
    <button class="btn sm" data-start="${s}">Start this workout</button></div></div>
    ${ex.map(e=>`<div class="ex"><div class="ex-h"><h3>${esc(e.n)}</h3><a class="small" href="${videoFor(e.n)}" target="_blank" rel="noopener">Video</a></div>
      <div class="spec"><div><b>${esc(e.wu)}</b><span>Warm-up</span></div><div><b>${e.s} × ${esc(e.r)}</b><span>Work</span></div><div><b>${esc(e.rpe)}</b><span>RPE</span></div><div><b>${esc(e.rest.replace(" min","m"))}</b><span>Rest</span></div></div>
      <p class="small muted" style="margin:8px 0 0">${esc(e.note)}</p></div>`).join("")}</div>`;
}
function renderHistory(){
  if(!S.logs.length) return `<div class="card"><h3>Nothing logged yet</h3><p class="muted small">Finished workouts and office-day sessions appear here, newest first.</p></div>`;
  return S.logs.map(l=>{
    const dl=parseYmd(l.date).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
    if(l.type==="home") return `<div class="card"><div class="spread"><span class="tag"><span class="plate home"></span>${esc(l.title)}</span><span class="small muted">${dl}</span></div>${l.note?`<p class="small muted" style="margin:6px 0 0">${esc(l.note)}</p>`:""}${delCtl(l)}</div>`;
    const n=seqInfo(l.seq); const open=UI.openLog===l.id;
    const vol=(l.exercises||[]).reduce((a,e)=>a+(e.sets||[]).reduce((b,s)=>b+(Number(s.kg)||0)*(Number(s.reps)||0),0),0);
    return `<div class="card"><div class="spread"><span class="tag"><span class="plate ${n.day.kind}"></span>${n.day.name} · W${n.week}</span><span class="small muted">${dl}</span></div>
      <p class="small muted" style="margin:4px 0 0">${l.untracked?"Done before the app, no sets recorded.":`${(l.exercises||[]).length} exercises${vol?` · ${Math.round(vol).toLocaleString()} kg total volume`:""}`}</p>
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
  app.querySelectorAll("[data-offdone]").forEach(b=>b.onclick=async()=>{const k=b.dataset.offdone;const note=($("#off-note")?.value||"").trim();
    await guard(addLog({type:"home",date:todayStr(),title:OFF[k].title,key:k,note}));toast("Logged")});
}

/* ---------- Workout ---------- */
function startWorkout(seq){
  const n=seqInfo(seq); const ex=exercisesFor(n.day.id,n.week);
  let draft=ls.get("ppl_draft");
  if(!draft||draft.seq!==seq){
    draft={seq,started:new Date().toISOString(),ex:ex.map(e=>({sub:0,done:false,sets:Array.from({length:e.s},()=>({kg:"",reps:""}))})),note:""};
  }
  UI.workout=draft; ls.set("ppl_draft",draft); bus.render(); window.scrollTo(0,0);
}
export function renderWorkout(){
  const w=UI.workout; const n=seqInfo(w.seq); const ex=exercisesFor(n.day.id,n.week);
  const doneCount=w.ex.filter(x=>x.done).length;
  return `<div class="stack">
    <div class="spread"><button class="linkbtn" data-exit>← Save and close</button><span class="small muted num">${doneCount}/${ex.length} done</span></div>
    <div class="card hero ${n.day.kind}"><div class="label">Week ${n.week}${n.week===6?" · semi-deload, avoid failure":""}</div><h2>${n.day.name}</h2>
      <p class="small muted" style="margin:4px 0 0">Log working sets only. Weights in kg.</p></div>
    ${ex.map((e,i)=>{const st=w.ex[i]; const subName=st.sub===1?e.s1:st.sub===2?e.s2:e.n; const last=lastFor(e.n);
      const top=topOfRange(e.r); let hint="";
      if(last){const sets=last.e.sets.filter(s=>s.kg||s.reps);hint=`<div class="hint num">Last (${last.date.slice(5)}${last.e.used&&last.e.used!==e.n?", "+esc(last.e.used):""}): ${sets.map(s=>`${s.kg||"–"}×${s.reps||"–"}`).join(", ")}</div>`;
        if(top&&sets.length&&sets.every(s=>Number(s.reps)>=top)&&n.week!==6) hint+=`<div class="hint up">You hit ${top} reps on every set last time. Try adding 2.5 kg.</div>`;}
      return `<div class="ex ${st.done?"done":""}" id="ex-${i}">
        <div class="ex-h"><h3>${esc(subName)}</h3><a class="small" href="${st.sub?yt(subName+" form"):videoFor(e.n)}" target="_blank" rel="noopener">Video</a></div>
        <div class="spec"><div><b>${esc(e.wu)}</b><span>Warm-up</span></div><div><b>${e.s} × ${esc(e.r)}</b><span>Work</span></div><div><b>${esc(e.rpe)}</b><span>RPE</span></div><div><b>${esc(e.rest.replace(" min","m"))}</b><span>Rest</span></div></div>
        ${e.s1?`<div class="row" style="margin-top:8px"><label class="small muted" for="sub-${i}">Variation</label><select id="sub-${i}" data-sub="${i}"><option value="0"${st.sub===0?" selected":""}>${esc(e.n)}</option><option value="1"${st.sub===1?" selected":""}>${esc(e.s1)}</option><option value="2"${st.sub===2?" selected":""}>${esc(e.s2)}</option></select></div>`:""}
        ${hint?`<div class="stack" style="gap:6px;margin-top:8px">${hint}</div>`:""}
        <div class="sets"><span></span><span class="label" style="text-align:center">kg</span><span class="label" style="text-align:center">reps</span>
          ${st.sets.map((s,j)=>`<span class="sn">Set ${j+1}</span><input id="kg-${i}-${j}" inputmode="decimal" data-kg="${i}-${j}" value="${esc(s.kg)}" aria-label="Set ${j+1} weight"><input id="rp-${i}-${j}" inputmode="numeric" data-rp="${i}-${j}" value="${esc(s.reps)}" aria-label="Set ${j+1} reps">`).join("")}
        </div>
        <div class="row" style="margin-top:10px;justify-content:space-between">
          <div class="row">${restSeconds(e.rest)?`<button class="btn sm" data-rest="${restSeconds(e.rest)}">Rest ${e.rest.replace("~","")}</button>`:""}<button class="btn sm ghost" data-addset="${i}">+ Set</button></div>
          <button class="btn sm ${st.done?"":"primary"}" data-done="${i}">${st.done?"Undo":"Done"}</button></div>
        <details style="margin-top:8px"><summary>Coaching notes</summary><p class="small muted" style="margin:6px 0 0">${esc(e.note)}</p>
          ${e.s1?`<p class="small" style="margin:6px 0 0">Substitutions: <a href="${yt(e.s1+" form")}" target="_blank" rel="noopener">${esc(e.s1)}</a> · <a href="${yt(e.s2+" form")}" target="_blank" rel="noopener">${esc(e.s2)}</a></p>`:""}</details>
      </div>`;}).join("")}
    <div class="card"><label class="label" for="wnote">Session note</label><textarea id="wnote" rows="2" placeholder="Energy, gym, anything to remember">${esc(w.note)}</textarea></div>
    ${UI.confirm==="finish"?`<div class="card"><p style="margin:0 0 8px">Finish and save ${n.day.name} W${n.week}? ${doneCount<ex.length?`${ex.length-doneCount} exercises aren't marked done.`:""}</p><div class="row"><button class="btn primary" data-finish>Save workout</button><button class="btn" data-cancelconfirm>Keep training</button></div></div>`:`<button class="btn primary block" data-askfinish>Finish workout</button>`}
    ${UI.confirm==="discard"?`<div class="row"><span class="small">Discard this workout?</span><button class="btn sm" data-discard>Discard</button><button class="btn sm" data-cancelconfirm>Keep</button></div>`:`<button class="linkbtn small" style="color:var(--muted)" data-askdiscard>Discard workout</button>`}
  </div>`;
}
const saveDraft=()=>ls.set("ppl_draft",UI.workout);
export function bindWorkout(app){
  const w=UI.workout; const render=()=>bus.render();
  app.querySelectorAll("[data-kg]").forEach(inp=>inp.oninput=()=>{const [i,j]=inp.dataset.kg.split("-").map(Number);w.ex[i].sets[j].kg=inp.value.replace(",",".");saveDraft()});
  app.querySelectorAll("[data-rp]").forEach(inp=>inp.oninput=()=>{const [i,j]=inp.dataset.rp.split("-").map(Number);w.ex[i].sets[j].reps=inp.value;saveDraft()});
  app.querySelectorAll("[data-sub]").forEach(s=>s.onchange=()=>{w.ex[Number(s.dataset.sub)].sub=Number(s.value);saveDraft();render()});
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
    const n=seqInfo(w.seq); const ex=exercisesFor(n.day.id,n.week);
    const log={type:"gym",seq:w.seq,week:n.week,day:n.day.id,date:todayStr(),note:w.note||"",
      exercises:ex.map((e,i)=>({n:e.n,used:w.ex[i].sub===1?e.s1:w.ex[i].sub===2?e.s2:e.n,sets:w.ex[i].sets.filter(s=>s.kg!==""||s.reps!=="")}))};
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
