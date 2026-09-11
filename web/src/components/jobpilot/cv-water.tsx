"use client";
import {useEffect, useRef, useState} from "react";
import {estimatedProgress} from "@/lib/v1-progress.mjs";
import type {Json} from "./pilot-context";
import "./cv-water.css";

export function useCvWaterProgress(progress:Json, enabled:boolean, paused:boolean) {
  const started=useRef(Date.now()),wasEnabled=useRef(false);
  if(enabled&&!wasEnabled.current)started.current=Date.now();
  wasEnabled.current=enabled;
  const [now,setNow]=useState(()=>Date.now());
  const status=progress.status || "running";
  useEffect(()=>{
    if(!enabled)return;
    setNow(Date.now());
    if(paused||status==="completed")return;
    const timer=setInterval(()=>setNow(Date.now()),80);
    return()=>clearInterval(timer);
  },[enabled,paused,status,progress.id,progress.createdAt]);
  const start=Date.parse(progress.createdAt || "")||started.current;
  const end=paused?(Date.parse(progress.updatedAt || "")||now):now;
  return Math.round(estimatedProgress(Math.max(0,(end-start)/1000),status,55)*100);
}

export function CvAnalysisWater({percent,paused,complete}:{percent:number;paused:boolean;complete:boolean}) {
  const wave="M0 20 Q75 0 150 20 T300 20 T450 20 T600 20 T750 20 T900 20 T1050 20 T1200 20 V40 H0 Z";
  return <div className={`jp-cv-water${paused?" paused":""}${complete?" complete":""}`} aria-hidden="true" data-testid="cv-water" data-level={percent}>
    <div className="jp-cv-water-level" style={{transform:`translateY(${100-percent}%)`}}>
      <svg className="jp-cv-wave back" viewBox="0 0 1200 40" preserveAspectRatio="none"><path d={wave}/></svg>
      <svg className="jp-cv-wave front" viewBox="0 0 1200 40" preserveAspectRatio="none"><path d={wave}/></svg>
    </div>
  </div>;
}
