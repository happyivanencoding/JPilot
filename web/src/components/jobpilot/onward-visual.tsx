"use client";
import {useEffect,useMemo,useState,type ReactNode} from "react";
import {BarChart3,BookOpen,BriefcaseBusiness,Building2,Check,ChevronRight,Compass,FileText,Landmark,Layers3,Leaf,LineChart,MapPin,Megaphone,Target,Workflow} from "lucide-react";
import {usePilot} from "./pilot-context";

const iconForDirection=(value:string)=>{
 const s=value.toLowerCase();
 if(/data|anal|insight|bi\b/.test(s))return BarChart3;
 if(/invest|asset|research|market|trading/.test(s))return Landmark;
 if(/esg|sustain|climat|impact/.test(s))return Leaf;
 if(/market|brand|communicat|growth/.test(s))return Megaphone;
 if(/operation|supply|process|project/.test(s))return Workflow;
 if(/finance|bank|risk|quant/.test(s))return LineChart;
 if(/product|strategy|stratég|consult/.test(s))return Compass;
 if(/design|ux|tech|engineer/.test(s))return Layers3;
 return Target;
};

export function DirectionMedallion({label}:{label:string}){const Icon=iconForDirection(label);return <span className="onward-medallion" aria-hidden="true"><Icon size={18}/></span>}
export function CompanyMark({company}:{company:string}){const initial=(company.trim().match(/[\p{L}\p{N}]/u)?.[0]||"O").toUpperCase();const tone=useMemo(()=>[...company].reduce((a,c)=>a+c.codePointAt(0)!,0)%4,[company]);return <span className={`onward-company-mark tone-${tone}`} aria-hidden="true">{initial}</span>}
export function MatchLabel({value}:{value:unknown}){const {tr}=usePilot();const n=Number(value);const label=!Number.isFinite(n)?tr("待匹配","À explorer","Explore"):n>=85?tr("非常匹配","Très bon match","Very strong match"):n>=70?tr("匹配","Pertinent","Relevant"):tr("可探索","À explorer","Explore");return <span className="onward-match-label">{label}</span>}
export function MetaRow({location,contract}:{location?:string;contract?:string}){return <span className="onward-meta-row">{location&&<span><MapPin size={13}/>{location}</span>}{contract&&<span><BriefcaseBusiness size={13}/>{contract}</span>}</span>}
export function SemanticRow({kind="check",title,detail,chevron=false}:{kind?:"check"|"gap"|"document"|"company"|"book";title:string;detail?:string;chevron?:boolean}){const Icon=kind==="gap"?LineChart:kind==="document"?FileText:kind==="company"?Building2:kind==="book"?BookOpen:Check;return <div className={`onward-semantic-row ${kind}`}><span className="onward-semantic-icon"><Icon size={16}/></span><span className="onward-semantic-copy"><strong>{title}</strong>{detail&&<small>{detail}</small>}</span>{chevron&&<ChevronRight size={17} className="onward-semantic-chevron"/>}</div>}
export function OnwardArcMotif({className=""}:{className?:string}){return <div className={`onward-arc-motif ${className}`} aria-hidden="true"><img src="/onward-symbol.svg" alt=""/></div>}
export function AnimatedMatchScore({value}:{value:unknown}){const actual=Math.max(0,Math.min(100,Math.round(Number(value)||0)));const [shown,setShown]=useState(actual);useEffect(()=>{const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;if(reduced){setShown(actual);return}let frame=0,start=performance.now();setShown(0);const tick=(now:number)=>{const p=Math.min(1,(now-start)/430);const eased=1-Math.pow(1-p,3);setShown(Math.round(actual*eased));if(p<1)frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[actual]);return <div className="onward-detail-score" aria-label={`${actual} / 100`}><div><strong>{shown}</strong><span>%</span></div><i><b style={{width:`${actual}%`}}/></i></div>}
export function EditorialIdentity({title,detail}:{title:string;detail?:string}){return <section className="onward-identity"><h2>{title}</h2>{detail&&<p>{detail}</p>}</section>}
export function Stagger({children,className=""}:{children:ReactNode;className?:string}){return <div className={`onward-stagger ${className}`}>{children}</div>}
