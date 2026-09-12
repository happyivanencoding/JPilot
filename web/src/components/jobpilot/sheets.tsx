"use client";
import {CvOutcome} from "./cv-outcome";
import {roleDetailForOffer,roleCvIsReady,visibleRoleRequirements} from "./role-detail.mjs";
import {v1CvAssessment} from "@/lib/v1-match.mjs";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleAlert, LockKeyhole } from "lucide-react";
import { rows, texts, usePilot, type Json } from "./pilot-context";
import { ACTIVE, centerTasks, destinationFor } from "./model.mjs";
import { AiProgressButton, Button, Card, Check, Chip, Empty, EstimatedProgress, External, Hint, Input, LiquidTaskProgress, Loading, Localization, Markdown, Pill, Score, Select, Sheet, Tabs, TextArea, Title, taskName } from "./ui";
import { PracticeCard, PrepChecklist } from "./profile-prepare";
import { Match100, SearchMetrics } from "./catalog";
import {AnimatedMatchScore,CompanyMark,MetaRow,OnwardArcMotif,SemanticRow} from "./onward-visual";

export function TasksSheet() {
  const { data, tr, openTask } = usePilot();
  const tasks = centerTasks(rows(data.tasks)) as Json[];
  return <Sheet title={tr("后台任务", "Vos traitements", "Background tasks")} testId="tasks-sheet"><div className="jp-sheet-content"><Hint>{tr("已完成的结果，直接回到对应页面。", "Vos résultats, au bon endroit.", "Your results, where they belong.")}</Hint><Localization value={data.localization} />{!tasks.length && <Hint>{tr("当前没有任务。", "Aucun traitement pour ce profil.", "No tasks for this profile.")}</Hint>}{tasks.map(task => <button type="button" className="jp-task-row" key={task.id} data-testid={`task-${task.id}`} onClick={() => openTask(task.id)}><div className="jp-row">{task.status === "completed" ? <CheckCircle2 size={20} className="jp-accent" /> : ACTIVE.has(task.status) ? null : <CircleAlert size={20} />}<h3 className="jp-grow">{task.title || taskName(task.kind, tr)}</h3><ChevronRight size={18} /></div><Hint>{task.phase}</Hint>{ACTIVE.has(task.status) && <EstimatedProgress createdAt={task.createdAt} estimate={task.estimate} />}</button>)}</div></Sheet>;
}

