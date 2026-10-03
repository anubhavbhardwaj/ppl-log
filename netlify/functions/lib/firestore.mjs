/* Minimal Firestore REST client for Netlify functions, authenticated with a service account
   (env FIREBASE_SERVICE_ACCOUNT = the JSON key from Firebase console > Project settings > Service accounts).
   No dependencies: the OAuth assertion is signed with WebCrypto. */
const b64u=buf=>Buffer.from(buf).toString("base64url");
let cached=null;
export function serviceAccount(){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT; if(!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT isn't set.");
  const sa=JSON.parse(raw); if(!sa.client_email||!sa.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT is missing client_email or private_key.");
  return sa;
}
export async function accessToken(fetchImpl=fetch){
  if(cached&&cached.exp>Date.now()+60e3) return cached.token;
  const sa=serviceAccount(); const now=Math.floor(Date.now()/1000);
  const head=b64u(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const claim=b64u(JSON.stringify({iss:sa.client_email,scope:"https://www.googleapis.com/auth/datastore",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));
  const pem=sa.private_key.replace(/-----[^-]+-----/g,"").replace(/\s+/g,"");
  const key=await crypto.subtle.importKey("pkcs8",Buffer.from(pem,"base64"),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(head+"."+claim));
  const r=await fetchImpl("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:head+"."+claim+"."+b64u(sig)})});
  const j=await r.json(); if(!r.ok) throw new Error("Google token: "+(j.error_description||j.error||r.status));
  cached={token:j.access_token,exp:Date.now()+(j.expires_in||3600)*1000}; return cached.token;
}
// Firestore typed values <-> plain JSON
export function toFs(v){
  if(v===null||v===undefined) return {nullValue:null};
  if(typeof v==="boolean") return {booleanValue:v};
  if(typeof v==="number") return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
  if(typeof v==="string") return {stringValue:v};
  if(Array.isArray(v)) return {arrayValue:{values:v.map(toFs)}};
  return {mapValue:{fields:Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).map(([k,x])=>[k,toFs(x)]))}};
}
export function fromFs(v){
  if(!v) return null;
  if("nullValue" in v) return null;
  if("booleanValue" in v) return v.booleanValue;
  if("integerValue" in v) return Number(v.integerValue);
  if("doubleValue" in v) return v.doubleValue;
  if("stringValue" in v) return v.stringValue;
  if("timestampValue" in v) return v.timestampValue;
  if("arrayValue" in v) return (v.arrayValue.values||[]).map(fromFs);
  if("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,fromFs(x)]));
  return null;
}
export const docData=d=>fromFs({mapValue:{fields:d.fields||{}}});
export function client(projectId,fetchImpl=fetch){
  const base=`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const call=async(url,opt={})=>{const token=await accessToken(fetchImpl);
    const r=await fetchImpl(url,{...opt,headers:{authorization:"Bearer "+token,"content-type":"application/json",...(opt.headers||{})}});
    const j=await r.json().catch(()=>({})); if(!r.ok&&r.status!==404) throw new Error("Firestore "+r.status+": "+(j.error?.message||""));
    return r.status===404?null:j;};
  return {
    // All documents of a collection id anywhere in the database, e.g. every users/{uid}/trips/{id}.
    async collectionGroup(id){const res=await call(base+":runQuery",{method:"POST",body:JSON.stringify({structuredQuery:{from:[{collectionId:id,allDescendants:true}]}})});
      return (res||[]).filter(x=>x.document).map(x=>({path:x.document.name.split("/documents/")[1],data:docData(x.document)}));},
    async get(path){const d=await call(base+"/"+path);return d?docData(d):null;},
    async set(path,data){await call(base+"/"+path,{method:"PATCH",body:JSON.stringify({fields:toFs(data).mapValue.fields})});},
  };
}
