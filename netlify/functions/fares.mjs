/* Flight prices via SerpApi (Google Flights). The API key never leaves the server.
   POST /api/fares   { from:["MUC"], to:["FCO","CIA"], depart:"2027-01-30", return:"2027-02-01", adults?:1,
                       stops?:"any"|"direct"|"max1", excludeConns?:["DXB","DOH"], outboundTimes?:"14,23", returnTimes?:"0,23,0,8" }
                     -> { price, currency, airline, stops, via, duration, fromAirport, toAirport, departTime, url, level, typical }
   GET  /api/fares   -> { searchesLeft, searchesPerMonth, thisMonth }  (account info, free to call)
   Every request must carry a Firebase ID token for this project: Authorization: Bearer <token>.
   Env: SERPAPI_KEY (required), FIREBASE_PROJECT_ID (defaults to this project). */

const PROJECT=process.env.FIREBASE_PROJECT_ID||"ppl-log-d4461";
const JWKS_URL="https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const CODE=/^[A-Z]{3}$/, DATE=/^\d{4}-\d{2}-\d{2}$/;

const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});

/* ---------- Firebase ID token check (RS256, Google's public keys) ---------- */
let jwks=null, jwksAt=0;
async function keys(fetchImpl){
  if(!jwks||Date.now()-jwksAt>3600e3){const r=await fetchImpl(JWKS_URL);if(!r.ok)throw new Error("jwks");jwks=(await r.json()).keys;jwksAt=Date.now();}
  return jwks;
}
const b64u=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));
export async function verifyToken(token,fetchImpl=fetch,now=Date.now()/1000){
  const parts=String(token||"").split("."); if(parts.length!==3) return null;
  let header,payload;
  try{header=JSON.parse(new TextDecoder().decode(b64u(parts[0])));payload=JSON.parse(new TextDecoder().decode(b64u(parts[1])));}catch{return null}
  if(header.alg!=="RS256") return null;
  const jwk=(await keys(fetchImpl)).find(k=>k.kid===header.kid); if(!jwk) return null;
  const key=await crypto.subtle.importKey("jwk",{kty:jwk.kty,n:jwk.n,e:jwk.e,alg:"RS256",ext:true},{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const ok=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64u(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  if(!ok) return null;
  if(payload.aud!==PROJECT||payload.iss!=="https://securetoken.google.com/"+PROJECT) return null;
  if(!(payload.exp>now)||!(payload.iat<=now+300)||!payload.sub) return null;
  return payload;
}

/* ---------- SerpApi ---------- */
const STOPS={any:"0",direct:"1",max1:"2"};
// Google's price history for this exact search (~2 months of daily lowest prices) reduced to a few numbers.
export function histStats(ph){
  const pts=(Array.isArray(ph)?ph:[]).filter(p=>Array.isArray(p)&&typeof p[0]==="number"&&typeof p[1]==="number").sort((a,b)=>a[0]-b[0]);
  if(pts.length<3) return null;
  const prices=pts.map(p=>p[1]).sort((a,b)=>a-b), last=pts[pts.length-1];
  const ref=[...pts].reverse().find(p=>p[0]<=last[0]-14*86400)||pts[0];
  return {min:prices[0],max:prices[prices.length-1],median:prices[Math.floor(prices.length/2)],last:last[1],
    change14:ref[1]?Math.round((last[1]-ref[1])/ref[1]*100):0,days:Math.round((last[0]-pts[0][0])/86400)};
}
// Cheapest itinerary that respects the stop limit and avoids excluded layover airports.
// Google applies the same filters; this is a second check on what comes back.
// Baggage: Google Flights has no checked-bag filter, but results carry notes such as "Checked baggage for a fee"
// (typical of Light/basic fares). When a checked bag is needed, those fares get an estimated bag cost added
// (bagFee, return trip) before picking the cheapest, so a Light fare only wins if it is still cheaper with the bag.
const FEE=/checked bag(?:gage|s)?\s+(?:for a fee|not included)|no (?:free )?checked bag|carry-on (?:bag )?not included/i;
const INCL=/(?:\d+|one|two) (?:free )?checked bags?|checked bag(?:gage)? included|free checked bag/i;
export function bagInfo(f){
  const notes=[...(f.extensions||[]),...(f.flights||[]).flatMap(l=>l.extensions||[])].map(String);
  if(notes.some(n=>FEE.test(n))) return {bag:"fee",bagNote:notes.find(n=>FEE.test(n))};
  if(notes.some(n=>INCL.test(n))) return {bag:"included",bagNote:notes.find(n=>INCL.test(n))};
  return {bag:"unknown",bagNote:null};
}
function cheapest(data,{maxStops=Infinity,exclude=[],checkedBag=false,bagFee=0}={}){
  const bad=new Set(exclude);
  const all=[...(data.best_flights||[]),...(data.other_flights||[])].filter(f=>{
    if(typeof f.price!=="number") return false;
    const legs=f.flights||[]; const via=(f.layovers||[]).map(l=>l.id).filter(Boolean);
    return Math.max(0,legs.length-1)<=maxStops&&!via.some(c=>bad.has(c))&&!legs.slice(1).some(l=>bad.has(l.departure_airport?.id));
  });
  if(!all.length) return null;
  const eff=x=>x.price+(checkedBag&&bagInfo(x).bag==="fee"?bagFee:0);
  const f=all.reduce((a,b)=>eff(b)<eff(a)?b:a);
  const bi=bagInfo(f);
  const legs=f.flights||[]; const first=legs[0]||{}, last=legs[legs.length-1]||{};
  const pi=data.price_insights||{};
  const via=(f.layovers||[]).map(l=>l.id).filter(Boolean);
  return {price:f.price,airline:[...new Set(legs.map(l=>l.airline).filter(Boolean))].join(" + "),stops:Math.max(0,legs.length-1),
    via:via.length?via:legs.slice(1).map(l=>l.departure_airport?.id).filter(Boolean),
    duration:f.total_duration||null,fromAirport:first.departure_airport?.id||null,toAirport:last.arrival_airport?.id||null,
    departTime:first.departure_airport?.time||null,level:pi.price_level||null,typical:pi.typical_price_range||null,hist:histStats(pi.price_history),
    ...bi,bagFee:checkedBag&&bi.bag==="fee"?bagFee:0,eff:eff(f)};
}
const TIMES=/^\d{1,2},\d{1,2}(,\d{1,2},\d{1,2})?$/;
export async function searchFare({from,to,depart,ret,adults,stops="any",excludeConns=[],outboundTimes,returnTimes,carryOn=false,checkedBag=false,bagFee=0,travelClass=1},key,fetchImpl=fetch){
  const p={engine:"google_flights",departure_id:from.join(","),arrival_id:to.join(","),outbound_date:depart,return_date:ret,
    type:"1",currency:"EUR",gl:"de",hl:"en",adults:String(adults||1),stops:STOPS[stops]||"0"};
  if(carryOn) p.bags="1"; // carry-on fees are then included in the prices
  if(travelClass===2) p.travel_class="2"; // premium economy
  if(excludeConns.length&&stops!=="direct") p.exclude_conns=excludeConns.join(",");
  if(outboundTimes&&TIMES.test(outboundTimes)) p.outbound_times=outboundTimes;
  if(returnTimes&&TIMES.test(returnTimes)) p.return_times=returnTimes;
  const q=new URLSearchParams({...p,api_key:key});
  const r=await fetchImpl("https://serpapi.com/search.json?"+q);
  const data=await r.json().catch(()=>({}));
  if(!r.ok&&!data.error) throw new Error("SerpApi HTTP "+r.status);
  const url=data.search_metadata?.google_flights_url||null;
  if(data.error&&!/no results|hasn't returned any results/i.test(data.error)) throw new Error(data.error);
  const best=cheapest(data,{maxStops:stops==="direct"?0:stops==="max1"?1:Infinity,exclude:excludeConns,checkedBag,bagFee:Math.max(0,Math.min(400,Number(bagFee)||0))});
  return {...(best||{price:null}),currency:"EUR",url};
}

export default async function handler(req,_ctx,fetchImpl=fetch){
  const key=process.env.SERPAPI_KEY;
  if(!key) return json(500,{error:"SERPAPI_KEY isn't set in Netlify environment variables."});
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  let user=null; try{user=await verifyToken(token,fetchImpl)}catch(e){return json(502,{error:"Couldn't check sign-in."})}
  if(!user) return json(401,{error:"Sign in again."});

  if(req.method==="GET"){
    const r=await fetchImpl("https://serpapi.com/account.json?api_key="+encodeURIComponent(key));
    const a=await r.json().catch(()=>({}));
    if(!r.ok) return json(502,{error:a.error||"Couldn't read SerpApi account."});
    return json(200,{searchesLeft:a.plan_searches_left??a.total_searches_left??null,searchesPerMonth:a.searches_per_month??null,thisMonth:a.this_month_usage??null});
  }
  if(req.method!=="POST") return json(405,{error:"Use GET or POST."});
  let b; try{b=await req.json()}catch{return json(400,{error:"Bad JSON."})}
  const from=(b.from||[]).filter(x=>CODE.test(x)).slice(0,7), to=(b.to||[]).filter(x=>CODE.test(x)).slice(0,7);
  if(!from.length||!to.length) return json(400,{error:"Add departure and arrival airports."});
  if(!DATE.test(b.depart||"")||!DATE.test(b.return||"")||b.depart>b.return) return json(400,{error:"Check the dates."});
  const adults=Math.min(4,Math.max(1,Number(b.adults)||1));
  const stops=STOPS[b.stops]?b.stops:"any";
  const excludeConns=[...new Set((b.excludeConns||[]).filter(x=>CODE.test(x)))].slice(0,40);
  try{return json(200,await searchFare({from,to,depart:b.depart,ret:b.return,adults,stops,excludeConns,outboundTimes:b.outboundTimes,returnTimes:b.returnTimes,carryOn:!!b.carryOn,checkedBag:!!b.checkedBag,bagFee:b.bagFee,travelClass:Number(b.travelClass)===2?2:1},key,fetchImpl));}
  catch(e){return json(502,{error:String(e.message||e).slice(0,200)});}
}

export const config={path:"/api/fares"};
