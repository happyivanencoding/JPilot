"use client";
import {CvOutcome} from "./cv-outcome";
import {roleDetailForOffer,roleCvIsReady} from "./role-detail.mjs";
import {v1CvAssessment} from "@/lib/v1-match.mjs";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleAlert, LockKeyhole } from "lucide-react";
import { rows, texts, usePilot, type Json } from "./pilot-context";
import { ACTIVE, centerTasks, destinationFor } from "./model.mjs";
import { AiProgressButton, Button, Card, Check, Chip, Empty, EstimatedProgress, External, Hint, Input, Loading, Localization, Markdown, Pill, Score, Select, Sheet, Tabs, TextArea, Title, taskName } from "./ui";
import { PracticeCard, PrepChecklist } from "./profile-prepare";
import { Match100, SearchMetrics } from "./catalog";

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
  const { route, data, tr, product, navigate, startTask,tailorOffer,busy,error } = usePilot();
  const tab = Math.min(2, Math.max(0, Number(route.jobTab) || 0));
  const cv = job.cv || {}, cvDraft = job.cvDraft || null;
  const hasCv=roleCvIsReady(job);
  return <Sheet title={<><div className="jp-subtitle">{job.company}</div><div className="jp-row"><span className="jp-grow">{job.role}</span>{job.v1Match?<Match100 value={job.v1Match.displayScore ?? job.v1Match.currentScore}/>:<Score score={job.score} />}</div></>} testId={offer?"offer-detail":`job-detail-${job.id}`}>
    <Tabs labels={[tr("匹配", "Match", "Fit"), "CV", tr("跟踪", "Suivi", "Tracking")]} selected={tab} prefix="job-tab" muted={hasCv?[]:[1]} onChange={i => navigate({ ...route, jobTab: String(i) }, true)} />
    <div className="jp-sheet-content" data-testid="job-content"><Localization value={job.localization} />
      {tab===0&&job.localization?.pending&&<Loading/>}
      {tab===0&&!job.localization?.pending&&job.v1Match&&<>
        <Card><h3>{tr("你的简历与这个岗位","Votre CV pour ce poste","Your CV for this role")}</h3><CvOutcome value={job} detail/></Card>
        <External url={job.url}>{tr("打开原始职位页","Ouvrir l’annonce officielle","Open original job page")}</External>
        <Card><h3>{tr("这个岗位做什么","Ce que fait ce poste","What this role does")}</h3><p>{job.v1Match.deepMatch?.roleSummary}</p>{texts(job.v1Match.deepMatch?.responsibilities).map((text,i)=><p className="jp-bullet" key={i}>{text}</p>)}</Card>
        {!!rows(job.v1Match.deepMatch?.strengths).length&&<Card><h3>{tr("你的强项","Vos points forts","Your strengths")}</h3>{rows(job.v1Match.deepMatch.strengths).map((item,i)=><div key={i}><strong>+ {item.title}</strong><Hint>{item.evidence}</Hint></div>)}</Card>}
        {!!rows(job.v1Match.deepMatch?.presentationGaps).length&&<Card><h3>{tr("简历这样改","Mieux présenter votre CV","Sharpen your CV")}</h3>{rows(job.v1Match.deepMatch.presentationGaps).map((item,i)=><div key={i}><strong>{item.title}</strong><Hint>{item.why}</Hint></div>)}</Card>}
        {!!rows(job.v1Match.deepMatch?.capabilityGaps).length&&<Card><h3>{tr("值得补强的地方","Vos axes de progrès","Where to grow")}</h3>{rows(job.v1Match.deepMatch.capabilityGaps).map((item,i)=><div key={i}><strong>− {item.title}</strong><p>{item.why}</p><Hint>{item.nextAction}</Hint></div>)}</Card>}
      </>}
      {tab === 0 && !job.localization?.pending && !job.v1Match && <>
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
          {cvDraft?.status==="pending"&&<Button data-testid="view-role-cv-top" onClick={()=>navigate({view:"pdf",job:job.id,draft:cvDraft.id})}>{tr("查看你的岗位版简历","Voir votre CV ciblé","View your role CV")}</Button>}
          {cv.file&&<Button kind="outline" onClick={()=>navigate({view:"pdf",job:job.id})}>{tr("查看已保留的岗位版简历","Voir le CV ciblé conservé","View saved role CV")}</Button>}
          {cvDraft?.status!=="pending"&&(!cv.file||cv.inputVersionId!==data.cvState?.versionId)&&<AiProgressButton taskKind="cv" jobId={job.id||undefined} offerUrl={offer?.url} data-testid="generate-role-cv" disabled={busy} onClick={()=>offer?tailorOffer(offer):startTask({kind:"cv",jobId:job.id,retry:true})}>{tr("生成我的岗位专属简历","Créer mon CV pour cette offre","Generate my role-specific CV")}</AiProgressButton>}
          {error&&<p className="jp-error" role="alert">{error}</p>}
        </Card>
        {cvDraft && <TailoredCvDraftPanel job={job} />}
        {!!texts(cv.changes).length && <Card><h3>{tr("已保留版本的调整", "Adaptations de la version conservée", "Saved version changes")}</h3>{texts(cv.changes).map((s, i) => <p className="jp-bullet" key={i}>{s}</p>)}</Card>}{!!texts(cv.keywords).length && <Card><h3>{tr("岗位关键词", "Mots-clés du poste", "Role keywords")}</h3><p>{texts(cv.keywords).join(" · ")}</p></Card>}
      </>}
      {tab === 2 && <Tracking key={job.url||job.id} job={job} offer={offer} />}
    </div>
  </Sheet>;
}