export function OfferSheet({offer}:{offer:Json}) {
  const {data}=usePilot();
  return <JobSheet job={roleDetailForOffer(offer,rows(data.jobs))} offer={offer}/>;
}
export function JobSheet({ job,offer }: { job: Json;offer?:Json }) {
  const { route, data, tr, product, navigate, startTask,act,busy,error,queueTracking } = usePilot();
  const requestedTab=Math.max(0,Number(route.jobTab)||0),tab=requestedTab===1?1:0;
  const [applicationStage,setApplicationStage]=useState(String(job.status||"À candidater"));
  const content=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(content.current)content.current.scrollTop=0;},[tab,job.id]);
  useEffect(()=>{setApplicationStage(String(job.status||"À candidater"));},[job.id,job.status]);
  const cv = job.cv || {}, cvDraft = job.cvDraft || null;
  const hasCv=roleCvIsReady(job),detailScore=job.v1Match?.displayScore ?? job.v1Match?.currentScore ?? job.score;
  const deep=job.v1Match?.deepMatch || {},scoreRows=rows(deep.scoreBreakdown);
  const roleRequirements=visibleRoleRequirements(rows(deep.requirements),{location:job.location,contract:job.contract||offer?.contractType});
  const criterionTitle=(key:string,gap=false)=>key==='role'?(gap?tr("职业方向需确认","Domaine à confirmer","Role domain to clarify"):tr("职业方向直接匹配","Domaine directement aligné","Direct role fit")):key==='duties'?tr("职责覆盖","Couverture des responsabilités","Responsibility coverage"):key==='tools_languages'?tr("工具与语言","Outils et langues","Tools and languages"):key==='level'?tr("经验范围","Niveau d’expérience","Experience level"):tr("匹配依据","Élément de correspondance","Match evidence");
  const explicitStrengths=rows(deep.strengths),explicitGaps=rows(deep.capabilityGaps);
  const matchStrengths=explicitStrengths.length?explicitStrengths:scoreRows.filter(r=>Number(r.rating)>=3).slice(0,3).map(r=>({title:criterionTitle(String(r.key)),evidence:[r.reason,r.candidateEvidence].filter(Boolean).join(" · ")}));
  const matchGaps=explicitGaps.length?explicitGaps:scoreRows.filter(r=>Number(r.rating)<=2&&Number(r.deducted)>0).slice(0,4).map(r=>({title:criterionTitle(String(r.key),true),why:r.reason||r.jobEvidence||"",nextAction:""}));
  const generateRoleCv=async()=>{
    let jobId=String(job.id||"");
    if(!jobId&&offer){const saved=await act({action:"saveOffer",offer});jobId=String(saved?.job?.id||"");}
    if(!jobId)return "";
    await startTask({kind:"cv",jobId,retry:true});
  };
  return <Sheet title={`${job.company} · ${job.role}`} compactHeader testId={offer?"offer-detail":`job-detail-${job.id}`}>
    <div className="onward-job-hero">
      <OnwardArcMotif className="job"/><CompanyMark company={String(job.company||"")}/>
      <div className="onward-job-hero-copy"><span className="jp-company">{job.company}</span><h1>{job.role}</h1><MetaRow location={String(job.location||"")} contract={job.contract?product(job.contract):undefined}/></div>
      {job.v1Match&&<AnimatedMatchScore value={detailScore}/>}<div className="onward-job-hero-actions"><div className="jp-chips">{job.contract&&<Pill>{product(job.contract)}</Pill>}{job.workMode&&<Pill>{product(job.workMode)}</Pill>}</div><label className="onward-application-stage"><select data-testid="job-tracking-stage" aria-label={tr("投递状态","Statut de candidature","Application status")} value={applicationStage} onChange={e=>{const value=e.target.value;setApplicationStage(value);queueTracking(job,offer,{status:value},true);}}>{texts(data.statuses).map(s=><option key={s} value={s}>{product(s)}</option>)}</select></label></div>
    </div>
    <Tabs labels={[tr("匹配", "Match", "Fit"), "CV"]} selected={tab} prefix="job-tab" muted={hasCv?[]:[1]} onChange={i => navigate({ ...route, jobTab: String(i) }, true)} />
    <div className="jp-sheet-content" data-testid="job-content" ref={content}>{job.localization?.failed&&<Localization value={job.localization} />}
      {tab===0&&job.v1Match&&<>
        {!!texts(deep.responsibilities).length&&<section className="onward-detail-section"><h3>{tr("主要职责","Responsabilités principales","Key responsibilities")}</h3>{texts(deep.responsibilities).map((item,i)=><SemanticRow key={i} kind="company" title={item}/>)}</section>}
        {!!roleRequirements.length&&<section className="onward-detail-section"><h3>{tr("岗位要求","Exigences du poste","Role requirements")}</h3>{roleRequirements.map((item,i)=><SemanticRow key={i} title={String(item.title)} detail={String(item.why||"")}/>)}</section>}
        {!!matchStrengths.length&&<section className="onward-detail-section"><h3>{tr("为什么这个岗位适合你","Pourquoi ce poste vous va","Why this role fits")}</h3>{matchStrengths.slice(0,5).map((item,i)=><SemanticRow key={i} title={String(item.title)} detail={String(item.evidence||"")}/>)}</section>}
        {!!matchGaps.length&&<section className="onward-detail-section"><h3>{tr("需要补强","À renforcer","To strengthen")}</h3>{matchGaps.slice(0,5).map((item,i)=><SemanticRow key={i} kind="gap" title={String(item.title)} detail={String(item.nextAction||item.why||"")}/>)}</section>}
        {!!rows(job.v1Match.deepMatch?.presentationGaps).length&&<section className="onward-detail-section"><h3>{tr("简历表达可以更好","À mieux présenter dans le CV","CV presentation to sharpen")}</h3>{rows(job.v1Match.deepMatch.presentationGaps).slice(0,4).map((item,i)=><SemanticRow key={i} kind="document" title={String(item.title)} detail={String(item.why||"")}/>)}</section>}
        <section className="onward-detail-section onward-actions"><External url={job.url} icon={false}><SemanticRow kind="company" title={tr("在原始职位页查看并投递","Voir l’annonce d’origine et candidater","View the original posting and apply")}/></External></section>
      </>}
      {tab === 0 && !job.v1Match && <>
        <div className="jp-row wrap"><Pill>{product(job.status)}</Pill>{job.lastChecked && <Pill>{job.lastChecked.slice(0, 10)}</Pill>}</div>
        {job.recommendation && <h4 className="jp-accent">{product(job.recommendation)}</h4>}<Hint>{[job.location, product(job.workMode), product(job.contract)].filter(Boolean).join(" · ")}</Hint><External url={job.url}>{tr("打开原始职位页", "Ouvrir l’annonce officielle", "Open original job page")}</External>
        {job.summary && <Card><h3>{tr("判断依据", "Lecture du poste", "Assessment")}</h3><Markdown text={job.summary} />{job.angle && <><hr /><p>{job.angle}</p></>}</Card>}
        {!!texts(job.strengths).length && <Card><h3>{tr("优势与证据", "Vos atouts documentés", "Documented strengths")}</h3>{texts(job.strengths).map((s, i) => <p className="jp-bullet" key={i}>{s}</p>)}</Card>}
        {!!rows(job.gaps).length && <h3>{tr("需要准备的差距", "Les écarts à préparer", "Gaps to prepare")}</h3>}{rows(job.gaps).map((gap, i) => <Card key={i}><h4>{gap.title}</h4>{gap.severity && <Pill warm>{product(gap.severity)}</Pill>}<p>{gap.why}</p><Hint>{gap.positioning}</Hint></Card>)}
        {rows(job.match).map((match, i) => <Card key={i}><h4>{match.requirement}</h4><Pill>{product(match.fit)}</Pill><p>{match.evidence}</p><Hint>{match.action}</Hint></Card>)}
        {job.reportNum && <Button kind="text" data-testid="view-report" onClick={() => navigate({ view: "report", report: job.id, job: job.id })}>{tr("查看完整评估报告", "Lire le rapport complet", "Read full report")}</Button>}
      </>}
      {tab === 1 && <>
        <Card>{!hasCv&&<LockKeyhole size={28} className="jp-cv-locked-icon"/>}<h2 style={{fontSize:22}}>{tr("岗位版简历","Votre CV pour cette offre","Your CV for this role")}</h2>{!hasCv&&<Hint>{tr("根据这份岗位要求，重新组织你已有的经历。由你决定是否生成和保留。","Présentez votre parcours pour cette offre. Vous décidez de créer et de conserver le CV.","Present your existing experience for this role. You choose whether to generate and keep it.")}</Hint>}
          {!cvDraft?.id&&!!rows(deep.presentationGaps).length&&<div className="jp-stack"><strong>{tr("这份岗位版 CV 会优先处理","Ce CV ciblera d’abord","This role CV will focus on")}</strong>{rows(deep.presentationGaps).slice(0,3).map((item,i)=><SemanticRow key={i} kind="document" title={String(item.title)} detail={String(item.why||"")}/>)}</div>}
          {cv.file&&<Button kind="outline" onClick={()=>navigate({view:"pdf",job:job.id})}>{tr("查看已保留的岗位版简历","Voir le CV ciblé conservé","View saved role CV")}</Button>}
          {cvDraft?.status!=="pending"&&(!cv.file||cv.inputVersionId!==data.cvState?.versionId)&&<AiProgressButton taskKind="cv" jobId={job.id||undefined} offerUrl={offer?.url} data-testid="generate-role-cv" disabled={busy} onClick={()=>void generateRoleCv()}>{cvDraft?.status==="rejected"?tr("根据反馈生成新版本","Créer une nouvelle version avec mon retour","Generate a new version from my feedback"):tr("生成我的岗位专属简历","Créer mon CV pour cette offre","Generate my role-specific CV")}</AiProgressButton>}
          {error&&<p className="jp-error" role="alert">{error}</p>}
        </Card>
        {cvDraft && <TailoredCvDraftPanel job={job} />}
        {!!texts(cv.changes).length && <Card><h3>{tr("已保留版本的调整", "Adaptations de la version conservée", "Saved version changes")}</h3>{texts(cv.changes).map((s, i) => <p className="jp-bullet" key={i}>{s}</p>)}</Card>}{!!texts(cv.keywords).length && <Card><h3>{tr("岗位关键词", "Mots-clés du poste", "Role keywords")}</h3><p>{texts(cv.keywords).join(" · ")}</p></Card>}
      </>}
    </div>
  </Sheet>;
}

