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
    if(t.status!=="idea"){const u=unchargedWorkdays(t);if(u.length) out.push(`${t.title}: ${u.map(fmt).join(", ")} ${u.length===1?"is a workday":"are workdays"} with no leave booked.`);}
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

/* ---------- Flight search preferences (shared by the app and the weekly server check) ---------- */
// Gulf and wider Middle East hubs, excluded as layovers when "Avoid Middle East layovers" is on.
export const ME_HUBS=["DXB","DWC","AUH","SHJ","DOH","BAH","KWI","MCT","SLL","RUH","JED","DMM","MED","AMM","AQJ","TLV","BEY","BGW","BSR","EBL","ISU","IKA","THR","MHD","SYZ","DAM","CAI","HBE","SSH","HRG","ADE","SAH"];
// Weekend-saver: leave Friday from 14:00, land back Monday by 09:00 (SerpApi outbound_times / return_times).
export const WS_TIMES={outbound:"14,23",ret:"0,23,0,8"};
// Weekend-saver is a strict time filter (it hides connections that land later, e.g. via Helsinki), so it is off
// unless switched on for a trip.
// Bags: long-haul trips need a checked bag by default; in Europe it is optional. Carry-on is always assumed, so
// carry-on fees (low-cost airlines) are included in prices.
export const longHaul=t=>!(t.kind==="rome"||t.kind==="europe");
export const BAG_FEE={long:140,short:80}; // estimated checked-bag cost for a return trip, added to fares sold without one
// Premium economy: compared on long-haul by default, and preferred when it costs at most premiumBonus (EUR) more
// than economy, both including bags.
export const flightPrefs=t=>({stops:"any",avoidME:true,weekendSaver:false,checkedBag:longHaul(t),carryOn:true,comparePremium:longHaul(t),premiumBonus:100,...(t.flights||{})});
export const PREMIUM_TOP=3; // premium economy is searched for the best 3 economy dates plus the trip's own dates
export const fareKey=t=>{const p=flightPrefs(t);const n=t.depart&&t.return?searchNights(t):"";
  return `${(t.airports?.from||[]).join(",")}>${(t.airports?.to||[]).join(",")}|${n}|${p.stops}|${p.avoidME?1:0}${p.weekendSaver?"|ws":""}|bag${p.checkedBag?1:0}${p.carryOn?1:0}${p.comparePremium?"|pe":""}`;};
// Search parameters for /api/fares, minus the dates.
export function searchParams(t,stops){
  const p=flightPrefs(t); const out={from:t.airports.from,to:t.airports.to,stops};
  if(stops!=="direct"&&p.avoidME) out.excludeConns=ME_HUBS;
  if(p.weekendSaver){out.outboundTimes=WS_TIMES.outbound;out.returnTimes=WS_TIMES.ret;}
  out.carryOn=!!p.carryOn; out.checkedBag=!!p.checkedBag; out.bagFee=longHaul(t)?BAG_FEE.long:BAG_FEE.short;
  return out;
}
const dow=d=>parseYmd(d).getDay();
// Nearest Friday: Tue-Thu move forward, Sat-Mon move back (a Thursday-evening flight becomes Friday).
export const nearestFriday=d=>{const f=(5-dow(d)+7)%7;return addDays(d,f<=3?f:f-7);};
export const mondayOnOrAfter=d=>addDays(d,(8-dow(d))%7);
// The departure date the trip's own dates correspond to in a search (Friday when weekend-saver is on).
export const searchDepart=t=>flightPrefs(t).weekendSaver&&t.depart?nearestFriday(t.depart):t.depart;
// Length of the searched trip: Friday to Monday with weekend-saver, otherwise exactly the trip's own nights.
export function searchNights(t){
  const days=(a,b)=>Math.round((parseYmd(b)-parseYmd(a))/864e5);
  if(flightPrefs(t).weekendSaver) return days(nearestFriday(t.depart),mondayOnOrAfter(t.return));
  return days(t.depart,t.return);
}

