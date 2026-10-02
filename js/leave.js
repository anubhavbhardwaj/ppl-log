/* Leave logic: Bavarian (Munich) public holidays, workday counting, budgets, bridges.
   Pure functions, no DOM, so they can be tested in Node. */
import {ymd,addDays,eachDay,parseYmd} from "./util.js";

/* ---------- Holidays: Bavaria, Munich (Assumption Day applies in Munich) ---------- */
function easter(y){ // Anonymous Gregorian algorithm
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),
    h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
    mo=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return ymd(new Date(y,mo-1,day,12));
}
const hcache=new Map();
export function holidays(y){
  if(hcache.has(y)) return hcache.get(y);
  const e=easter(y);
  const list=[[`${y}-01-01`,"New Year's Day"],[`${y}-01-06`,"Epiphany"],[addDays(e,-2),"Good Friday"],[addDays(e,1),"Easter Monday"],
    [`${y}-05-01`,"Labour Day"],[addDays(e,39),"Ascension Day"],[addDays(e,50),"Whit Monday"],[addDays(e,60),"Corpus Christi"],
    [`${y}-08-15`,"Assumption Day"],[`${y}-10-03`,"German Unity Day"],[`${y}-11-01`,"All Saints' Day"],
    [`${y}-12-25`,"Christmas Day"],[`${y}-12-26`,"St Stephen's Day"]].sort((a,b)=>a[0].localeCompare(b[0]));
  const m=new Map(list); hcache.set(y,m); return m;
}
export const holidayName=ds=>holidays(Number(ds.slice(0,4))).get(ds)||null;
export const isWeekend=ds=>{const w=parseYmd(ds).getDay();return w===0||w===6};
export const isWorkday=ds=>!isWeekend(ds)&&!holidayName(ds);

/* ---------- Budgets and blocks ---------- */
export const DEFAULT_BUDGET={vacation:30,wfi:15,yearEnd:6};
export const budgetFor=(leave,y)=>({...DEFAULT_BUDGET,...((leave||{})[String(y)]||{})});
export const BLOCK_TYPES={vacation:"Vacation",yearEnd:"Year-end",wfi:"Work from India"};
export const KINDS={rome:"Rome",india:"India",europe:"Europe",other:"Other"};
export const DEFAULT_AIRPORTS={rome:{from:["MUC","NUE","FMM"],to:["FCO","CIA"]},india:{from:["MUC"],to:["DEL"]},europe:{from:["MUC"],to:[]},other:{from:["MUC"],to:[]}};

const validBlock=b=>b&&b.start&&b.end&&b.start<=b.end&&BLOCK_TYPES[b.type];
// Workdays a block charges, each with the leave year it is charged to.
// A block marked carry=true charges the previous year (allowed only as an extension of the year-end block).
export function blockDays(b){
  if(!validBlock(b)) return [];
  const out=[];
  for(const d of eachDay(b.start,b.end)) if(isWorkday(d)) out.push({date:d,year:Number(d.slice(0,4))-(b.carry?1:0)});
  return out;
}
export function tripCounts(t,year){
  const c={vacation:0,yearEnd:0,wfi:0};
  (t.blocks||[]).forEach(b=>blockDays(b).forEach(d=>{if(year==null||d.year===year)c[b.type]++}));
  return c;
}
const counts=t=>t.status!=="idea";
export function balances(trips,leave,year){
  const budget=budgetFor(leave,year);
  const used={vacation:0,yearEnd:0,wfi:0}, ideas={vacation:0,yearEnd:0,wfi:0};
  trips.forEach(t=>{const c=tripCounts(t,year);const tgt=counts(t)?used:ideas;for(const k in c)tgt[k]+=c[k];});
  const flexTotal=budget.vacation-budget.yearEnd;
  return {budget,used,ideas,
    flexible:{total:flexTotal,used:used.vacation,left:flexTotal-used.vacation},
    yearEnd:{total:budget.yearEnd,used:used.yearEnd,left:budget.yearEnd-used.yearEnd},
    wfi:{total:budget.wfi,used:used.wfi,left:budget.wfi-used.wfi}};
}
export const tripInYear=(t,y)=>{const ys=String(y);return (t.depart||"").startsWith(ys)||(t.return||"").startsWith(ys)||(t.blocks||[]).some(b=>blockDays(b).some(d=>d.year===y));};
export const tripOn=(trips,ds)=>trips.find(t=>counts(t)&&t.depart&&t.return&&t.depart<=ds&&ds<=t.return)||null;

