/* Shared helpers, UI state and the render hook. */
export const $=s=>document.querySelector(s);
export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const pad=n=>String(n).padStart(2,"0");
export const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
export const todayStr=()=>ymd(new Date());
export const WD=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
// Dates are handled as "YYYY-MM-DD" strings; noon avoids DST edge cases.
export const parseYmd=s=>new Date(s+"T12:00:00");
export const addDays=(s,n)=>{const d=parseYmd(s);d.setDate(d.getDate()+n);return ymd(d)};
export const daysBetween=(a,b)=>Math.round((parseYmd(b)-parseYmd(a))/864e5);
export const fmtDate=(s,o)=>parseYmd(s).toLocaleDateString(undefined,o||{weekday:"short",day:"numeric",month:"short"});
export function* eachDay(start,end){for(let d=start;d<=end;d=addDays(d,1)) yield d;}

export const ls={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
export function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2200)}
export async function guard(p){try{await p}catch(e){toast("Couldn't save. Check your connection and try again.");throw e}}

// UI state shared across modules. Tab and gym sub-view survive reloads.
export const UI={tab:ls.get("ppl_tab")||"today",gymView:ls.get("cad_gymview")||"plan",workout:null,preview:null,confirm:null,openLog:null,
  travelYear:ls.get("cad_year")||2027,editTrip:null,fareRun:null,openFares:new Set(),openTrip:null};
if(UI.tab==="plan"||UI.tab==="history"){UI.gymView=UI.tab;UI.tab="gym";}
if(!["today","gym","travel"].includes(UI.tab)) UI.tab="today";

// app.js sets the real render function; modules call bus.render() after state changes.
export const bus={render(){}};
