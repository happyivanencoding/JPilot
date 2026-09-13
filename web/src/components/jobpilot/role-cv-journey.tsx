"use client";
import {BarChart3,BookOpen,FileText,TrendingUp} from "lucide-react";
import {roleCvJourney} from "@/lib/onward-cv.mjs";
import {texts,usePilot,type Json} from "./pilot-context";

function ScoreStage({step,label,score,description,tone="base",estimated=false,estimateLabel="",pending=false,pendingLabel=""}:{step:number;label:string;score:number|null;description:string;tone?:"base"|"middle"|"potential";estimated?:boolean;estimateLabel?:string;pending?:boolean;pendingLabel?:string}){
  return <div className={`onward-cv-stage ${tone}${pending?" pending":""}`} data-testid={`role-cv-stage-${step}`} data-pending={pending?"true":"false"}>
    <div className="onward-cv-stage-head"><span className="onward-cv-stage-number">{step}</span><strong>{label}</strong>{!pending&&estimated&&<span className="onward-cv-estimate-chip">{estimateLabel}</span>}</div>
    <div className="onward-cv-stage-body">{pending?<div className="onward-cv-stage-pending"><span className="onward-loading-sheen" aria-hidden="true"/><strong>{pendingLabel}</strong></div>:<>
      <div className="onward-cv-stage-score"><b>{score}</b><span>%</span></div>
      <i aria-hidden="true"><b style={{width:`${score??0}%`}}/></i>
      <small>{description}</small>
    </>}</div>
  </div>;
}

export function RoleCvJourney({job}:{job:Json}){
  const {tr}=usePilot();
  const journey=roleCvJourney(job);
  const improvements=texts(job.cvDraft?.assessment?.improvements);
  const estimateLabel=tr("预计","Estimé","Est.");
  const pendingLabel=tr("正在计算","Calcul en cours","Calculating");
  const currentPending=journey.current==null,optimisedPending=journey.optimised==null,capabilityPending=journey.capability==null;
  return <section className="onward-role-cv-journey" data-testid="role-cv-journey">
    <h2>{tr("岗位版简历","CV ciblé","Role-specific CV")}</h2>
    <section className="onward-cv-path">
      <h3>{tr("匹配提升路径","Trajectoire d’amélioration","Match improvement path")}</h3>
      <div className="onward-cv-stage-grid">
        <ScoreStage step={1} tone="base" pending={currentPending} pendingLabel={pendingLabel} label={tr("当前匹配","Match actuel","Current match")} score={journey.current} description={tr("基于当前简历与已确认事实","CV actuel et faits confirmés","Current CV and confirmed facts")}/>
        <span className="onward-cv-stage-arrow" aria-hidden="true">→</span>
        <ScoreStage step={2} tone="middle" pending={optimisedPending} pendingLabel={pendingLabel} estimated={journey.optimisedEstimated} estimateLabel={estimateLabel} label={tr("优化表达后","Après optimisation","After better presentation")} score={journey.optimised} description={tr("不增加新事实，仅优化表达","Sans nouveau fait, uniquement la présentation","No new facts, presentation only")}/>
        <span className="onward-cv-stage-arrow" aria-hidden="true">→</span>
        <ScoreStage step={3} tone="potential" pending={capabilityPending} pendingLabel={pendingLabel} estimated estimateLabel={estimateLabel} label={tr("补强后","Après renforcement","After strengthening")} score={journey.capability} description={tr("完成关键补强后","Après les renforcements prioritaires","After the priority boosts")}/>
      </div>
      {!currentPending&&!optimisedPending&&!capabilityPending&&<div className="onward-cv-gain-strip"><TrendingUp size={17}/><strong>{tr(`提升 +${journey.expressionGain} 分（表达优化）`,`+${journey.expressionGain} pts par la présentation`,`+${journey.expressionGain} points from presentation`)}</strong><span>·</span><strong>{tr(`总潜力 +${journey.totalGain} 分`,`Potentiel total +${journey.totalGain} pts`,`Total potential +${journey.totalGain} points`)}</strong></div>}
    </section>
    {!!improvements.length&&<section className="onward-cv-improvements"><h3>{tr("这次提升来自","Ce qui améliore ce CV","What drives this improvement")}</h3>{improvements.slice(0,3).map((item,i)=><p key={i}><span aria-hidden="true">•</span>{item}</p>)}</section>}
    {!capabilityPending&&!!journey.quickBoosts.length&&<section className="onward-quick-boosts" data-testid="role-cv-quick-boosts">
      <h3>{tr(`补强到 ${journey.capability}%（预计）`,`Renforcement vers ${journey.capability}% (estimé)`,`Strengthening toward ${journey.capability}% (estimated)`)}</h3>
      <div className="onward-quick-boost-list">{journey.quickBoosts.map((item:any,i:number)=>{const existing=item.kind==='confirm_existing';const Icon=existing?FileText:(i%2?BookOpen:BarChart3);return <article className="onward-quick-boost" key={`${item.kind}-${item.title}-${i}`}><span className="onward-quick-boost-icon"><Icon size={18}/></span><div><div className="onward-quick-boost-title"><strong>{item.title}</strong><span className="build">{tr("可补齐","À compléter","Can build")}</span></div>{item.why&&<p>{item.why}</p>}</div></article>})}</div>
    </section>}
  </section>;
}