function TailoredCvDraftPanel({ job }: { job: Json }) {
  const { tr, product, act, navigate, busy } = usePilot();
  const draft=job.cvDraft || {}, assessment=v1CvAssessment(job,draft.assessment || {});
  const [editing,setEditing]=useState(false),[payload,setPayload]=useState<Json>(()=>structuredClone(draft.payload || {}));
  useEffect(()=>{setPayload(structuredClone(draft.payload || {}));setEditing(false);},[draft.id,draft.revision]);
  const updateExperience=(index:number,value:string)=>setPayload((previous:Json)=>{const next=structuredClone(previous);next.experience ||= [];next.experience[index] ||= {};next.experience[index].bullets=value.split(/\r?\n/).map((v:string)=>v.trim()).filter(Boolean);return next;});
  const updateProject=(index:number,value:string)=>setPayload((previous:Json)=>{const next=structuredClone(previous);next.projects ||= [];next.projects[index] ||= {};next.projects[index].description=value;return next;});
  const updateEducation=(index:number,value:string)=>setPayload((previous:Json)=>{const next=structuredClone(previous);next.education ||= [];next.education[index] ||= {};next.education[index].description=value;return next;});
  const updateSkill=(index:number,value:string)=>setPayload((previous:Json)=>{const next=structuredClone(previous);next.skills ||= [];next.skills[index] ||= {};next.skills[index].items=value.split(/[,\n]/).map((v:string)=>v.trim()).filter(Boolean);return next;});
  const pending=draft.status==='pending',delta=Number(assessment.delta);
  return <section className="jp-card" data-testid="tailored-cv-draft"><div className="jp-row spread"><h3>{pending?tr("候选简历草稿","Brouillon de CV adapté","Tailored CV draft"):draft.status==='accepted'?tr("已保留的草稿记录","Brouillon conservé","Saved draft record"):tr("已拒绝的草稿","Brouillon refusé","Rejected draft")}</h3>{!job.v1Match&&<Pill warm={!draft.atsPass}>ATS {draft.atsScore ?? '—'}/100</Pill>}</div>
    {job.v1Match?<CvOutcome value={job} detail/>:assessment.draftScore != null ? <div className="jp-cv-score-delta"><div><span>{tr("当前主简历","CV actuel","Current master CV")}</span><strong>{assessment.baselineScore}</strong></div><span className="jp-cv-score-arrow">→</span><div><span>{job.v1Match?tr("岗位简历复核","CV revu","Reviewed role CV"):tr("这个草稿","Ce brouillon","This draft")}</span><strong>{assessment.draftScore}</strong></div><Pill warm={delta<0}>{delta>=0?'+':''}{delta}</Pill></div> : <Hint>{tr("这个草稿还没有完成岗位呈现评分。", "Ce brouillon n’a pas encore de score de présentation.", "This draft has not been presentation-scored yet.")}</Hint>}
    {!job.v1Match&&<Hint>{tr("“呈现匹配度”只衡量这份简历是否把你已有的相关证据清楚地呈现给当前岗位，不是录用概率，也不会改变正式岗位评分。", "Le score mesure uniquement la qualité de présentation des preuves existantes pour ce poste ; ce n’est ni une probabilité d’embauche ni le score officiel du poste.", "Presentation score measures how clearly existing evidence is shown for this role; it is not hiring probability and does not change the formal job score.")}</Hint>}
    {!job.v1Match&&assessment.summary && <p>{assessment.summary}</p>}{texts(assessment.improvements).length>0&&<><strong>{tr("这次提升来自","D’où vient l’amélioration","What improved")}</strong>{texts(assessment.improvements).map((x,i)=><p className="jp-bullet" key={i}>{x}</p>)}</>}{texts(assessment.remainingGaps).length>0&&<><strong>{tr("接下来可完善","Vos prochaines pistes","Next areas to develop")}</strong>{texts(assessment.remainingGaps).map((x,i)=><p className="jp-bullet" key={i}>{x}</p>)}</>}
    {!draft.atsPass && rows(draft.atsIssues).length>0 && <div className="jp-stack"><Hint>{tr("ATS 风险不会再让整份草稿失败；请在保留前检查。", "Les alertes ATS n’annulent plus le brouillon ; vérifiez-les avant de le conserver.", "ATS risks no longer fail the entire draft; review them before saving.")}</Hint>{rows(draft.atsIssues).map((issue,i)=><Hint key={i}>{product(issue.message || '')}</Hint>)}</div>}
    {pending && editing && <div className="jp-stack"><TextArea label={tr("职业摘要","Résumé professionnel","Professional summary")} rows={5} value={payload.summary || ''} onChange={e=>setPayload((previous:Json)=>({...previous,summary:e.target.value}))} />
      {rows(payload.experience).map((entry,i)=><div className="jp-stack" key={`exp-${i}`}><strong>{entry.company} · {entry.role}</strong><Hint>{[entry.location,entry.dates].filter(Boolean).join(' · ')}</Hint><TextArea label={tr("经历要点（每行一条）","Points d’expérience (une ligne par point)","Experience bullets (one per line)")} rows={5} value={texts(entry.bullets).join('\n')} onChange={e=>updateExperience(i,e.target.value)} /></div>)}
      {rows(payload.projects).map((entry,i)=><TextArea key={`project-${i}`} label={`${tr("项目","Projet","Project")} · ${entry.name || i+1}`} rows={4} value={entry.description || ''} onChange={e=>updateProject(i,e.target.value)} />)}
      {rows(payload.education).map((entry,i)=><TextArea key={`edu-${i}`} label={`${tr("教育","Formation","Education")} · ${entry.title || i+1}`} rows={3} value={entry.description || ''} onChange={e=>updateEducation(i,e.target.value)} />)}
      {rows(payload.skills).map((entry,i)=><TextArea key={`skills-${i}`} label={`${entry.category || tr("技能","Compétences","Skills")} · ${tr("逗号或换行分隔","virgules ou lignes","comma or newline separated")}`} rows={3} value={texts(entry.items).join(', ')} onChange={e=>updateSkill(i,e.target.value)} />)}
      <Button data-testid="save-tailored-draft-edit" disabled={busy} onClick={async()=>{if(await act({action:'updateTailoredCvDraft',draftId:draft.id,payload}))setEditing(false);}}>{tr("保存修改并重新生成 PDF","Enregistrer et régénérer le PDF","Save edits and regenerate PDF")}</Button><Button kind="text" onClick={()=>{setPayload(structuredClone(draft.payload || {}));setEditing(false);}}>{tr("取消编辑","Annuler les modifications","Cancel edits")}</Button>
    </div>}
    {pending && !editing && <div className="jp-stack"><Button data-testid="preview-tailored-draft" kind="outline" onClick={()=>navigate({view:'pdf',job:job.id,draft:draft.id})}>{tr("预览真实 PDF","Prévisualiser le PDF réel","Preview actual PDF")}</Button><Button kind="outline" onClick={()=>setEditing(true)}>{tr("手动修改这个版本","Modifier manuellement cette version","Edit this version manually")}</Button>{assessment.revision!==draft.revision&&<Hint>{tr("正在后台重新计算修改后的呈现分，你不需要再点一次评估。","Le score de présentation est recalculé automatiquement en arrière-plan.","The presentation score is recalculating automatically in the background; no extra evaluation click is needed.")}</Hint>}<div className="jp-row"><Button data-testid="accept-tailored-draft" disabled={busy||assessment.revision!==draft.revision} onClick={()=>act({action:'decideTailoredCvDraft',draftId:draft.id,decision:'accept'})}>{tr("保留这个版本","Conserver cette version","Keep this version")}</Button><Button kind="outline" data-testid="reject-tailored-draft" disabled={busy} onClick={()=>act({action:'decideTailoredCvDraft',draftId:draft.id,decision:'reject'})}>{tr("不要这个版本","Refuser cette version","Reject this version")}</Button></div></div>}
  </section>;
}