function TailoredCvDraftPanel({ job }: { job: Json }) {
  const { tr, product, act, navigate, busy } = usePilot();
  const draft=job.cvDraft || {}, assessment=v1CvAssessment(job,draft.assessment || {});
  const [rejecting,setRejecting]=useState(false),[rejectReason,setRejectReason]=useState(String(draft.rejectionReason||""));
  useEffect(()=>{setRejecting(false);setRejectReason(String(draft.rejectionReason||""));},[draft.id,draft.revision,draft.rejectionReason]);
  const pending=draft.status==='pending',delta=Number(assessment.delta);
  return <section className="jp-card" data-testid="tailored-cv-draft"><div className="jp-row spread"><h3>{pending?tr("候选简历草稿","Brouillon de CV adapté","Tailored CV draft"):draft.status==='accepted'?tr("已保留的草稿记录","Brouillon conservé","Saved draft record"):tr("已拒绝的草稿","Brouillon refusé","Rejected draft")}</h3>{!job.v1Match&&<Pill warm={!draft.atsPass}>ATS {draft.atsScore ?? '—'}/100</Pill>}</div>
    {draft.pages>1&&<Card><strong>{tr(`当前为 ${draft.pages} 页`,`Le CV fait actuellement ${draft.pages} pages`,`The CV is currently ${draft.pages} pages`)}</strong><Hint>{tr("一页仍是目标，但不会为了硬压成一页而删除真实经历、教育或联系方式。你可以先检查完整版本，再决定是否进一步精简。","Une page reste l’objectif, mais Onward ne supprime pas des expériences, formations ou coordonnées réelles uniquement pour y parvenir. Vérifiez d’abord la version complète.","One page is still the target, but Onward will not delete real experience, education or contact details just to force it. Review the complete version first.")}</Hint></Card>}
    {job.v1Match?<CvOutcome value={job} detail/>:assessment.draftScore != null ? <div className="jp-cv-score-delta"><div><span>{tr("当前主简历","CV actuel","Current master CV")}</span><strong>{assessment.baselineScore}</strong></div><span className="jp-cv-score-arrow">→</span><div><span>{job.v1Match?tr("岗位简历复核","CV revu","Reviewed role CV"):tr("这个草稿","Ce brouillon","This draft")}</span><strong>{assessment.draftScore}</strong></div><Pill warm={delta<0}>{delta>=0?'+':''}{delta}</Pill></div> : <Hint>{tr("这个草稿还没有完成岗位呈现评分。", "Ce brouillon n’a pas encore de score de présentation.", "This draft has not been presentation-scored yet.")}</Hint>}
    {!job.v1Match&&<Hint>{tr("“呈现匹配度”只衡量这份简历是否把你已有的相关证据清楚地呈现给当前岗位，不是录用概率，也不会改变正式岗位评分。", "Le score mesure uniquement la qualité de présentation des preuves existantes pour ce poste ; ce n’est ni une probabilité d’embauche ni le score officiel du poste.", "Presentation score measures how clearly existing evidence is shown for this role; it is not hiring probability and does not change the formal job score.")}</Hint>}
    {!job.v1Match&&assessment.summary && <p>{assessment.summary}</p>}{texts(assessment.improvements).length>0&&<><strong>{tr("这次提升来自","D’où vient l’amélioration","What improved")}</strong>{texts(assessment.improvements).map((x,i)=><p className="jp-bullet" key={i}>{x}</p>)}</>}{texts(assessment.remainingGaps).length>0&&<><strong>{tr("接下来可完善","Vos prochaines pistes","Next areas to develop")}</strong>{texts(assessment.remainingGaps).map((x,i)=><p className="jp-bullet" key={i}>{x}</p>)}</>}
    {!draft.atsPass && rows(draft.atsIssues).length>0 && <div className="jp-stack"><Hint>{tr("ATS 风险不会再让整份草稿失败；请在保留前检查。", "Les alertes ATS n’annulent plus le brouillon ; vérifiez-les avant de le conserver.", "ATS risks no longer fail the entire draft; review them before saving.")}</Hint>{rows(draft.atsIssues).map((issue,i)=><Hint key={i}>{product(issue.message || '')}</Hint>)}</div>}
    {pending && <div className="jp-stack"><Button data-testid="preview-tailored-draft" kind="outline" onClick={()=>navigate({view:'pdf',job:job.id,draft:draft.id})}>{tr("查看为这个岗位定制的专属简历","Voir le CV conçu pour cette offre","View the CV tailored for this role")}</Button>{assessment.revision!==draft.revision&&<Hint>{tr("正在后台重新计算修改后的呈现分，你不需要再点一次评估。","Le score de présentation est recalculé automatiquement en arrière-plan.","The presentation score is recalculating automatically in the background; no extra evaluation click is needed.")}</Hint>}{rejecting?<div className="jp-stack"><TextArea data-testid="reject-tailored-reason" label={tr("哪里需要改（可选）","Que faut-il modifier ? (facultatif)","What should change? (optional)")} rows={3} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder={tr("例如：不要删掉某段经历；摘要太泛；项目顺序不合适。","Ex. : ne pas supprimer telle expérience ; résumé trop générique ; ordre des projets à revoir.","For example: keep a specific experience; summary is too generic; project order needs changing.")}/><div className="jp-row"><Button kind="outline" data-testid="confirm-reject-tailored-draft" disabled={busy} onClick={()=>act({action:'decideTailoredCvDraft',draftId:draft.id,decision:'reject',reason:rejectReason})}>{tr("确认不要这个版本","Confirmer le refus","Reject this version")}</Button><Button kind="text" onClick={()=>setRejecting(false)}>{tr("返回","Retour","Back")}</Button></div></div>:<div className="jp-row"><Button data-testid="accept-tailored-draft" disabled={busy||assessment.revision!==draft.revision} onClick={()=>act({action:'decideTailoredCvDraft',draftId:draft.id,decision:'accept'})}>{tr("保留这个版本","Conserver cette version","Keep this version")}</Button><Button kind="outline" data-testid="reject-tailored-draft" disabled={busy} onClick={()=>setRejecting(true)}>{tr("不要这个版本","Refuser cette version","Reject this version")}</Button></div>}</div>}
    {draft.status==='rejected'&&draft.rejectionReason&&<Hint>{tr(`你的反馈：${draft.rejectionReason}`,`Votre retour : ${draft.rejectionReason}`,`Your feedback: ${draft.rejectionReason}`)}</Hint>}
  </section>;
}

