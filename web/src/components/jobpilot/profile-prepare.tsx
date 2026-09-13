"use client";
import {ensureCvConsent} from "./cv-consent";
import {SearchAreaSettings} from "./search-area";
import {ProfileApplications} from "./profile-applications";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { rows, texts, usePilot, type Json } from "./pilot-context";
import { ACTIVE } from "./model.mjs";
import { AiProgressButton, Button, Card, Check, Chip, Hint, Input, Localization, Select, Sheet, TextArea, Title } from "./ui";

export function AnalysisEntry() {
  const { data, tr, navigate } = usePilot();
  const a = data.analysis || {}, exists = Boolean(a.markdown);
  const background=Boolean(data.v1?.backgroundActive);
  return <div className="jp-stack"><h3>{tr("Onward 对你的理解", "Ce que Onward comprend de votre profil", "How Onward understands your profile")}</h3><Hint>{tr("上传或修改主简历后会自动更新，不需要再手动点击 AI 分析。", "L’analyse se met à jour automatiquement après une modification du CV de référence.", "This updates automatically when your master CV changes; no separate AI button is needed.")}</Hint>
    {background&&<><div className="jp-progress indeterminate"/><Hint>{tr("正在后台更新职业方向和首批岗位…","Mise à jour des directions et des premières offres…","Updating directions and initial roles in the background…")}</Hint></>}
    {exists && <Button kind="outline" data-testid="view-analysis" onClick={() => navigate({ tab:"profile",view: "analysis" })}>{tr("查看完整优势与真实行动", "Voir les atouts et actions réelles", "See strengths and real actions")}</Button>}
  </div>;
}

const appliedStages=new Set(["applied","responded","interview","offer","hired","rejected"]);
function hasApplied(job:Json) {
  if(appliedStages.has(String(job.stage||""))) return true;
  const history=[job.status,...rows(job.statusHistory).flatMap(item=>[item.status,item.from])].filter(Boolean).join(" ").toLocaleLowerCase("fr");
  return /envoy|applied|réponse|respond|entretien|interview|offre reçue|embauch|hired|refus|reject/.test(history);
}
function ProfileSection({title,summary,children,testId}:{title:string;summary?:string;children:ReactNode;testId:string}) {
  return <details className="onward-profile-section" data-testid={testId}><summary><span><strong>{title}</strong>{summary&&<small>{summary}</small>}</span><ChevronDown size={18}/></summary><div className="onward-profile-section-body">{children}</div></details>;
}

function ProfileJobsOverlay({jobs,onClose}:{jobs:Json[];onClose:()=>void}) {
  const {tr}=usePilot();
  const [host,setHost]=useState<HTMLElement|null>(null);
  useEffect(()=>{setHost(document.querySelector<HTMLElement>(".jp-phone")||document.body);},[]);
  if(!host)return null;
  return createPortal(<Sheet full className="onward-profile-jobs-overlay" title={tr("我的岗位","Mes offres","My roles")} onClose={onClose} testId="profile-jobs-sheet"><div className="jp-sheet-content onward-profile-collection onward-profile-jobs-content"><ProfileApplications jobs={jobs} heading={false} openTab={0} onBeforeOpen={onClose}/></div></Sheet>,host);
}