/* ---------- Flight date candidates ---------- */
// Departures inside the trip's flexibility window on the same weekday as the planned departure, keeping the
// trip's own length. With weekend-saver: Friday departures and Monday returns instead.
// Capped to `max` searches, always including the trip's own dates.
export function candidateDates(t,max=8){
  if(!t.depart||!t.return) return [];
  const f=t.flex||{}; const ws=flightPrefs(t).weekendSaver;
  let from=f.departFrom||addDays(t.depart,-7), to=f.departTo||addDays(t.depart,7);
  const own=searchDepart(t);
  // Options keep the trip's shape: same departure weekday, same length, so the same return weekday and the same
  // leave days (a Sat-Mon trip with a Monday vacation day is only compared with other Sat-Mon weekends).
  const len=searchNights(t);
  if(ws) from=addDays(from,-1);
  const wd=dow(own); let list=[];
  for(const d of eachDay(from,to)) if(dow(d)===wd) list.push(d);
  if(!list.includes(own)) list.push(own);
  list.sort();
  if(list.length>max){
    const keep=new Set([own]); const step=(list.length-1)/(max-1);
    for(let i=0;keep.size<max&&i<max;i++) keep.add(list[Math.round(i*step)]);
    list=list.filter(d=>keep.has(d));
  }
  return list.map(d=>({depart:d,return:addDays(d,len)}));
}
export function shiftTrip(t,delta){
  const s=d=>d?addDays(d,delta):d;
  return {...t,depart:s(t.depart),return:s(t.return),blocks:(t.blocks||[]).map(b=>({...b,start:s(b.start),end:s(b.end)}))};
}
// Move a trip to a searched option. Normal: shift everything by the difference.
// Weekend-saver: leave blocks move by whole weeks and are clipped to the days between the Friday departure and
// the Monday-morning return, because both of those days are worked.
export function moveTrip(t,depart,ret){
  if(!flightPrefs(t).weekendSaver) return shiftTrip(t,Math.round((parseYmd(depart)-parseYmd(t.depart))/864e5));
  const wk=Math.round((parseYmd(depart)-parseYmd(nearestFriday(t.depart)))/864e5/7)*7;
  const lo=addDays(depart,1), hi=addDays(ret,-1);
  const blocks=(t.blocks||[]).map(b=>({...b,start:addDays(b.start,wk),end:addDays(b.end,wk)}))
    .map(b=>({...b,start:b.start<lo?lo:b.start,end:b.end>hi?hi:b.end})).filter(b=>b.start<=b.end);
  return {...t,depart,return:ret,blocks};
}

// Workdays inside the trip that no leave block covers. The departure day is allowed (work, then an evening flight);
// the return day and everything in between need leave, except weekend-saver's Monday-morning return.
export function unchargedWorkdays(t){
  if(!t.depart||!t.return||t.depart>t.return) return [];
  const covered=new Set(); (t.blocks||[]).forEach(b=>{if(b.start&&b.end) for(const d of eachDay(b.start,b.end)) covered.add(d);});
  const ws=flightPrefs(t).weekendSaver; const out=[];
  for(const d of eachDay(t.depart,t.return)){
    if(!isWorkday(d)||covered.has(d)) continue;
    if(d===t.depart&&d!==t.return) continue;
    if(ws&&d===t.return&&dow(d)===1) continue;
    out.push(d);
  }
  return out;
}

/* ---------- Scorer ----------
   Ranks searched options by total cost: fare (including the estimated bag fee when a checked bag is needed and
   the fare has none; premium economy minus the "prefer premium" allowance) + leave it uses + stops. A vacation day is valued at €120,
   a work-from-India day at €40 (both budgets are limited), each stop at €35. Lowest score wins. */