export function AnalysisSheet() {
  const { data, tr, busy, startTask } = usePilot();
  const a = data.analysis || {}, plan = a.globalLayout || {}, global = Object.keys(plan).length > 0;
  const [tab, setTab] = useState(global ? 0 : 1), [history, setHistory] = useState(false), [selected, setSelected] = useState<string[]>([]);
  const priority = (s: string) => s === "primary" ? tr("核心", "Prioritaire", "Primary") : s === "supporting" ? tr("支撑", "En appui", "Supporting") : s === "background" ? tr("背景", "En bref", "Background") : tr("可压缩", "À alléger", "Reduce");
  return <Sheet title={tr("一页，清楚的主线", "Une page. Un fil conducteur.", "One page. A clear story.")} testId="analysis-sheet" footer={(global || selected.length > 0) ? <><Button data-testid="apply-cv-plan" disabled={busy || a.stale || (global && !plan.applicable)} onClick={() => startTask({ kind: "rewrite", analysisId: a.taskId, suggestionIds: global ? ["global-plan"] : selected })}>{global ? tr("预览整页改写方案", "Prévisualiser le plan complet", "Preview the whole-page plan") : tr("预览所选修改", "Prévisualiser les modifications", "Preview selected edits")}</Button><Hint>{tr("先看真实 PDF，再接受；不会自动覆盖。", "Un vrai PDF avant toute décision. Votre CV reste inchangé jusque-là.", "Review the actual PDF before accepting; no automatic overwrite.")}</Hint></> : undefined}>
    <div style={{ padding: "0 22px 12px" }} className="jp-stack"><Hint>{data.profile?.name}</Hint><Hint>{`CV ${data.cvState?.cvVersion ?? "—"} · ${String(a.createdAt || "").slice(0, 10)}`}</Hint>{a.resolvedCount > 0 && <Hint>{tr(`${a.resolvedCount} 项改进已保留`, `${a.resolvedCount} améliorations conservées`, `${a.resolvedCount} improvements retained`)}</Hint>}</div>
    <Tabs labels={[tr("整页重点", "Vue d’ensemble", "Whole page"), tr("直接改善", "Présentation", "Presentation"), tr("真实行动", "À acquérir", "Real actions")]} selected={tab} onChange={setTab} prefix="analysis-tab" />
    <div className="jp-sheet-content" data-testid="analysis-content"><Localization value={data.localization} /><Hint>{a.changeSummary}</Hint>
      {tab === 0 && (!global ? <Hint>{tr("这份已保存的旧分析没有整页计划。不会仅因界面升级再次调用 AI；真实修改 CV 后可更新。", "Cette analyse historique ne contient pas encore de plan global. Aucun nouvel appel IA tant que les données ne changent pas.", "This saved analysis has no global plan. UI updates do not trigger another AI call.")}</Hint> : <><h2 style={{ fontSize: 20, lineHeight: "27px" }}>{plan.headline}</h2><Hint>{plan.languageNote}</Hint>{rows(plan.signals).map((signal, i) => <section className="jp-analysis-signal" key={i}><h4>{signal.title}</h4><p>{signal.why}</p><Hint>{signal.evidence}</Hint></section>)}{!!texts(plan.overlooked).length && <section className="jp-stack"><h3>{tr("第一眼可能漏掉", "Ce qui risque de passer inaperçu", "What may be missed")}</h3>{texts(plan.overlooked).map((s, i) => <p key={i}>{s}</p>)}</section>}{plan.budget && <Hint>{tr("注意力预算：", "Budget de lecture : ", "Reading budget: ") + tr(`${plan.beforeBudget?.words ?? "—"} → ${plan.budget.words} 词 · ${plan.beforeBudget?.bullets ?? "—"} → ${plan.budget.bullets} 条描述`, `${plan.beforeBudget?.words ?? "—"} → ${plan.budget.words} mots · ${plan.beforeBudget?.bullets ?? "—"} → ${plan.budget.bullets} puces`, `${plan.beforeBudget?.words ?? "—"} → ${plan.budget.words} words · ${plan.beforeBudget?.bullets ?? "—"} → ${plan.budget.bullets} bullets`)}</Hint>}{rows(plan.allocations).map((item, i) => <section className="jp-stack" key={i}><div className="jp-row spread"><h4>{item.section}</h4><span className="jp-caption jp-accent">{priority(item.priority)}</span></div><p>{item.reason}</p><Hint>{item.spaceTradeoff}</Hint><hr /></section>)}{texts(plan.issues).map((s, i) => <p style={{ color: "var(--jp-error)" }} key={i}>{s}</p>)}</>)}
      {tab === 1 && <><Hint>{global ? tr("这些变化属于同一个整页方案，会一起压缩、合并与重排，不会逐项调用 AI。", "Ces changements appartiennent à un plan unique : raccourcir, fusionner, réordonner. Aucun appel IA par suggestion.", "One coordinated plan shortens, merges and reorders; no AI call per suggestion.") : tr("旧建议保留可用。请只选必要的变化；新分析会改用整页预算。", "Suggestions historiques conservées. Sélectionnez seulement les changements utiles.", "Historical suggestions remain available. Select only useful edits.")}</Hint>{rows(a.expressionIssues).map(issue => <section className="jp-stack" key={issue.id}>{!global && issue.applicable ? <Check checked={selected.includes(issue.id)} onChange={yes => setSelected(list => yes ? [...list, issue.id] : list.filter(x => x !== issue.id))}><strong>{issue.title}</strong></Check> : <h4>{issue.title}</h4>}<p>{issue.detail}</p>{!global && <><Hint>{tr("当前", "Avant", "Before")}</Hint><div className="jp-original">{issue.before}</div><Hint>{tr("建议", "Après", "After")}</Hint><div className="jp-original">{issue.after}</div></>}<Hint>{issue.evidence}</Hint><hr /></section>)}</>}
      {tab === 2 && <><Hint>{tr("表达不能替代经验或语言能力。以下需要实际行动。", "Une reformulation ne remplace ni l’expérience ni la maîtrise d’une langue.", "Wording cannot replace experience or language proficiency.")}</Hint>{rows(a.actionIssues).map(issue => <section className="jp-stack" key={issue.id}><h3>{issue.title}</h3><p>{issue.detail}</p><p className="jp-accent">{issue.nextAction}</p><Hint>{issue.evidence}</Hint><hr /></section>)}{!rows(a.actionIssues).length && <Markdown text={a.actionMarkdown} />}</>}
      <Button kind="text" onClick={() => setHistory(!history)}>{tr("查看完整分析与历史", "Compte rendu & historique", "Full analysis & history")}</Button>{history && <><Hint>{tr("原始历史记录，不代表已解决的问题仍未解决。", "Compte rendu d’origine ; les points résolus sont conservés comme historique.", "Original record; resolved points are retained as history.")}</Hint><Markdown text={a.markdown} /></>}
    </div>
  </Sheet>;
}

