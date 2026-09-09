"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, CircleAlert } from "lucide-react";
import { rows, texts, usePilot, type Json } from "./pilot-context";
import { ACTIVE, centerTasks, destinationFor } from "./model.mjs";
import { Button, Card, Check, Chip, Empty, EstimatedProgress, External, Hint, Input, Loading, Localization, Markdown, Metrics, Pill, Score, Select, Sheet, Tabs, TextArea, Title, taskName } from "./ui";
import { PracticeCard, PrepChecklist } from "./profile-prepare";
import { SearchMetrics } from "./catalog";

export function TasksSheet() {
  const { data, tr, openTask } = usePilot();
  const tasks = centerTasks(rows(data.tasks)) as Json[];
  return <Sheet title={tr("后台任务", "Vos traitements", "Background tasks")} testId="tasks-sheet"><div className="jp-sheet-content"><Hint>{tr("已完成的结果，直接回到对应页面。", "Vos résultats, au bon endroit.", "Your results, where they belong.")}</Hint><Localization value={data.localization} />{!tasks.length && <Hint>{tr("当前没有任务。", "Aucun traitement pour ce profil.", "No tasks for this profile.")}</Hint>}{tasks.map(task => <button type="button" className="jp-task-row" key={task.id} data-testid={`task-${task.id}`} onClick={() => openTask(task.id)}><div className="jp-row">{task.status === "completed" ? <CheckCircle2 size={20} className="jp-accent" /> : ACTIVE.has(task.status) ? null : <CircleAlert size={20} />}<h3 className="jp-grow">{task.title || taskName(task.kind, tr)}</h3><ChevronRight size={18} /></div><Hint>{task.phase}</Hint>{ACTIVE.has(task.status) && <EstimatedProgress createdAt={task.createdAt} estimate={task.estimate} />}<Metrics value={task.metrics} /></button>)}</div></Sheet>;
}
export function JobSheet({ job }: { job: Json }) {
  const { route, data, tr, product, navigate, startTask } = usePilot();
  const tab = Math.min(3, Math.max(0, Number(route.jobTab) || 0));
  const evaluating = rows(data.tasks).some(t => t.kind === "evaluate" && t.jobId === job.id && ACTIVE.has(t.status));
  const cv = job.cv || {}, interview = job.interview || {};
  const [question, setQuestion] = useState("");
  const practiceRef=useRef<HTMLDivElement>(null);
  const practice=(value:string)=>{setQuestion(value);requestAnimationFrame(()=>practiceRef.current?.scrollIntoView({behavior:"smooth",block:"center"}));};
  return <Sheet title={<><div className="jp-subtitle">{job.company}</div><div className="jp-row"><span className="jp-grow">{job.role}</span><Score score={job.score} /></div></>} testId={`job-detail-${job.id}`}>
    <Tabs labels={[tr("匹配", "Match", "Fit"), "CV", tr("面试", "Entretien", "Interview"), tr("跟踪", "Suivi", "Tracking")]} selected={tab} prefix="job-tab" onChange={i => navigate({ ...route, jobTab: String(i) }, true)} />
    <div className="jp-sheet-content" data-testid="job-content"><Localization value={job.localization} />
      {tab === 0 && <>
        <div className="jp-row wrap"><Pill>{product(job.status)}</Pill>{job.lastChecked && <Pill>{job.lastChecked.slice(0, 10)}</Pill>}</div>
        {job.recommendation && <h4 className="jp-accent">{product(job.recommendation)}</h4>}<Hint>{[job.location, product(job.workMode), product(job.contract)].filter(Boolean).join(" · ")}</Hint><External url={job.url}>{tr("打开原始职位页", "Ouvrir l’annonce officielle", "Open original job page")}</External>
        {job.summary && <Card><h3>{tr("判断依据", "Lecture du poste", "Assessment")}</h3><Markdown text={job.summary} />{job.angle && <><hr /><p>{job.angle}</p></>}</Card>}
        {!!texts(job.strengths).length && <Card><h3>{tr("优势与证据", "Vos atouts documentés", "Documented strengths")}</h3>{texts(job.strengths).map((s, i) => <p className="jp-bullet" key={i}>{s}</p>)}</Card>}
        {!!rows(job.gaps).length && <h3>{tr("需要准备的差距", "Les écarts à préparer", "Gaps to prepare")}</h3>}{rows(job.gaps).map((gap, i) => <Card key={i}><h4>{gap.title}</h4>{gap.severity && <Pill warm>{product(gap.severity)}</Pill>}<p>{gap.why}</p><Hint>{gap.positioning}</Hint></Card>)}
        {rows(job.match).map((match, i) => <Card key={i}><h4>{match.requirement}</h4><Pill>{product(match.fit)}</Pill><p>{match.evidence}</p><Hint>{match.action}</Hint></Card>)}
        {job.evaluationState !== "evaluated" && <Button data-testid="evaluate-job" disabled={evaluating} onClick={() => startTask({ kind: "evaluate", url: job.url })}>{evaluating ? tr("分析中", "Évaluation en cours", "Evaluating") : tr("运行正式评估", "Évaluer ce poste", "Evaluate this role")}</Button>}
        <Hint>{tr("已保存的评估不会重复生成。评分不是录用概率。", "Les évaluations enregistrées ne sont pas régénérées. Le score n’est pas une probabilité d’embauche.", "Saved evaluations are not regenerated. Scores are not hiring probabilities.")}</Hint>
        {job.reportNum && <Button kind="text" data-testid="view-report" onClick={() => navigate({ view: "report", report: job.id, job: job.id })}>{tr("查看完整评估报告", "Lire le rapport complet", "Read full report")}</Button>}
      </>}
      {tab === 1 && <>
        <Card><h2 style={{ fontSize: 22 }}>{tr("为这个岗位调整表达", "La bonne version, pour ce poste.", "The right version for this role.")}</h2><Hint>{tr("使用当前档案的已核实经历，不添加不存在的技能或成果。", "À partir des preuves du profil actif, sans inventer de compétences ni de résultats.", "Uses the active profile’s evidence, without inventing skills or achievements.")}</Hint><div className="jp-row wrap">{cv.atsScore != null && <Pill>ATS {cv.atsScore}/100</Pill>}{!!texts(cv.keywords).length && cv.keywordCoverage != null && <Pill>{tr("关键词", "Mots-clés", "Keywords")} {cv.keywordCoverage}%</Pill>}</div>
          <Button onClick={() => cv.file ? navigate({ view: "pdf", job: job.id }) : startTask({ kind: "cv", jobId: job.id })}>{cv.file ? tr("查看定制简历", "Voir mon CV adapté", "View tailored CV") : tr("生成定制 PDF 简历", "Générer mon CV adapté", "Generate tailored PDF CV")}</Button>
          {cv.inputVersionId && cv.inputVersionId !== data.cvState?.versionId && <Button kind="text" onClick={() => startTask({ kind: "cv", jobId: job.id })}>{tr("根据新版 CV 更新", "Actualiser avec mon nouveau CV", "Update with my new CV")}</Button>}
          {cv.file && <Button kind="outline" onClick={() => navigate({ view: "pdf", job: job.id })}>{tr("打开或分享 PDF", "Ouvrir / partager le PDF", "Open / share PDF")}</Button>}
        </Card>
        {!!texts(cv.changes).length && <Card><h3>{tr("这份简历的调整", "Ce qui a été adapté", "What changed")}</h3>{texts(cv.changes).map((s, i) => <p className="jp-bullet" key={i}>{s}</p>)}</Card>}{!!texts(cv.keywords).length && <Card><h3>{tr("岗位关键词", "Mots-clés du poste", "Role keywords")}</h3><p>{texts(cv.keywords).join(" · ")}</p></Card>}
      </>}
      {tab === 2 && <>
        {!job.mobilePlan?.markdown && <Button onClick={() => startTask({ kind: "plan", jobId: job.id, minutesPerDay: 30 })}>{tr("制定针对性准备计划", "Créer un plan de préparation", "Create a preparation plan")}</Button>}
        {job.mobilePlan?.markdown && <Card><Markdown text={job.mobilePlan.markdown} /></Card>}<PrepChecklist job={job} />
        {!!texts(interview.process).length && <Card><h3>{tr("面试流程", "Processus d’entretien", "Interview process")}</h3>{texts(interview.process).map((s, i) => <p className="jp-bullet" key={i}>{s}</p>)}{!interview.processKnown && <Pill warm>{tr("实际流程待确认", "À confirmer avec le recruteur", "Confirm with recruiter")}</Pill>}</Card>}
        {interview.caseStudy && <Card><h3>{tr("针对性案例", "Cas à préparer", "Case preparation")}</h3><p>{interview.caseStudy}</p></Card>}
        {rows(interview.questions).map((q, i) => <Card key={i}><h4>{q.question}</h4><p>{q.answer}</p><Hint>{q.proof}</Hint><Button kind="text" data-testid="practice-this-question" onClick={() => practice(q.question)}>{tr("练习这道题", "M’entraîner à cette question", "Practice this question")}</Button></Card>)}<div ref={practiceRef} data-testid="targeted-practice"><PracticeCard job={job} initialQuestion={question || undefined} /></div>
      </>}
      {tab === 3 && <Tracking job={job} />}
    </div>
  </Sheet>;
}
function Tracking({ job }: { job: Json }) {
  const { data, tr, product, act } = usePilot();
  const [status, setStatus] = useState(job.status || "À candidater"), [next, setNext] = useState(job.followup?.nextAction || ""), [date, setDate] = useState(job.followup?.dueDate || ""), [note, setNote] = useState(job.followup?.note || "");
  const editedNext = useRef(false);
  const [reply, setReply] = useState(""), [replyKind, setReplyKind] = useState("Recruteur");
  useEffect(() => { if (!editedNext.current) setNext(job.followup?.nextAction || ""); }, [job.followup?.nextAction]);
  return <>
    <Card><h3>{tr("投递状态", "Statut de candidature", "Application status")}</h3><Select label={tr("当前阶段", "Étape actuelle", "Current stage")} value={status} onChange={setStatus}>{texts(data.statuses).map(s => <option key={s} value={s}>{product(s)}</option>)}</Select><Input label={tr("下一步行动", "Prochaine action", "Next action")} value={next} maxLength={12000} onChange={e => { setNext(e.target.value); editedNext.current = true; }} /><Input type="date" label={tr("跟进日期", "Date de relance", "Follow-up date")} value={date} onChange={e => setDate(e.target.value)} /><TextArea label={tr("我的备注", "Mes notes", "My notes")} value={note} rows={3} maxLength={12000} onChange={e => setNote(e.target.value)} /><Button data-testid="save-tracking" onClick={() => act({ action: "updateJob", id: job.id, change: { status, dueDate: date, note, ...(editedNext.current ? { nextAction: next } : {}) } })}>{tr("保存跟踪状态", "Enregistrer le suivi", "Save tracking")}</Button></Card>
    <Card><h3>{tr("记录对方的回复", "Une réponse du recruteur ?", "Heard from the employer?")}</h3><div className="jp-chips">{["Accusé auto", "Recruteur", "Entretien", "Refus", "Offre"].map(kind => <Chip key={kind} selected={replyKind === kind} onClick={() => setReplyKind(kind)}>{product(kind)}</Chip>)}</div><TextArea label={tr("粘贴或概括收到的回复", "Coller ou résumer la réponse", "Paste or summarize the reply")} value={reply} rows={4} maxLength={12000} onChange={e => setReply(e.target.value)} /><Hint>{tr("只保存记录，不会发送邮件。投递阶段可在上方调整。", "Aucun email n’est envoyé. Vous pouvez ajuster le statut ci-dessus.", "No email is sent. Update the stage above as needed.")}</Hint><Button disabled={!reply.trim()} onClick={async () => { if (await act({ action: "updateJob", id: job.id, change: { reply, replyKind } })) setReply(""); }}>{tr("保存回复", "Enregistrer la réponse", "Save reply")}</Button></Card>
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
  return <div className="jp-sheet-content"><Pill warm={task.status === "failed"}>{stateLabel}</Pill><Hint>{task.phase}</Hint><Localization value={result.localization} />{active && <><div className="jp-progress indeterminate" /><Hint>{tr("可以离开这个页面。结果会保存在当前档案的任务记录中。", "Vous pouvez quitter cet écran. Le résultat sera conservé dans l’activité de ce profil.", "You can leave this screen. Results will remain in this profile’s activity.")}</Hint></>}<Metrics value={task.metrics} />
    {task.error && <Card><p style={{ color: "var(--jp-error)" }}>{product(task.error)}</p>{task.kind !== "ingest" && <Button kind="outline" onClick={() => startTask({ ...task.input, kind: task.kind, retry: true })}>{tr("重试这项操作", "Réessayer cette action", "Retry this action")}</Button>}</Card>}
    {task.status === "completed" && (task.kind === "ingest" ? <><strong>{result.filename}</strong><Hint>{tr("这是本地提取的原文，不是 AI 改写。请检查顺序、数字、日期以及当前档案。", "Texte extrait localement, sans réécriture IA. Vérifiez l’ordre, les chiffres, les dates et le profil choisi.", "Locally extracted text, not an AI rewrite. Check reading order, figures, dates and selected profile.")}</Hint><TextArea label={tr("导入预览", "Aperçu de l’import", "Import preview")} rows={15} value={proposal} onChange={e => setProposal(e.target.value)} />{confirm ? <div className="jp-confirm" role="alert"><h3>{tr("更新当前档案的主简历？", "Mettre à jour le CV de ce profil ?", "Update this profile’s master CV?")}</h3><strong>{data.profile?.name}</strong><Hint>{tr("这份简历将成为后续搜索和分析的依据。旧版会备份；未保留的经历将不再参与分析。", "Ce CV deviendra la référence des recherches et analyses. L’ancienne version sera sauvegardée ; les faits retirés ne seront plus utilisés.", "This becomes the source for future search and analysis. The old version is backed up; removed facts will no longer be used.")}</Hint><Button data-testid="confirm-import" onClick={async () => { if (await act({ action: "confirmCv", taskId: task.id, content: proposal, confirmed: true, expectedVersionId: version })) close(); }}>{tr("确认更新", "Confirmer", "Confirm")}</Button><Button kind="text" onClick={() => setConfirm(false)}>{tr("返回检查", "Revoir", "Review")}</Button></div> : <Button disabled={!proposal.trim()} onClick={() => setConfirm(true)}>{tr("确认保存", "Confirmer et enregistrer", "Confirm and save")}</Button>}<Button kind="text" onClick={close}>{tr("暂不修改主简历", "Ne pas modifier mon CV actuel", "Keep my current CV unchanged")}</Button></> : task.kind === "search" ? <><SearchMetrics value={result.searchMetrics} /><Button onClick={() => navigate({ tab: "offers" })}>{tr("查看完整搜索结果", "Voir toutes les offres", "View all search results")}</Button></> : <>
      {task.kind === "evaluate" && result.score != null && <Score score={result.score} />}
      <Markdown text={result.markdown || result.summary} />
      {task.kind === "practice" && !result.markdown && result.feedback && <Markdown text={String(result.feedback)} />}
    </>)}
  </div>;
}