export const SCORE={vacation:120,yearEnd:120,wfi:40,stop:35};
export function scoreOptions(t,rows){
  const base=tripCounts(t,null);
  const p=flightPrefs(t); const bonus=Number(p.premiumBonus)||0;
  return rows.filter(r=>r.price!=null||(r.pe&&r.pe.price!=null)).map(r=>{
    const eco=r.price!=null?(r.eff??r.price):Infinity;
    const pe=r.pe&&r.pe.price!=null?(r.pe.eff??r.pe.price):Infinity;
    // Premium wins when it is within the bonus of economy; it is ranked at its price minus the bonus.
    const cabin=p.comparePremium&&pe-bonus<=eco?"premium":"economy";
    const fare=cabin==="premium"?pe-bonus:eco;
    const m=moveTrip(t,r.depart,r.return); const c=tripCounts(m,null);
    const leave={vacation:c.vacation-base.vacation,yearEnd:c.yearEnd-base.yearEnd,wfi:c.wfi-base.wfi};
    const score=fare+leave.vacation*SCORE.vacation+leave.yearEnd*SCORE.yearEnd+leave.wfi*SCORE.wfi+(r.stops||0)*SCORE.stop;
    return {...r,leave,cabin,cabinPrice:cabin==="premium"?pe:eco,score:Math.round(score)};
  }).sort((a,b)=>a.score-b.score);
}

/* ---------- When to book ----------
   Booking windows (days before departure) from Google Flights data and fare-tracker guidance:
   short-haul Europe is usually cheapest 5 to 12 weeks out; long-haul 7 weeks to 6 months, earlier for peak
   periods (Indian peak seasons: Diwali Oct-Nov, Christmas and winter Dec-Jan, summer holidays May-Jun).
   The live signal from the last price check can override: a low price says book now, a rising trend
   shortens the countdown. */
export function bookingWindow(t){
  if(t.kind==="rome"||t.kind==="europe") return {open:84,close:35,why:"Short-haul Europe: fares usually bottom out 5 to 12 weeks before departure."};
  const m=Number((t.depart||"").slice(5,7));
  if([10,11,12,1,5,6].includes(m)) return {open:210,close:70,why:"Long-haul in peak season: book 10 weeks to 7 months ahead."};
  return {open:180,close:49,why:"Long-haul: fares are usually lowest 7 weeks to 6 months ahead."};
}
// row: the last price-check result for the trip's current dates ({price, level, typical, hist}); checkedAt: ISO time.
export function bookingAdvice(t,row,checkedAt,today){
  if(!t.depart||t.depart<=today) return null;
  if(t.status==="booked") return {state:"booked",badge:"Booked"};
  const w=bookingWindow(t); const open=addDays(t.depart,-w.open), close=addDays(t.depart,-w.close);
  const dleft=d=>Math.round((parseYmd(d)-parseYmd(today))/864e5);
  const reasons=[w.why];
  let low=false, rising=false, falling=false;
  const fresh=checkedAt&&dleft(checkedAt.slice(0,10))>=-7;
  if(row&&row.price!=null){
    low=row.level==="low"||(row.typical&&row.price<=row.typical[0])||(row.hist&&row.price<=row.hist.min*1.03);
    if(row.hist){rising=row.hist.change14>=5;falling=row.hist.change14<=-5;}
  }
  const base={open,close,why:w.why,low,rising,falling,fresh:!!fresh,reasons};
  if(today<open){
    if(low&&fresh) return {...base,state:"now",badge:"Unusually low",days:null,headline:"Unusually low fare for this route, consider booking now"};
    const d=dleft(open); return {...base,state:"early",days:d,badge:`Watch in ${d} d`,headline:`${d} days until the booking window opens`};
  }
  if(today<=close){
    if(low&&fresh) return {...base,state:"now",badge:"Book now",days:0,headline:"Book now: the price is low for this route"};
    let d=dleft(close); if(rising&&fresh) d=Math.min(d,7);
    return {...base,state:"window",days:d,badge:`Book in ${d} d`,headline:`Book within ${d} day${d===1?"":"s"}`};
  }
  return {...base,state:"late",days:0,badge:"Book now",headline:"Book now: fares usually rise from here"};
}
