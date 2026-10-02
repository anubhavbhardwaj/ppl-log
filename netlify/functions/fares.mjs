/* Flight prices via SerpApi (Google Flights). The API key never leaves the server.
   POST /api/fares   { from:["MUC"], to:["FCO","CIA"], depart:"2027-01-30", return:"2027-02-01", adults?:1 }
                     -> { price, currency, airline, stops, duration, fromAirport, toAirport, departTime, url, level, typical }
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
function cheapest(data){
  const all=[...(data.best_flights||[]),...(data.other_flights||[])].filter(f=>typeof f.price==="number");
  if(!all.length) return null;
  const f=all.reduce((a,b)=>b.price<a.price?b:a);
  const legs=f.flights||[]; const first=legs[0]||{}, last=legs[legs.length-1]||{};
  const pi=data.price_insights||{};
  return {price:f.price,airline:[...new Set(legs.map(l=>l.airline).filter(Boolean))].join(" + "),stops:Math.max(0,legs.length-1),
    duration:f.total_duration||null,fromAirport:first.departure_airport?.id||null,toAirport:last.arrival_airport?.id||null,
    departTime:first.departure_airport?.time||null,level:pi.price_level||null,typical:pi.typical_price_range||null};
}
export async function searchFare({from,to,depart,ret,adults},key,fetchImpl=fetch){
  const q=new URLSearchParams({engine:"google_flights",departure_id:from.join(","),arrival_id:to.join(","),outbound_date:depart,return_date:ret,
    type:"1",currency:"EUR",gl:"de",hl:"en",adults:String(adults||1),api_key:key});
  const r=await fetchImpl("https://serpapi.com/search.json?"+q);
  const data=await r.json().catch(()=>({}));
  if(!r.ok&&!data.error) throw new Error("SerpApi HTTP "+r.status);
  const url=data.search_metadata?.google_flights_url||null;
  if(data.error&&!/no results|hasn't returned any results/i.test(data.error)) throw new Error(data.error);
  const best=cheapest(data);
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
  try{return json(200,await searchFare({from,to,depart:b.depart,ret:b.return,adults},key,fetchImpl));}
  catch(e){return json(502,{error:String(e.message||e).slice(0,200)});}
}

export const config={path:"/api/fares"};