export function CompareSheet() {
  const { data, route, tr, product, startTask, navigate } = usePilot();
  const ids = (route.ids || "").split(",").slice(0, 4);
  const jobs = rows(data.jobs).filter(j => ids.includes(j.id));
  return <Sheet title={tr("把机会放在一起看", "Comparer vos opportunités", "Compare your opportunities")} testId="compare-sheet"><div className="jp-sheet-content"><Hint>{tr("横向滚动查看各岗位；没有评估的岗位不会显示分数。", "Faites défiler les colonnes. Les offres non évaluées restent sans score.", "Scroll across columns. Unrated offers stay unrated.")}</Hint><div className="jp-compare">{jobs.map(job => <Card key={job.id}><strong>{job.company}</strong><h3>{job.role}</h3><Score score={job.score} /><Pill>{product(job.status)}</Pill><Hint>{job.location}</Hint><Hint>{product(job.workMode)}</Hint><Localization value={job.localization} /><hr /><h4>{tr("优势", "Forces", "Strengths")}</h4>{texts(job.strengths).slice(0, 3).map((s, i) => <p className="jp-bullet" key={i}>{s}</p>)}<h4>{tr("差距", "Écarts", "Gaps")}</h4>{rows(job.gaps).slice(0, 3).map((g, i) => <p className="jp-bullet" key={i}>{g.title}</p>)}<Hint>{tr("薪酬：以报告和原始职位页为准", "Rémunération : vérifier le rapport et l’annonce source.", "Compensation: check the report and source posting.")}</Hint></Card>)}</div><Button disabled={jobs.length < 2} onClick={() => { navigate({ tab: "applications", filter: route.filter }, true); void startTask({ kind: "compare", jobIds: jobs.map(j => j.id) }); }}>{tr("分析取舍与优先顺序", "Analyser les compromis & priorités", "Analyze tradeoffs and priorities")}</Button></div></Sheet>;
}
export function ResultSheet() {
  const { route, detail, tr, navigate } = usePilot();
  const report = route.view === "report";
  useEffect(() => {
    if (report || detail?.status !== "completed") return;
    const destination = destinationFor(detail);
    if (destination.view !== "task") navigate(destination, true);
  }, [detail, report, navigate]);
  return <Sheet title={taskName(report ? "report" : detail?.kind || "", tr)} testId="result-sheet">{!detail ? <Loading /> : report ? <div className="jp-sheet-content"><Localization value={detail.localization} /><Markdown text={detail.markdown} /></div> : <TaskResult key={detail.id} task={detail} />}</Sheet>;
}
function TaskResult({ task }: { task: Json }) {
  const { data, tr, product, act, startTask, close, navigate } = usePilot();
  const result = task.result || {}, active = ACTIVE.has(task.status);
  const [proposal, setProposal] = useState(result.proposal || ""), [confirm, setConfirm] = useState(false);
  const [version] = useState(task.inputVersionId || data.cvState?.versionId);
  const originalProposal = useRef(result.proposal || "");
  useEffect(() => { if (result.proposal && !originalProposal.current) { originalProposal.current = result.proposal; setProposal(result.proposal); } }, [result.proposal]);
  const stateLabel = task.status === "completed" ? tr("已完成", "Terminé", "Completed") : task.status === "failed" ? tr("需处理", "À vérifier", "Needs attention") : task.status === "running" ? tr("进行中", "En cours", "Running") : task.status === "queued" ? tr("排队中", "En attente", "Queued") : tr("核对中", "Vérification", "Checking");
  return <div className="jp-sheet-content"><Pill warm={task.status === "failed"}>{stateLabel}</Pill><Hint>{task.phase}</Hint><Localization value={result.localization} />{active && <><LiquidTaskProgress task={task}/><Hint>{tr("可以离开这个页面。结果会保存在当前档案的任务记录中。", "Vous pouvez quitter cet écran. Le résultat sera conservé dans l’activité de ce profil.", "You can leave this screen. Results will remain in this profile’s activity.")}</Hint></>}
    {task.error && <Card><p style={{ color: "var(--jp-error)" }}>{product(task.error)}</p>{task.kind !== "ingest" && <Button kind="outline" onClick={() => startTask({ ...task.input, kind: task.kind, retry: true })}>{tr("重试这项操作", "Réessayer cette action", "Retry this action")}</Button>}</Card>}
    {task.status === "completed" && (task.kind === "ingest" ? <><strong>{result.filename}</strong><Hint>{tr("这是本地提取的原文，不是 AI 改写。请检查顺序、数字、日期以及当前档案。", "Texte extrait localement, sans réécriture IA. Vérifiez l’ordre, les chiffres, les dates et le profil choisi.", "Locally extracted text, not an AI rewrite. Check reading order, figures, dates and selected profile.")}</Hint><TextArea label={tr("导入预览", "Aperçu de l’import", "Import preview")} rows={15} value={proposal} onChange={e => setProposal(e.target.value)} />{confirm ? <div className="jp-confirm" role="alert"><h3>{tr("更新当前档案的主简历？", "Mettre à jour le CV de ce profil ?", "Update this profile’s master CV?")}</h3><strong>{data.profile?.name}</strong><Hint>{tr("这份简历将成为后续搜索和分析的依据。旧版会备份；未保留的经历将不再参与分析。", "Ce CV deviendra la référence des recherches et analyses. L’ancienne version sera sauvegardée ; les faits retirés ne seront plus utilisés.", "This becomes the source for future search and analysis. The old version is backed up; removed facts will no longer be used.")}</Hint><Button data-testid="confirm-import" onClick={async () => { if (await act({ action: "confirmCv", taskId: task.id, content: proposal, confirmed: true, expectedVersionId: version })) close(); }}>{tr("确认更新", "Confirmer", "Confirm")}</Button><Button kind="text" onClick={() => setConfirm(false)}>{tr("返回检查", "Revoir", "Review")}</Button></div> : <Button disabled={!proposal.trim()} onClick={() => setConfirm(true)}>{tr("确认保存", "Confirmer et enregistrer", "Confirm and save")}</Button>}<Button kind="text" onClick={close}>{tr("暂不修改主简历", "Ne pas modifier mon CV actuel", "Keep my current CV unchanged")}</Button></> : task.kind === "search" ? <><SearchMetrics value={result.searchMetrics} /><Button onClick={() => navigate({ tab: "offers" })}>{tr("查看完整搜索结果", "Voir toutes les offres", "View all search results")}</Button></> : <>
      {task.kind === "evaluate" && result.score != null && <Score score={result.score} />}
      <Markdown text={result.markdown || result.summary} />
      {task.kind === "practice" && !result.markdown && result.feedback && <Markdown text={String(result.feedback)} />}
    </>)}
  </div>;
}
