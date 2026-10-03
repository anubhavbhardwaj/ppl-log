/* Weekly price check (Mondays 06:00 UTC). For every planned trip that is inside its booking window, or
   opens it within 14 days, search the trip's own dates once and refresh users/{uid}/fares/{tripId}:
   the result row, checkedAt, and a running price track. Writes a summary to users/{uid}/meta/jobs.
   Needs SERPAPI_KEY and FIREBASE_SERVICE_ACCOUNT. Stops early if SerpApi has fewer than 30 searches left. */
import {searchFare} from "./fares.mjs";
import {client,serviceAccount} from "./lib/firestore.mjs";
import {bookingAdvice,fareKey,flightPrefs,searchParams,searchDepart,candidateDates} from "../../js/leave.js";

const MAX_SEARCHES=10, MIN_LEFT=30;
const today=()=>new Date().toISOString().slice(0,10);

export async function runWeekly({fetchImpl=fetch,now=today()}={}){
  const key=process.env.SERPAPI_KEY; if(!key) throw new Error("SERPAPI_KEY isn't set.");
  const sa=serviceAccount(); const db=client(process.env.FIREBASE_PROJECT_ID||sa.project_id,fetchImpl);
  const acct=await (await fetchImpl("https://serpapi.com/account.json?api_key="+encodeURIComponent(key))).json().catch(()=>({}));
  let left=acct.plan_searches_left??acct.total_searches_left??Infinity;
  const trips=await db.collectionGroup("trips");
  const byUser={}; let used=0;
  for(const {path,data:t} of trips){
    const [, uid, , tripId]=path.split("/");
    const log=byUser[uid]=byUser[uid]||{checked:[],skipped:[]};
    if(t.status!=="planned"||!t.depart||t.depart<=now||!(t.airports?.from||[]).length||!(t.airports?.to||[]).length){continue;}
    const fares=await db.get(`users/${uid}/fares/${tripId}`);
    const sameKey=fares&&fares.key===fareKey(t);
    const own=searchDepart(t); const cand=candidateDates(t).find(c=>c.depart===own); if(!cand) continue;
    const row=sameKey?(fares.results||[]).find(r=>r.depart===own):null;
    const a=bookingAdvice(t,row,sameKey?fares.checkedAt:null,now);
    if(!a||!(a.state==="window"||a.state==="late"||a.state==="now"||(a.state==="early"&&a.days<=14))){log.skipped.push(t.title);continue;}
    const p=flightPrefs(t); const per=p.stops==="both"?2:1;
    if(used+per>MAX_SEARCHES||left-per<MIN_LEFT){log.skipped.push(t.title+" (search limit)");continue;}
    const dates={depart:cand.depart,ret:cand.return};
    let res;
    try{
      if(p.stops==="direct") res=await searchFare({...dates,...searchParams(t,"direct")},key,fetchImpl);
      else{
        res=await searchFare({...dates,...searchParams(t,"any")},key,fetchImpl); used++; left--;
        if(p.stops==="both"){
          if(res.price!=null&&res.stops===0) res.direct={price:res.price,airline:res.airline,url:res.url};
          else{const d=await searchFare({...dates,...searchParams(t,"direct")},key,fetchImpl);used++;left--;res.direct=d.price!=null?{price:d.price,airline:d.airline,url:d.url}:null;}
        }
      }
      if(p.stops==="direct"){used++;left--;}
    }catch(e){log.skipped.push(t.title+" ("+String(e.message).slice(0,60)+")");continue;}
    if(p.comparePremium&&used<MAX_SEARCHES&&left-1>=MIN_LEFT){
      try{const pe=await searchFare({...dates,...searchParams(t,p.stops==="direct"?"direct":"any"),travelClass:2},key,fetchImpl);used++;left--;
        res.pe=pe.price!=null?{price:pe.price,eff:pe.eff??pe.price,bag:pe.bag||"unknown",bagFee:pe.bagFee||0,airline:pe.airline,stops:pe.stops,via:pe.via||[],url:pe.url}:{price:null};}catch(e){}
    }
    const newRow={depart:cand.depart,return:cand.return,...res};
    const results=sameKey?(fares.results||[]).filter(r=>r.depart!==own).concat(newRow):[newRow];
    const track=(sameKey&&Array.isArray(fares.track)?fares.track:[]).concat(res.price!=null?[{d:now,p:res.eff??res.price}]:[]).slice(-30);
    await db.set(`users/${uid}/fares/${tripId}`,{...(sameKey?fares:{}),checkedAt:new Date().toISOString(),key:fareKey(t),mode:p.stops,avoidME:p.avoidME,results,track,auto:true});
    log.checked.push(`${t.title}: ${res.price!=null?"€"+res.price:"no flights"}`);
  }
  for(const [uid,log] of Object.entries(byUser)) await db.set(`users/${uid}/meta/jobs`,{weeklyAt:new Date().toISOString(),searches:used,checked:log.checked,skipped:log.skipped});
  return {searches:used,users:Object.keys(byUser).length,byUser};
}

export default async function handler(){
  try{const r=await runWeekly();console.log("weekly-fares",JSON.stringify(r));return new Response("ok");}
  catch(e){console.error("weekly-fares failed",e);return new Response(String(e.message||e),{status:500});}
}
export const config={schedule:"0 6 * * 1"};
