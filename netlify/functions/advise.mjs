/* Flight recommendation via Groq (free tier, open-weight model; default openai/gpt-oss-120b).
   POST /api/advise { trip, prefs, balances, options:[...], scorerPick }  (Firebase ID token required)
   -> { pick, headline, reasons, model, usage }
   The app's own scorer has already ranked the options; the model picks one of them and explains the trade-off.
   Env: GROQ_API_KEY (required), GROQ_MODEL (optional). */
import {verifyToken} from "./fares.mjs";

const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const MODEL=()=>process.env.GROQ_MODEL||"openai/gpt-oss-120b";

const SYSTEM=`You help one person choose flights for a trip. You get the trip, his preferences, his leave balances and a short list of flight options that were actually found on Google Flights, already ranked by a cost score.
The score is: fare in EUR + 120 per extra vacation day + 40 per extra work-from-India day + 35 per stop (lower is better). Negative leave numbers mean days saved.
His preferences: keep weekends free (with "weekendSaver" the searches only include Friday departures from 14:00 and Monday-morning arrivals back in Munich, so the Friday and Monday are workdays), no layovers in the Middle East when "avoidME" is on, and direct flights when "stops" is "direct".
Pick the single best option by index. Usually that is the lowest score, but you may prefer another if it is clearly better for him (for example a direct flight for a small premium, or keeping vacation days when the balance is low). Never invent flights, prices or dates that are not in the list.
Reply with JSON only: {"pick": <index>, "headline": "<one sentence, max 140 characters, with the dates and price>", "reasons": ["<short reason>", "<short reason>"]}.
Use at most 3 reasons, each under 110 characters, plain and specific with numbers. Do not use em dashes.`;

export async function askGroq(payload,key,fetchImpl=fetch){
  const body=(extra)=>JSON.stringify({model:MODEL(),temperature:0.2,max_completion_tokens:1500,response_format:{type:"json_object"},...extra,
    messages:[{role:"system",content:SYSTEM},{role:"user",content:JSON.stringify(payload)}]});
  let r=await fetchImpl("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json"},body:body({reasoning_effort:"low"})});
  if(r.status===400) r=await fetchImpl("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json"},body:body({})});
  const j=await r.json().catch(()=>({}));
  if(r.status===429) throw Object.assign(new Error("Groq's free limit is reached for now. Try again later."),{status:429});
  if(!r.ok) throw new Error("Groq: "+(j.error?.message||r.status));
  const text=j.choices?.[0]?.message?.content||"";
  let out; try{out=JSON.parse(text.slice(text.indexOf("{"),text.lastIndexOf("}")+1));}catch{throw new Error("Groq returned an unreadable answer.");}
  const n=(payload.options||[]).length;
  const pick=Number.isInteger(out.pick)&&out.pick>=0&&out.pick<n?out.pick:payload.scorerPick??0;
  const clean=s=>String(s||"").replace(/\s*[—–]\s*/g,", ").slice(0,200);
  return {pick,headline:clean(out.headline),reasons:(Array.isArray(out.reasons)?out.reasons:[]).slice(0,3).map(clean).filter(Boolean),
    model:j.model||MODEL(),usage:j.usage?{prompt:j.usage.prompt_tokens||0,completion:j.usage.completion_tokens||0,total:j.usage.total_tokens||0}:null};
}

export default async function handler(req,_ctx,fetchImpl=fetch){
  const key=process.env.GROQ_API_KEY;
  if(!key) return json(501,{error:"GROQ_API_KEY isn't set in Netlify environment variables."});
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  let user=null; try{user=await verifyToken(token,fetchImpl)}catch(e){return json(502,{error:"Couldn't check sign-in."})}
  if(!user) return json(401,{error:"Sign in again."});
  if(req.method!=="POST") return json(405,{error:"Use POST."});
  let b; try{b=await req.json()}catch{return json(400,{error:"Bad JSON."})}
  if(!Array.isArray(b.options)||!b.options.length) return json(400,{error:"No options to compare."});
  const payload={trip:b.trip||{},prefs:b.prefs||{},balances:b.balances||{},scorerPick:Number(b.scorerPick)||0,options:b.options.slice(0,10)};
  if(JSON.stringify(payload).length>12000) return json(400,{error:"Too much data."});
  try{return json(200,await askGroq(payload,key,fetchImpl));}
  catch(e){return json(e.status||502,{error:String(e.message||e).slice(0,200)});}
}
export const config={path:"/api/advise"};
