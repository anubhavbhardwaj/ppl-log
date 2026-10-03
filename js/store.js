/* Firebase Auth + Firestore. Everything lives under users/{uid}/:
   meta/state   gym program position { next }
   logs/*       finished gym and office-day sessions
   trips/*      trips with leave blocks, flight flexibility and airports
   leave/{year} leave budgets { vacation, wfi, yearEnd }
   fares/{tripId} last flight price check for a trip (plus weekly track and AI advice)
   usage/{YYYY-MM} Groq requests and tokens; meta/jobs last weekly server check */
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,doc,collection,onSnapshot,setDoc,addDoc,deleteDoc,getDoc,writeBatch} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {firebaseConfig} from "../firebase-config.js";
import {toast} from "./util.js";

export const DEFAULT_NEXT=1;
// Program start: Push #1 Week 1 was done on Fri 2 Oct 2026, so the first session to log is Pull #1 Week 1.
const START={doneSeq:0,doneDate:"2026-10-02"};

export const S={state:{next:DEFAULT_NEXT},logs:[],trips:[],leave:{},fares:{},usage:{},jobs:null,mode:"loading",user:null};

const fbApp=initializeApp(firebaseConfig);
const auth=getAuth(fbApp);
const fdb=initializeFirestore(fbApp,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
let unsubs=[];
const uref=(...p)=>doc(fdb,"users",S.user.uid,...p);
const ucol=(...p)=>collection(fdb,"users",S.user.uid,...p);

export function initStore(onChange){
  onAuthStateChanged(auth,async u=>{
    unsubs.forEach(f=>f()); unsubs=[];
    if(!u){S.user=null;S.mode="signedout";S.logs=[];S.trips=[];S.leave={};S.fares={};S.usage={};S.jobs=null;onChange();return;}
    S.user=u; S.mode="loading"; onChange();
    try{
      const st=await getDoc(uref("meta","state"));
      if(!st.exists()){
        const b=writeBatch(fdb);
        b.set(uref("meta","state"),{next:START.doneSeq+1,createdAt:new Date().toISOString()});
        b.set(doc(ucol("logs"),"seed-push1-w1"),{type:"gym",seq:START.doneSeq,week:1,day:"push1",date:START.doneDate,ts:START.doneDate+"T06:00:00.000Z",untracked:true,exercises:[],note:""});
        await b.commit();
      }
    }catch(e){console.error(e)}
    let gotState=false,gotLogs=false;
    const ready=()=>{if(gotState&&gotLogs){S.mode="db";onChange();}};
    const fail=()=>toast("Couldn't load your data");
    unsubs.push(onSnapshot(uref("meta","state"),s=>{S.state=s.exists()?s.data():{next:DEFAULT_NEXT};gotState=true;ready()},fail));
    unsubs.push(onSnapshot(ucol("logs"),q=>{S.logs=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date+(b.ts||"")).localeCompare(a.date+(a.ts||"")));gotLogs=true;ready()},fail));
    unsubs.push(onSnapshot(ucol("trips"),q=>{S.trips=q.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.depart||"").localeCompare(b.depart||""));if(S.mode==="db")onChange()},fail));
    unsubs.push(onSnapshot(ucol("fares"),q=>{S.fares={};q.docs.forEach(d=>S.fares[d.id]=d.data());if(S.mode==="db")onChange()},fail));
    unsubs.push(onSnapshot(ucol("usage"),q=>{S.usage={};q.docs.forEach(d=>S.usage[d.id]=d.data());if(S.mode==="db")onChange()},fail));
    unsubs.push(onSnapshot(uref("meta","jobs"),d=>{S.jobs=d.exists()?d.data():null;if(S.mode==="db")onChange()},fail));
    unsubs.push(onSnapshot(ucol("leave"),q=>{S.leave={};q.docs.forEach(d=>S.leave[d.id]=d.data());if(S.mode==="db")onChange()},fail));
  });
}
export const login=(email,pw)=>signInWithEmailAndPassword(auth,email,pw);
export const logout=()=>signOut(auth);

export async function saveState(st){S.state=st;await setDoc(uref("meta","state"),st);}
export async function addLog(log){log.ts=new Date().toISOString();await addDoc(ucol("logs"),log);}
export async function removeLog(id){await deleteDoc(uref("logs",id));}
export async function setLog(id,data){const {id:_,...d}=data;await setDoc(uref("logs",id),JSON.parse(JSON.stringify(d)));}

const newId=()=>"t"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
export async function saveTrip(trip){
  const {id,...data}=trip; data.updatedAt=new Date().toISOString();
  await setDoc(uref("trips",id||newId()),data);
}
export async function removeTrip(id){await deleteDoc(uref("trips",id));try{await deleteDoc(uref("fares",id))}catch(e){}}
export async function saveFares(tripId,data){await setDoc(uref("fares",tripId),data);}
export async function bumpUsage(month,add){const cur=S.usage[month]||{};const next={...cur};for(const k in add) next[k]=(Number(cur[k])||0)+add[k];S.usage[month]=next;await setDoc(uref("usage",month),next);}
export const idToken=()=>auth.currentUser?auth.currentUser.getIdToken():Promise.reject(new Error("signed out"));
export async function saveLeave(year,budget){await setDoc(uref("leave",String(year)),budget);}
export async function seedTrips(trips,year,budget){
  const b=writeBatch(fdb);
  trips.forEach(t=>b.set(uref("trips",newId()),{...t,updatedAt:new Date().toISOString()}));
  if(budget) b.set(uref("leave",String(year)),budget);
  await b.commit();
}