// Calendar: date -> {type, trip} for every day inside a counted trip (type is null on uncharged days).
export function dayMap(trips){
  const m=new Map();
  trips.filter(counts).forEach(t=>{
    if(t.depart&&t.return&&t.depart<=t.return) for(const d of eachDay(t.depart,t.return)) if(!m.has(d)) m.set(d,{type:null,trip:t});
    (t.blocks||[]).forEach(b=>{if(validBlock(b)) for(const d of eachDay(b.start,b.end)) m.set(d,{type:isWorkday(d)?b.type:null,trip:t});});
  });
  return m;
}

/* ---------- Checks ---------- */
export function problems(trips,leave,year){
  const out=[]; const seen=new Map();
  const yearTrips=trips.filter(t=>tripInYear(t,year));
  yearTrips.forEach(t=>{
    if(!t.depart||!t.return) out.push(`${t.title}: add travel dates.`);
    else if(t.depart>t.return) out.push(`${t.title}: return is before departure.`);
    (t.blocks||[]).forEach(b=>{
      if(!validBlock(b)){out.push(`${t.title}: a leave block has missing or reversed dates.`);return;}
      if(t.depart&&t.return&&(b.start<t.depart||b.end>t.return)) out.push(`${t.title}: a ${BLOCK_TYPES[b.type].toLowerCase()} block falls outside the travel dates.`);
      if(b.carry&&!carryOk(trips,b)) out.push(`${t.title}: carried-over days must directly follow the year-end block.`);
      if(counts(t)) blockDays(b).forEach(d=>{const prev=seen.get(d.date);if(prev&&prev.b!==b) out.push(`${fmt(d.date)} is charged twice (${prev.t===t.title?"two blocks in "+t.title:prev.t+" and "+t.title}).`);seen.set(d.date,{t:t.title,b});});
    });
  });
  const bal=balances(trips,leave,year);
  if(bal.flexible.left<0) out.push(`Vacation is over budget by ${-bal.flexible.left} day${bal.flexible.left===-1?"":"s"}.`);
  if(bal.yearEnd.left<0) out.push(`Year-end leave is over budget by ${-bal.yearEnd.left}.`);
  if(bal.wfi.left<0) out.push(`Work from India is over budget by ${-bal.wfi.left}.`);
  return [...new Set(out)];
}
const fmt=ds=>parseYmd(ds).toLocaleDateString(undefined,{day:"numeric",month:"short"});
// A carried-over block is fine when walking back over weekends and holidays from its start lands in a year-end block.
function carryOk(trips,b){
  let d=addDays(b.start,-1);
  for(let i=0;i<10&&!isWorkday(d);i++) d=addDays(d,-1);
  return trips.some(t=>(t.blocks||[]).some(x=>validBlock(x)&&x.type==="yearEnd"&&x.start<=d&&d<=x.end));
}

/* ---------- Bridges: cheap long breaks around holidays ---------- */
export function bridges(year){
  const start=`${year}-01-01`, end=`${year}-12-31`;
  const runs=[]; let cur=null;
  for(const d of eachDay(addDays(start,-3),addDays(end,3))){
    if(!isWorkday(d)){ if(cur&&addDays(cur.end,1)===d){cur.end=d;cur.hol=cur.hol||!!holidayName(d);} else {cur={start:d,end:d,hol:!!holidayName(d)};runs.push(cur);} }
  }
  const out=[];
  runs.forEach((r,i)=>{
    if(r.hol&&!isWeekendOnly(r)&&span(r.start,r.end)>=3) out.push({start:r.start,end:r.end,days:span(r.start,r.end),cost:0});
    for(let j=i+1;j<runs.length;j++){
      const cost=workdaysBetween(r.end,runs[j].start); if(cost>4) break;
      if(!(r.hol||runs[j].hol)) continue;
      out.push({start:r.start,end:runs[j].end,days:span(r.start,runs[j].end),cost});
    }
  });
  return out.filter(b=>b.start<=end&&b.end>=start&&(b.cost===0||(b.days>=4&&b.days/b.cost>=2.25)))
    .sort((a,b)=>a.start.localeCompare(b.start)||a.cost-b.cost);
}
const span=(a,b)=>Math.round((parseYmd(b)-parseYmd(a))/864e5)+1;
const isWeekendOnly=r=>{for(const d of eachDay(r.start,r.end)) if(holidayName(d)&&!isWeekend(d)) return false; return true;};
function workdaysBetween(a,b){let n=0;for(let d=addDays(a,1);d<b;d=addDays(d,1)) if(isWorkday(d)) n++;return n;}

