/* Cadence service worker: makes the app installable and usable offline.
   Same-origin app files are network-first (so updates arrive immediately) with a cached fallback.
   The versioned Firebase SDK and Google Fonts are cache-first. /api/* and everything else (Firestore, Auth) pass through. */
const CACHE="cadence-v12";
const SHELL=["/","/index.html","/manifest.webmanifest","/firebase-config.js","/icon.svg","/icon-192.png","/icon-512.png","/icon-180.png",
  "/js/app.js","/js/util.js","/js/program.js","/js/store.js","/js/gym.js","/js/leave.js","/js/travel.js","/js/tobook.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  const req=e.request, url=new URL(req.url);
  if(req.method==="GET"&&(url.href.startsWith("https://www.gstatic.com/firebasejs/")||url.hostname==="fonts.googleapis.com"||url.hostname==="fonts.gstatic.com")){
    e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(req);if(hit)return hit;
      const res=await fetch(req);if(res.ok||res.type==="opaque")c.put(req,res.clone());return res;}));
    return;
  }
  if(req.method!=="GET"||url.origin!==location.origin||url.pathname.startsWith("/api/")||url.pathname.startsWith("/.netlify/")) return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const res=await fetch(req,{cache:"no-cache"});
      if(res.ok) cache.put(req.mode==="navigate"?"/index.html":req,res.clone());
      return res;
    }catch(err){
      return (await cache.match(req.mode==="navigate"?"/index.html":req,{ignoreSearch:true}))||Response.error();
    }
  })());
});