export function ProfilePage() {
  const p = usePilot(); const { data, tr, product, act, busy, locale, theme, setLocale, setTheme, navigate, upload } = p;
  const picker = useRef<HTMLInputElement>(null);
  const [jobsOpen,setJobsOpen]=useState(false);
  const [cvExpanded,setCvExpanded]=useState(false);
  const config = data.config || {}, contracts = texts(config.target_roles?.contract_types);
  const material:"fr"|"en" = (data.languageSettings?.applicationLanguage || config.cv?.language)==="en" ? "en" : "fr";
  const authenticated = typeof window !== "undefined" && (window.location.hostname === "jobs.thegreatnovel.com" || window.location.port === "3002");
  const jobs=rows(data.jobs);
  const appliedJobs=jobs.filter(hasApplied);
  const searchArea=config.target_roles?.search_area||{};
  const searchAreaLabel=searchArea.scope==="france"?tr("全法国","Toute la France","All of France"):String(searchArea.city||"");
  const preferenceSummary=[texts(config.target_roles?.primary).join(", "),searchAreaLabel,config.compensation?.location_flexibility].filter(Boolean).join(" · ")||tr("目标岗位、地点与合同类型","Rôles, lieux et types de contrat","Roles, location and contract types");
  const chooseCv=async()=>{await ensureCvConsent(p.request,locale);picker.current?.click();};
  return <div className="jp-page roomy" data-testid="profile-page">
    {jobsOpen&&<ProfileJobsOverlay jobs={jobs} onClose={()=>setJobsOpen(false)}/>}
    <header className="onward-profile-head"><h1>{tr("我的职业档案","Mon profil","My profile")}</h1><p>{tr("你的资料、偏好和求职工具都集中在这里。","Vos informations, vos préférences et vos outils réunis pour aller plus loin.","Your information, preferences and career tools in one place.")}</p>{data.profile?.name&&<strong>{data.profile.name}</strong>}</header>
    <div className="onward-profile-summary" aria-label={tr("职业档案摘要","Résumé du profil","Profile summary")}>
      <button type="button" className="onward-profile-jobs-toggle" data-testid="profile-jobs-toggle" onClick={()=>setJobsOpen(true)}><span>{tr(`${jobs.length} 个岗位 · ${appliedJobs.length} 个申请中`,`${jobs.length} offres · ${appliedJobs.length} candidatures`,`${jobs.length} roles · ${appliedJobs.length} applications`)}</span><ChevronRight size={15}/></button>
      <button type="button" className="onward-profile-cv-toggle" data-testid="profile-cv-toggle" aria-expanded={cvExpanded} aria-controls="profile-original-cv-actions" onClick={()=>setCvExpanded(value=>!value)}>{tr("我的原始简历","CV d’origine","Original CV")}<ChevronDown size={15}/></button>
      <input ref={picker} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" hidden data-testid="cv-upload-input" onChange={e => { const input=e.currentTarget; const file=input.files?.[0]; if(file) void upload(file,material,data.languageSettings?.analysisLanguage || locale).finally(()=>{input.value="";}); }} />
      {cvExpanded&&<div id="profile-original-cv-actions" className="onward-profile-cv-expanded"><div className="jp-row wrap onward-master-cv-actions"><Button kind="outline" data-testid="view-master-pdf" disabled={!data.cv?.trim()} onClick={() => navigate({ tab: "profile", view: "pdf" })}>{tr("查看原简历", "Voir le CV original", "View original CV")}</Button><Button data-testid="upload-cv" onClick={() => void chooseCv()}>{data.cv?.trim()?tr("更新简历","Mettre à jour le CV","Update CV"):tr("上传简历","Importer mon CV","Upload CV")}</Button><Button kind="text" onClick={() => navigate({ tab: "profile", view: "edit-cv" })}>{tr("编辑提取内容", "Modifier le contenu extrait", "Edit extracted content")}</Button></div></div>}
    </div>
    <div className="onward-profile-menu">
    {!p.preview&&<ProfileSection testId="profile-section-analysis" title={tr("职业分析","Analyse du profil","Career analysis")} summary={data.analysis?.markdown?tr("已更新","À jour","Updated"):tr("待生成","À préparer","Pending")}><AnalysisEntry/></ProfileSection>}

    <ProfileSection testId="profile-section-language" title={tr("语言","Langues","Languages")} summary={locale==="zh"?"中文":locale==="fr"?"Français":"English"}><div className="jp-stack"><strong>{tr("界面与分析","Application et conseils","App and insights")}</strong><div className="jp-chips">{([["zh","中文"],["fr","Français"],["en","English"]] as const).map(([code,label])=><Chip key={code} selected={locale===code} disabled={busy} data-testid={`ui-language-${code}`} onClick={()=>setLocale(code)}>{label}</Chip>)}</div><Hint>{tr("分析、岗位详情和公司相关说明始终跟随界面语言；未识别系统语言时使用 English。","Les analyses, les offres et les informations sur les entreprises suivent toujours la langue de l’application ; English est utilisé si la langue système n’est pas reconnue.","Analysis, role details and company information always follow the app language; English is used when the system language is not recognised.")}</Hint><hr/><strong>{tr("求职简历","CV de candidature","Application CV")}</strong><div className="jp-chips">{[["fr","Français"],["en","English"]].map(([code,label])=><Chip key={code} selected={material===code} disabled={busy} data-testid={`material-language-${code}`} onClick={()=>act({applicationLanguage:code},"/api/profile")}>{label}</Chip>)}</div><Hint>{tr("只决定新生成简历的语言，不限制岗位搜索。上传其他语言的简历时，岗位版简历会翻译成这里选择的语言。","Ce choix détermine uniquement la langue des nouveaux CV et ne filtre pas les offres. Si votre CV importé est dans une autre langue, le CV ciblé sera traduit dans la langue choisie ici.","This only sets the language of newly generated CVs and does not filter job search. If the uploaded CV is in another language, the role-specific CV will be translated into the language chosen here.")}</Hint></div></ProfileSection>
    <ProfileSection testId="profile-section-preferences" title={tr("求职偏好","Mes critères","Job preferences")} summary={preferenceSummary}><div className="jp-stack"><SearchAreaSettings key={p.profileId} embedded/><strong>{tr("岗位与合同","Postes et contrats","Roles and contracts")}</strong><strong>{tr("合同类型 · 可多选", "Types de contrat · plusieurs choix possibles", "Contract types · select multiple")}</strong><div className="jp-chips">{["Stage", "Alternance", "CDI", "CDD"].map(type => <Chip key={type} selected={contracts.includes(type)} disabled={busy} onClick={() => act({ contractTypes: contracts.includes(type) ? contracts.filter(t => t !== type) : [...contracts, type] }, "/api/profile")}>{product(type)}</Chip>)}</div>{!contracts.length && <Hint>{tr("不限制合同类型", "Tous les types de contrat", "All contract types")}</Hint>}</div></ProfileSection>
    <ProfileSection testId="profile-section-appearance" title={tr("外观","Apparence","Appearance")} summary={theme==="system"?tr("跟随系统","Système","System"):theme==="dark"?tr("暗色","Sombre","Dark"):tr("亮色","Clair","Light")}><div className="jp-chips">{[["system",tr("系统","Système","System")],["light",tr("亮色","Clair","Light")],["dark",tr("暗色","Sombre","Dark")]].map(([key,label])=><Chip key={key} selected={theme===key} data-testid={`theme-${key}`} onClick={()=>setTheme(key)}>{label}</Chip>)}</div></ProfileSection>

    {(p.preview||authenticated)&&<Button kind="text" data-testid="sign-out" onClick={()=>p.logout()}>{tr("登出","Se déconnecter","Sign out")}</Button>}
    </div>
  </div>;
}