/* ---------- Starting data: the 2027 plan ---------- */
export function draftPlan2027(){
  const rome={from:["MUC","NUE","FMM"],to:["FCO","CIA"]};
  return [
    {title:"Rome, end of January",kind:"rome",status:"planned",depart:"2027-01-30",return:"2027-02-01",
     blocks:[{type:"vacation",start:"2027-02-01",end:"2027-02-01"}],flex:{departFrom:"2027-01-23",departTo:"2027-02-06",nights:2},airports:rome,note:"Weekend plus Monday off."},
    {title:"Rome, three weeks later",kind:"rome",status:"planned",depart:"2027-02-20",return:"2027-02-22",
     blocks:[{type:"vacation",start:"2027-02-22",end:"2027-02-22"}],flex:{departFrom:"2027-02-13",departTo:"2027-02-27",nights:2},airports:rome,note:"Weekend plus Monday off."},
    {title:"India, summer",kind:"india",status:"planned",depart:"2027-05-15",return:"2027-06-06",
     blocks:[{type:"vacation",start:"2027-05-15",end:"2027-05-30"},{type:"wfi",start:"2027-05-31",end:"2027-06-06"}],
     flex:{departFrom:"2027-05-08",departTo:"2027-07-10",nights:22},airports:{from:["MUC"],to:["DEL"]},
     note:"Two weeks vacation, then one week working from India. Late May uses Whit Monday and Corpus Christi, so the vacation part costs 8 days instead of 10."},
    {title:"India, December",kind:"india",status:"planned",depart:"2027-12-09",return:"2028-01-01",
     blocks:[{type:"wfi",start:"2027-12-10",end:"2027-12-23"},{type:"yearEnd",start:"2027-12-24",end:"2027-12-31"}],
     flex:{departFrom:"2027-12-04",departTo:"2027-12-11",nights:23},airports:{from:["MUC"],to:["DEL"]},
     note:"Evening flight on Thursday 9 Dec. Ten WFI days, then the six year-end days. Unused vacation can extend this into January 2028."}
  ];
}

/* ---------- Flight date candidates ---------- */
// Departures inside the trip's flexibility window on the same weekday as the planned departure,
// keeping the same number of nights. Capped to `max` searches, always including the planned dates.
export function candidateDates(t,max=8){
  if(!t.depart||!t.return) return [];
  const f=t.flex||{}; const nights=Number(f.nights)||Math.round((parseYmd(t.return)-parseYmd(t.depart))/864e5);
  const from=f.departFrom||addDays(t.depart,-7), to=f.departTo||addDays(t.depart,7);
  const wd=parseYmd(t.depart).getDay(); let list=[];
  for(const d of eachDay(from,to)) if(parseYmd(d).getDay()===wd) list.push(d);
  if(!list.includes(t.depart)) list.push(t.depart);
  list.sort();
  if(list.length>max){
    const keep=new Set([t.depart]); const step=(list.length-1)/(max-1);
    for(let i=0;keep.size<max&&i<max;i++) keep.add(list[Math.round(i*step)]);
    list=list.filter(d=>keep.has(d));
  }
  return list.map(d=>({depart:d,return:addDays(d,nights)}));
}
// Move a whole trip (travel dates and leave blocks) by `delta` days.
export function shiftTrip(t,delta){
  const s=d=>d?addDays(d,delta):d;
  return {...t,depart:s(t.depart),return:s(t.return),blocks:(t.blocks||[]).map(b=>({...b,start:s(b.start),end:s(b.end)}))};
}
