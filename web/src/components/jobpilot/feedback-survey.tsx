"use client";
import {useState} from "react";
import {usePilot} from "./pilot-context";
import {Button,TextArea} from "./ui";

export function FeedbackSurvey(){
 const p=usePilot(),{tr}=p;
 const [kind,setKind]=useState<"survey"|"feedback">("survey"),[useful,setUseful]=useState(""),[distrust,setDistrust]=useState(""),[nextStep,setNextStep]=useState(""),[alternative,setAlternative]=useState(""),[pay,setPay]=useState(""),[surveyNote,setSurveyNote]=useState(""),[message,setMessage]=useState(""),[state,setState]=useState("");
 const options=(zh:string[],fr:string[],en:string[])=>tr(zh.join("|"),fr.join("|"),en.join("|")).split("|");
 const Select=({label,value,onChange,items}:{label:string;value:string;onChange:(v:string)=>void;items:string[]})=><label className="jp-field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}><option value="">—</option>{items.map(item=><option key={item} value={item}>{item}</option>)}</select></label>;
 const choose=(next:"survey"|"feedback")=>{setKind(next);setState("");};
 const submit=async()=>{
  const note=kind==="feedback"?message:surveyNote;
  if(kind==="feedback"&&!note.trim())return;
  setState("saving");
  try{await p.request("/api/v1/feedback",{method:"POST",body:JSON.stringify(kind==="survey"?{kind,useful,distrust,nextStep,alternative,willingnessToPay:pay,note}:{kind,note})});setState("saved");}
  catch{setState("failed");}
 };
 return <div className="jp-stack onward-feedback-survey" data-testid="feedback-survey">
  <div className="jp-chips"><button type="button" className={`jp-chip ${kind==="survey"?"selected":""}`} onClick={()=>choose("survey")}>{tr("测试问卷","Questionnaire","Survey")}</button><button type="button" data-testid="feedback-freeform-tab" className={`jp-chip ${kind==="feedback"?"selected":""}`} onClick={()=>choose("feedback")}>{tr("意见与问题","Suggestions et problèmes","Feedback & issues")}</button></div>
  {kind==="survey"?<>
   <Select label={tr("哪个地方最有用？","Quelle partie vous aide le plus ?","Which part is most useful?")} value={useful} onChange={setUseful} items={options(["方向建议","岗位搜索","匹配分析","岗位版 CV","投递跟踪","其他"],["Pistes","Recherche d’offres","Analyse du match","CV ciblé","Suivi","Autre"],["Directions","Job search","Match analysis","Role CV","Tracking","Other"])}/>
   <Select label={tr("哪个结果你不相信？","Quel résultat vous inspire le moins confiance ?","Which result do you trust least?")} value={distrust} onChange={setDistrust} items={options(["没有","方向建议","岗位推荐","匹配分","岗位版 CV","其他"],["Aucun","Pistes","Offres","Score de match","CV ciblé","Autre"],["None","Directions","Job recommendations","Match score","Role CV","Other"])}/>
   <Select label={tr("哪里不知道下一步该干嘛？","Où ne savez-vous pas quoi faire ensuite ?","Where are you unsure what to do next?")} value={nextStep} onChange={setNextStep} items={options(["没有","首页","机会页","岗位详情","岗位版 CV","投递后","其他"],["Nulle part","Accueil","Opportunités","Détail du poste","CV ciblé","Après candidature","Autre"],["Nowhere","Home","Opportunities","Job detail","Role CV","After applying","Other"])}/>
   <Select label={tr("如果没有 Onward，你原本会怎么做？","Sans Onward, qu’auriez-vous fait ?","Without Onward, what would you do?")} value={alternative} onChange={setAlternative} items={options(["招聘网站","通用 AI 工具","学校/朋友","自己整理","其他"],["Sites d’emploi","IA généraliste","École/amis","Organisation personnelle","Autre"],["Job sites","General AI","School/friends","Do it myself","Other"])}/>
   <Select label={tr("你愿意为 Onward 付费吗？","Seriez-vous prêt·e à payer pour Onward ?","Would you pay for Onward?")} value={pay} onChange={setPay} items={options(["愿意","看价格","暂时不会"],["Oui","Selon le prix","Pas pour l’instant"],["Yes","Depends on price","Not yet"])}/>
   <TextArea label={tr("还想告诉我们什么？","Autre chose à nous dire ?","Anything else?")} rows={4} value={surveyNote} onChange={e=>setSurveyNote(e.target.value)}/>
  </>:<TextArea data-testid="feedback-freeform" className="onward-feedback-freeform" label={tr("写下你的建议、遇到的问题或任何想告诉我们的事","Écrivez votre suggestion, le problème rencontré ou tout autre retour","Write your suggestion, the issue you ran into, or anything else you want to tell us")} rows={11} value={message} onChange={e=>setMessage(e.target.value)} placeholder={tr("直接写就可以。","Écrivez librement ici.","Write freely here.")}/>}
  <Button data-testid="submit-feedback" disabled={state==="saving"||(kind==="feedback"&&!message.trim())} onClick={()=>void submit()}>{state==="saved"?tr("已提交，谢谢","Envoyé, merci","Submitted, thank you"):tr("提交反馈","Envoyer","Submit feedback")}</Button>
  {state==="failed"&&<p className="jp-error">{tr("提交失败，请重试。","Échec de l’envoi. Réessayez.","Could not submit. Please retry.")}</p>}
 </div>;
}