function Tracking({ job,offer }: { job: Json;offer?:Json }) {
  const { data, tr, product, act,trackingKey,trackingStates,queueTracking,flushTracking } = usePilot();
  const [status, setStatus] = useState(job.status || "À candidater"), [next, setNext] = useState(job.followup?.nextActionSource==='user'?job.followup.nextAction:""), [date, setDate] = useState(job.followup?.dueDate || ""), [note, setNote] = useState(job.followup?.note || "");
  const editedNext = useRef(false);
  const [reply, setReply] = useState(job.followup?.replyNote || ""), [replyKind, setReplyKind] = useState("Recruteur");
  const key=trackingKey(job,offer),saveState=trackingStates[key];
  const save=(patch:Json,immediate=false)=>queueTracking(job,offer,patch,immediate);
  useEffect(()=>()=>{void flushTracking(key);},[key]);
  return <>
    <Card><h3>{tr("投递状态", "Statut de candidature", "Application status")}</h3><Select label={tr("当前阶段", "Étape actuelle", "Current stage")} value={status} onChange={value=>{setStatus(value);save({status:value},true);}}>{texts(data.statuses).map(s => <option key={s} value={s}>{product(s)}</option>)}</Select><Input data-analytics="tracking_next_action" label={tr("下一步行动", "Prochaine action", "Next action")} value={next} maxLength={12000} onChange={e => { setNext(e.target.value); editedNext.current = true;save({nextAction:e.target.value}); }} /><Input data-analytics="tracking_due_date" type="date" label={tr("跟进日期", "Date de relance", "Follow-up date")} value={date} onChange={e => {setDate(e.target.value);save({dueDate:e.target.value},true);}} /><TextArea data-analytics="tracking_note" label={tr("我的备注", "Mes notes", "My notes")} value={note} rows={3} maxLength={12000} onChange={e => {setNote(e.target.value);save({note:e.target.value});}} onBlur={()=>void flushTracking(key)} /><div data-testid="tracking-save-state" role="status"><Hint>{saveState==='saving'?tr('保存中…','Enregistrement…','Saving…'):saveState==='failed'?tr('未保存，请重试','Non enregistré, réessayez','Not saved. Please retry'):saveState==='saved'?tr('已自动保存','Enregistré automatiquement','Saved automatically'):tr('改动会自动保存','Modifications enregistrées automatiquement','Changes save automatically')}</Hint>{saveState==='failed'&&<Button kind="text" onClick={()=>void flushTracking(key)}>{tr('重试保存','Réessayer','Retry save')}</Button>}</div></Card>
    <Card><h3>{tr("收到的回复","Réponse reçue","Employer reply")}</h3><TextArea data-analytics="tracking_reply" label={tr("粘贴或概括收到的回复","Coller ou résumer la réponse","Paste or summarize the reply")} value={reply} rows={4} maxLength={12000} onChange={e=>{setReply(e.target.value);save({replyNote:e.target.value});}} onBlur={()=>void flushTracking(key)}/></Card>
    {rows(job.replies).slice().reverse().map((r, i) => <Card key={i}><div className="jp-row spread"><Pill warm>{product(r.kind)}</Pill><Hint>{r.at?.slice(0, 10)}</Hint></div><p>{r.text}</p></Card>)}
    {!!rows(job.statusHistory).length && <Card><h3>{tr("状态时间线", "Historique des étapes", "Stage history")}</h3>{rows(job.statusHistory).slice().reverse().map((h, i) => <Hint key={i}>{h.at?.slice(0, 10)} · {product(h.status)}</Hint>)}</Card>}
  </>;
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
  return <div className="jp-sheet-content"><Pill warm={task.status === "failed"}>{stateLabel}</Pill><Hint>{task.phase}</Hint><Localization value={result.localization} />{active && <><div className="jp-progress indeterminate" /><Hint>{tr("可以离开这个页面。结果会保存在当前档案的任务记录中。", "Vous pouvez quitter cet écran. Le résultat sera conservé dans l’activité de ce profil.", "You can leave this screen. Results will remain in this profile’s activity.")}</Hint></>}
    {task.error && <Card><p style={{ color: "var(--jp-error)" }}>{product(task.error)}</p>{task.kind !== "ingest" && <Button kind="outline" onClick={() => startTask({ ...task.input, kind: task.kind, retry: true })}>{tr("重试这项操作", "Réessayer cette action", "Retry this action")}</Button>}</Card>}
    {task.status === "completed" && (task.kind === "ingest" ? <><strong>{result.filename}</strong><Hint>{tr("这是本地提取的原文，不是 AI 改写。请检查顺序、数字、日期以及当前档案。", "Texte extrait localement, sans réécriture IA. Vérifiez l’ordre, les chiffres, les dates et le profil choisi.", "Locally extracted text, not an AI rewrite. Check reading order, figures, dates and selected profile.")}</Hint><TextArea label={tr("导入预览", "Aperçu de l’import", "Import preview")} rows={15} value={proposal} onChange={e => setProposal(e.target.value)} />{confirm ? <div className="jp-confirm" role="alert"><h3>{tr("更新当前档案的主简历？", "Mettre à jour le CV de ce profil ?", "Update this profile’s master CV?")}</h3><strong>{data.profile?.name}</strong><Hint>{tr("这份简历将成为后续搜索和分析的依据。旧版会备份；未保留的经历将不再参与分析。", "Ce CV deviendra la référence des recherches et analyses. L’ancienne version sera sauvegardée ; les faits retirés ne seront plus utilisés.", "This becomes the source for future search and analysis. The old version is backed up; removed facts will no longer be used.")}</Hint><Button data-testid="confirm-import" onClick={async () => { if (await act({ action: "confirmCv", taskId: task.id, content: proposal, confirmed: true, expectedVersionId: version })) close(); }}>{tr("确认更新", "Confirmer", "Confirm")}</Button><Button kind="text" onClick={() => setConfirm(false)}>{tr("返回检查", "Revoir", "Review")}</Button></div> : <Button disabled={!proposal.trim()} onClick={() => setConfirm(true)}>{tr("确认保存", "Confirmer et enregistrer", "Confirm and save")}</Button>}<Button kind="text" onClick={close}>{tr("暂不修改主简历", "Ne pas modifier mon CV actuel", "Keep my current CV unchanged")}</Button></> : task.kind === "search" ? <><SearchMetrics value={result.searchMetrics} /><Button onClick={() => navigate({ tab: "offers" })}>{tr("查看完整搜索结果", "Voir toutes les offres", "View all search results")}</Button></> : <>
      {task.kind === "evaluate" && result.score != null && <Score score={result.score} />}
      <Markdown text={result.markdown || result.summary} />
      {task.kind === "practice" && !result.markdown && result.feedback && <Markdown text={String(result.feedback)} />}
    </>)}
  </div>;
}