export function CvEditor() {
  const { data, tr, act, close } = usePilot();
  const [content, setContent] = useState<string>(data.cv || "");
  const [version] = useState(data.cvState?.versionId);
  const [confirm, setConfirm] = useState(false);
  return <Sheet title={tr("我的主简历", "Mon CV de référence", "My master CV")} testId="cv-editor"><div className="jp-sheet-content"><Hint>{data.profile?.name}</Hint><TextArea label={tr("简历内容", "Contenu du CV", "CV content")} className="jp-cv-editor" rows={16} value={content} onChange={e => setContent(e.target.value)} />{confirm ? <div className="jp-confirm" role="alert"><h3>{tr("替换当前主简历？", "Remplacer le CV actuel ?", "Replace the current CV?")}</h3><Hint>{tr("这将更新当前档案的求职依据。旧版会备份，未保留的经历将不再参与后续分析。", "Cette version deviendra la référence du profil sélectionné. L’ancienne version sera sauvegardée ; les faits retirés ne seront plus inclus dans les analyses.", "This becomes the selected profile’s reference CV. The previous version is backed up; removed facts will no longer inform analysis.")}</Hint><Button data-testid="confirm-cv-save" onClick={async () => { if (await act({ content, expectedVersionId: version }, "/api/cv")) close(); }}>{tr("确认保存", "Confirmer", "Confirm")}</Button><Button kind="text" onClick={() => setConfirm(false)}>{tr("返回检查", "Revoir", "Review")}</Button></div> : <Button disabled={!content.trim()} onClick={() => setConfirm(true)}>{tr("保存修改", "Enregistrer les modifications", "Save changes")}</Button>}</div></Sheet>;
}

