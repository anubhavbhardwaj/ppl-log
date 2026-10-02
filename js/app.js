/* Cadence: app shell. Tabs: Today, Gym, Travel. */
import {$,esc,WD,ls,UI,bus} from "./util.js";
import {S,initStore,login,logout} from "./store.js";
import {gymToday,weekStrip,renderGym,bindGym,renderWorkout,bindWorkout} from "./gym.js";
import {travelToday,currentTrip,renderTravel,bindTravel} from "./travel.js";
import {tripOn} from "./leave.js";

document.querySelectorAll("#tabbar button").forEach(b=>b.addEventListener("click",()=>{
  UI.tab=b.dataset.tab;UI.preview=null;UI.confirm=null;UI.editTrip=null;ls.set("ppl_tab",UI.tab);render();window.scrollTo(0,0)}));

function render(){
  const app=$("#app"), bar=$("#tabbar");
  document.querySelectorAll("#tabbar button").forEach(b=>b.setAttribute("aria-current",String(b.dataset.tab===UI.tab)));
  bar.hidden=false;
  if(S.mode==="loading"){app.innerHTML=`<div class="stack"><h1>Cadence</h1><div class="card"><div class="label">Loading</div><p class="muted">Getting your training and travel.</p></div></div>`;bar.hidden=true;return;}
  if(S.mode==="signedout"){app.innerHTML=renderLogin();bar.hidden=true;bindLogin();return;}
  if(UI.workout){app.innerHTML=renderWorkout();bar.hidden=true;bindWorkout(app);return;}
  if(UI.tab==="gym") app.innerHTML=renderGym();
  else if(UI.tab==="travel") app.innerHTML=renderTravel();
  else app.innerHTML=renderToday();
  bindGym(app); bindTravel(app);
  app.querySelectorAll("[data-signout]").forEach(b=>b.onclick=()=>logout());
}
bus.render=render;

function renderToday(){
  const now=new Date();
  return `<div class="stack">
    <div class="spread"><h1>Cadence</h1><span class="small muted">${WD[now.getDay()]} ${now.toLocaleDateString(undefined,{day:"numeric",month:"short"})}</span></div>
    ${travelToday()}
    ${weekStrip(ds=>tripOn(S.trips,ds))}
    ${gymToday(currentTrip())}
    <div class="card"><div class="label">Your week</div><p class="small muted" style="margin:6px 0 0">Gym on Mon, Fri, Sat and Sun, in program order. Tue easy run, Wed home session, Thu run or mobility depending on what Friday holds. On trip days the program waits and you get a travel session instead.</p></div>
    <p class="small muted" style="text-align:center">Signed in as ${esc(S.user?.email||"")} · <button class="linkbtn small" data-signout>Sign out</button></p>
  </div>`;
}

function renderLogin(){
  return `<div class="stack" style="padding-top:8vh">
    <h1>Cadence</h1>
    <p class="muted">Training, leave and travel in one place. Sign in to continue.</p>
    <form id="login" class="card stack" novalidate>
      <div><label class="label" for="email">Email</label><input id="email" type="email" autocomplete="username" required class="field"></div>
      <div><label class="label" for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required class="field"></div>
      <p id="login-err" class="small" style="color:var(--push);margin:0" hidden></p>
      <button class="btn primary block" type="submit">Sign in</button>
    </form></div>`;
}
function bindLogin(){
  $("#login").addEventListener("submit",async ev=>{ev.preventDefault();const err=$("#login-err");err.hidden=true;
    const btn=ev.target.querySelector("button");btn.disabled=true;
    try{await login($("#email").value.trim(),$("#pw").value);}
    catch(e){err.textContent=(e.code==="auth/invalid-credential"||e.code==="auth/wrong-password"||e.code==="auth/user-not-found")?"Email or password is wrong.":e.code==="auth/too-many-requests"?"Too many attempts. Wait a minute and try again.":"Couldn't sign in. Check your connection.";err.hidden=false;btn.disabled=false;}
  });
}

initStore(render);
