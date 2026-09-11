"use client";
import {useEffect, useRef} from "react";

type Event = Record<string, string | number>;
type Task = {id?:string;kind?:string;status?:string};
const active=new Set(["queued","running","reconciling"]);
const kindOf=(kind:string)=>kind==="deep_match"?"evaluate":kind==="ingest"?"analysis":kind==="cv_review"?"cv":["analysis","search","evaluate","cv"].includes(kind)?kind:"";
export function createAnalytics(profile:string) {
  const sessionId=crypto.randomUUID();
  let page="",started=0,depth=0,queue:Event[]=[],sending=false;
  const waits=new Map<string,{kind:string;start:number}>();
  const done=new Set<string>();
  const emit=(event:string,fields:Event={})=>{
    if(!profile)return;
    queue.push({id:crypto.randomUUID(),sessionId,timestamp:Date.now(),event,page:page||"onboarding_email",...fields});
    if(queue.length>200)queue.shift();
  };
  const flush=async()=>{
    if(sending||!queue.length||!profile)return;
    sending=true;
    const batch=queue.slice(0,50);
    try {
      const response=await fetch("/api/analytics",{method:"POST",credentials:"same-origin",keepalive:true,
        headers:{"Content-Type":"application/json","X-JobPilot-Profile":profile},body:JSON.stringify({events:batch})});
      if(response.ok)queue=queue.filter(e=>!batch.includes(e));
    }catch{/* Analytics never blocks a product action. */}
    finally{sending=false;}
  };
  const endWaits=()=>{
    for(const value of waits.values())emit("ai_wait",{kind:value.kind,status:"abandoned",durationMs:Math.round(performance.now()-value.start)});
    waits.clear();
  };
  const heartbeat=()=>{if(started){emit("page_heartbeat",{durationMs:Math.round(performance.now()-started),scrollDepth:depth});started=performance.now();}};
  const leave=()=>{
    if(started)emit("page_exit",{durationMs:Math.round(performance.now()-started),scrollDepth:depth});
    started=0;endWaits();void flush();
  };
  const enter=(next:string)=>{
    if(page===next&&started)return;
    if(started)emit("page_exit",{durationMs:Math.round(performance.now()-started),scrollDepth:depth});
    started=0;page=next;depth=0;
    if(!document.hidden){started=performance.now();emit("page_enter");}
  };
  const step=(step:string)=>emit("funnel",{step});
  const tasks=(values:Task[])=>{
    if(document.hidden)return;
    for(const task of values){
      const kind=kindOf(task.kind||""),id=task.id;
      if(!kind||!id||done.has(id))continue;
      if(active.has(task.status||"")&&!waits.has(id))waits.set(id,{kind,start:performance.now()});
      if(["completed","failed","interrupted"].includes(task.status||"")&&waits.has(id)){
        const wait=waits.get(id)!;
        emit("ai_wait",{kind,status:task.status==="completed"?"completed":"failed",durationMs:Math.round(performance.now()-wait.start)});
        waits.delete(id);done.add(id);
      }
    }
  };
  const begin=(id:string,kind:string)=>{const normalized=kindOf(kind);if(normalized&&!waits.has(id))waits.set(id,{kind:normalized,start:performance.now()});};
  const bind=(id:string,task:Task)=>{
    const waiting=waits.get(id);
    if(!waiting)return;
    waits.delete(id);
    if(task.id){waits.set(task.id,waiting);tasks([task]);}
    else{emit("ai_wait",{kind:waiting.kind,status:"failed",durationMs:Math.round(performance.now()-waiting.start)});}
  };
  const click=(event:MouseEvent)=>{
    const el=(event.target as Element)?.closest?.("button,a,summary,[role=tab],input[type=checkbox],select");
    if(!el)return;
    // Never collect textContent, field values, href, or user-provided labels.
    const explicit=el.getAttribute("data-analytics")||el.getAttribute("data-testid");
    const siblings=el.parentElement?.querySelectorAll("button,a,summary,[role=tab],input[type=checkbox],select");
    const index=siblings?Array.from(siblings).indexOf(el):0;
    const region=el.closest("[data-testid]")?.getAttribute("data-testid")||Array.from(el.parentElement?.classList||[]).find(c=>c.startsWith("jp-"))||"control";
    const action=explicit&&/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(explicit)?explicit:(region+"_"+el.tagName.toLowerCase()+"_"+index).replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,64);
    emit("click",{action:action.toLowerCase()});
  };
  const scroll=(event:globalThis.Event)=>{
    const el=event.target===document?document.scrollingElement:event.target;
    if(!(el instanceof Element))return;
    const max=el.scrollHeight-el.clientHeight;
    if(max<=0)return;
    const current=Math.min(100,Math.floor(el.scrollTop/max*4)*25);
    if(current>depth){depth=current;emit("scroll",{scrollDepth:depth});}
  };
  let disposed=false;
  const visible=()=>{if(document.hidden)leave();else if(page&&!disposed){started=performance.now();emit("page_enter");}};
  let ticks=0;
  const timer=setInterval(()=>{if(++ticks%3===0)heartbeat();void flush();},5000);
  document.addEventListener("click",click,true);document.addEventListener("scroll",scroll,true);
  document.addEventListener("visibilitychange",visible);window.addEventListener("pagehide",leave);
  return {emit,step,enter,tasks,begin,bind,flush,dispose:()=>{
    leave();disposed=true;clearInterval(timer);document.removeEventListener("click",click,true);document.removeEventListener("scroll",scroll,true);
    document.removeEventListener("visibilitychange",visible);window.removeEventListener("pagehide",leave);
  }};
}
export function useAnalytics(profile:string) {
  const ref=useRef<ReturnType<typeof createAnalytics>|null>(null);
  useEffect(()=>{ref.current=createAnalytics(profile);return()=>{ref.current?.dispose();ref.current=null;};},[profile]);
  return ref;
}