export function PrepChecklist({ job }: { job: Json }) {
  const { act, busy, tr, openTask } = usePilot(); const tasks = rows(job.prepTasks);
  if (!tasks.length) return null;
  const done = tasks.filter(t => t.done).length;
  return <Card><h3>{tr("准备清单", "Ma préparation", "Preparation checklist")}</h3><div className="jp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={done}><span style={{ width: `${done / tasks.length * 100}%` }} /></div><Hint>{`${done} / ${tasks.length} ${tr("已完成", "terminé", "completed")}`}</Hint>{tasks.map(task => <Check key={task.id} checked={Boolean(task.done)} disabled={busy} onChange={value => { void act({ action: "updateJob", id: job.id, change: { taskId: task.id, taskDone: value } }); }}>{task.label}</Check>)}{job.mobilePlan?.taskId && <Button kind="text" onClick={() => openTask(job.mobilePlan.taskId)}>{tr("查看完整计划", "Lire le plan complet", "Read full plan")}</Button>}</Card>;
}
export function PracticeCard({ job, initialQuestion }: { job?: Json; initialQuestion?: string }) {
  const { tr, startTask } = usePilot();
  const suggestions = [...new Set([...texts(job?.mobilePlan?.questions), ...rows(job?.interview?.questions).map(q => String(q.question))])].slice(0, 8);
  const defaultQuestion = initialQuestion || suggestions[0] || tr("请介绍你的经历，以及为什么申请这个岗位。", "Présentez votre parcours et votre motivation pour ce poste.", "Introduce your experience and motivation for this role.");
  const [question, setQuestion] = useState(defaultQuestion), [answer, setAnswer] = useState("");
  const previous = useRef(defaultQuestion);
  useEffect(() => { const old = previous.current; setQuestion(q => q === old || initialQuestion ? defaultQuestion : q); previous.current = defaultQuestion; }, [defaultQuestion, initialQuestion]);
  return <Card><h3>{tr("模拟面试", "Entraînement à l’entretien", "Interview practice")}</h3><Hint>{tr("反馈评分衡量回答质量，不代表录用概率。", "Le score mesure votre réponse, pas votre chance d’être recruté.", "Scores assess your answer, not your hiring probability.")}</Hint>{!!suggestions.length && <div className="jp-chips">{suggestions.map((q, i) => <Chip key={i} selected={q === question} onClick={() => setQuestion(q)}>{tr(`问题 ${i + 1}`, `Question ${i + 1}`, `Question ${i + 1}`)}</Chip>)}</div>}<TextArea label={tr("面试问题", "Question", "Question")} value={question} rows={2} onChange={e => setQuestion(e.target.value)} /><TextArea label={tr("我的回答", "Ma réponse", "My answer")} value={answer} rows={5} onChange={e => setAnswer(e.target.value)} /><AiProgressButton taskKind="practice" jobId={job?.id} disabled={!answer.trim() || !question.trim()} onClick={() => startTask({ kind: "practice", jobId: job?.id, question, answer })}>{tr("获取逐项反馈", "Recevoir un retour précis", "Get detailed feedback")}</AiProgressButton></Card>;
}
export function PreparePage() {
  const { data, tr, navigate, startTask, setTrainingJob, busy } = usePilot();
  const jobs = rows(data.jobs);
  const [selectedId, setSelectedId] = useState("");
  const selected = jobs.find(j => j.id === selectedId) || jobs[0];
  const [minutes, setMinutes] = useState(30), [deadline, setDeadline] = useState(""), [coach, setCoach] = useState("");
  const existingPlan=Boolean(selected?.mobilePlan?.markdown);
  useEffect(() => { setTrainingJob(selected?.id || ""); }, [selected?.id, setTrainingJob]);
  return <div className="jp-page roomy" data-testid="prepare-page"><Title sub={tr("训练围绕真实经历和目标岗位展开。", "Un entraînement lié à vos preuves et au poste visé.", "Practice grounded in your experience and target job.")}>{tr("把优势讲清楚。", "Préparez votre différence.", "Prepare your advantage.")}</Title>{data.analysis?.markdown && <Button kind="text" onClick={() => navigate({ tab: "prepare", view: "analysis" })}>{tr("查看已有的优势与能力分析", "Consulter mes forces et compétences", "Review my strengths and skills")}</Button>}<Localization value={selected?.localization} />
    <Card><h3>{tr("为一个具体岗位准备", "Un plan pour un poste précis", "A plan for a specific role")}</h3><Select label={tr("目标岗位", "Poste ciblé", "Target role")} value={selected?.id || ""} onChange={setSelectedId} disabled={!jobs.length}>{!jobs.length && <option value="">{tr("先收藏一个岗位", "Enregistrez d’abord une offre", "Save an offer first")}</option>}{jobs.map(j => <option key={j.id} value={j.id}>{j.company} · {j.role}</option>)}</Select><label>{tr(`每天 ${minutes} 分钟`, `${minutes} minutes par jour`, `${minutes} minutes per day`)}<input className="jp-range" type="range" min="15" max="60" step="15" value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label><Input type="date" label={tr("面试日期（可选）", "Date d’entretien (facultative)", "Interview date (optional)")} value={deadline} onChange={e => setDeadline(e.target.value)} /><AiProgressButton taskKind="plan" jobId={selected?.id} disabled={!selected || busy} onClick={() => startTask({ kind: "plan", jobId: selected?.id, minutesPerDay: minutes, interviewDate: deadline, retry: existingPlan })}>{existingPlan ? tr("更新训练计划", "Actualiser le plan", "Update plan") : tr("生成针对性训练计划", "Créer mon plan ciblé", "Create a targeted plan")}</AiProgressButton></Card>
    {selected && <PrepChecklist job={selected} />}<PracticeCard job={selected} key={selected?.id || "general"} />
    <Card><h3>{tr("职业教练", "Coach carrière", "Career coach")}</h3><TextArea label={tr("关于我的职业路径……", "À propos de mon parcours…", "About my career…")} value={coach} rows={3} onChange={e => setCoach(e.target.value)} /><AiProgressButton taskKind="coach" jobId={selected?.id} kind="outline" disabled={!coach.trim()} onClick={() => startTask({ kind: "coach", jobId: selected?.id, question: coach })}>{tr("一起思考", "Réfléchir avec mon coach", "Think with my coach")}</AiProgressButton></Card>
  </div>;
}
