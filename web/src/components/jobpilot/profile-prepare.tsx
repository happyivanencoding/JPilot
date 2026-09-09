"use client";
import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { rows, texts, usePilot, type Json } from "./pilot-context";
import { ACTIVE } from "./model.mjs";
import { Button, Card, Check, Chip, Hint, Input, Localization, Select, Sheet, TextArea, Title } from "./ui";

export function AnalysisEntry() {
  const { data, tr, navigate, startTask } = usePilot();
  const a = data.analysis || {}, exists = Boolean(a.markdown);
  const running = rows(data.tasks).some(t => t.kind === "analysis" && ACTIVE.has(t.status));
  return <div className="jp-stack"><h3>{tr("让招聘方看到重点", "Les bons signaux, au premier regard", "The right signals, at first glance")}</h3><Hint>{tr("不是把每一段写满，而是让最有价值的证据占据正确的位置。", "Pas davantage de texte : une place juste pour vos preuves les plus utiles.", "Not more text: the right space for your strongest evidence.")}</Hint>
    {exists && <Button data-testid="view-analysis" onClick={() => navigate({ view: "analysis" })}>{tr("查看分析", "Voir mon analyse", "View analysis")}</Button>}
    {(!exists || a.stale) && <Button kind="outline" data-testid="update-analysis" disabled={running || !data.cv?.trim()} onClick={() => startTask({ kind: "analysis" })}>{running ? tr("分析中", "Analyse en cours", "Analysis in progress") : a.stale ? tr("更新分析", "Mettre à jour l’analyse", "Update analysis") : tr("分析整份简历", "Analyser mon CV", "Analyze my CV")}</Button>}
    {a.stale && <Hint>{tr("简历发生了真实变化。更新会保留上次结论和接受过的改进。", "Votre CV a réellement changé. La mise à jour reprend les conclusions et améliorations précédentes.", "Your CV changed. Updates retain prior conclusions and accepted improvements.")}</Hint>}
  </div>;
}
export function ProfilePage() {
  const p = usePilot(); const { data, tr, product, act, busy, locale, theme, setLocale, setTheme, navigate, upload } = p;
  const picker = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [roles, setRoles] = useState(""), [location, setLocation] = useState(""), [remote, setRemote] = useState("");
  const config = data.config || {}, contracts = texts(config.target_roles?.contract_types);
  const material = data.languageSettings?.applicationLanguage || config.cv?.language || "fr";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const authenticated = typeof window !== "undefined" && (window.location.hostname === "jobs.thegreatnovel.com" || window.location.port === "3002");
  return <div className="jp-page roomy" data-testid="profile-page"><Title sub={data.profile?.name}>{tr("我的档案", "Votre profil, vos preuves.", "Your profile. Your evidence.")}</Title>
    <Card><FileText size={34} className="jp-accent" /><h2 style={{ fontSize: 22, lineHeight: "28px" }}>{tr("让简历成为起点", "Le CV comme point de départ", "Start with your CV")}</h2><Hint>{tr("PDF、Word (.docx)、TXT、Markdown，最大 12 MB。导入后先预览，再由你确认是否替换。", "PDF, Word (.docx), TXT ou Markdown · 12 Mo maximum. Aperçu avant toute modification.", "PDF, Word (.docx), TXT or Markdown · up to 12 MB. Preview before saving.")}</Hint>
      <input ref={picker} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" hidden data-testid="cv-upload-input" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }} />
      <Button data-testid="upload-cv" onClick={() => picker.current?.click()}>{tr("上传我的简历", "Importer mon CV", "Upload my CV")}</Button><div className="jp-row"><Button kind="outline" data-testid="view-master-pdf" disabled={!data.cv?.trim()} onClick={() => navigate({ tab: "profile", view: "pdf" })}>{tr("查看 PDF", "Voir le PDF", "View PDF")}</Button><Button kind="text" onClick={() => navigate({ tab: "profile", view: "edit-cv" })}>{tr("编辑内容", "Modifier le contenu", "Edit content")}</Button></div>
      {data.cvState?.cvVersion != null && <Hint>{`CV ${data.cvState.cvVersion} · ${String(data.cvState.changedAt || "").slice(0, 10)}`}</Hint>}
    </Card>
    <Card><AnalysisEntry /></Card>
    <Card><h3>{tr("默认简历语言", "Langue par défaut du CV", "Default CV language")}</h3><Hint>{tr("用于新生成的求职材料，与软件显示语言无关。更改默认值不会翻译或替换现有简历；原文改写继续保持当前文档语言。", "Pour les nouveaux documents de candidature, indépendamment de l’application. Le CV existant n’est ni traduit ni remplacé ; les retouches gardent sa langue.", "For new application documents, independently of the app. Existing CVs are not translated or replaced; edits preserve the document language.")}</Hint><div className="jp-chips">{[["fr", "Français"], ["en", "English"]].map(([key, label]) => <Chip key={key} selected={material === key} disabled={busy} data-testid={`material-language-${key}`} onClick={() => act({ applicationLanguage: key }, "/api/profile")}>{label}</Chip>)}</div></Card>
    <Card><div className="jp-row spread"><h3>{tr("求职偏好", "Mes critères", "Job preferences")}</h3><Button kind="text" onClick={() => { if (!editing) { setRoles(texts(config.target_roles?.primary).join(", ")); setLocation(config.candidate?.location || ""); setRemote(config.compensation?.location_flexibility || ""); } setEditing(!editing); }}>{tr("编辑", "Modifier", "Edit")}</Button></div><Hint>{[texts(config.target_roles?.primary).join(", "), config.candidate?.location, config.compensation?.location_flexibility].filter(Boolean).join("\n") || tr("填写目标岗位与工作地点", "Définissez les rôles et lieux ciblés.", "Set target roles and locations.")}</Hint><strong>{tr("合同／职位类型", "Types de contrat", "Contract types")}</strong><div className="jp-chips">{["Stage", "Alternance", "CDI", "CDD"].map(type => <Chip key={type} selected={contracts.includes(type)} disabled={busy} onClick={() => act({ contractTypes: contracts.includes(type) ? contracts.filter(t => t !== type) : [...contracts, type] }, "/api/profile")}>{product(type)}</Chip>)}</div>{!contracts.length && <Hint>{tr("不限制合同类型", "Tous les types de contrat", "All contract types")}</Hint>}
      {editing && <><Input label={tr("目标岗位（逗号分隔）", "Rôles ciblés (séparés par virgule)", "Target roles (comma separated)")} value={roles} onChange={e => setRoles(e.target.value)} /><Input label={tr("城市", "Localisation", "Location")} value={location} onChange={e => setLocation(e.target.value)} /><Input label={tr("远程办公偏好", "Préférence télétravail", "Remote preference")} value={remote} onChange={e => setRemote(e.target.value)} /><Button onClick={async () => { if (await act({ roles: roles.split(/[,，]/).map(x => x.trim()).filter(Boolean), location, remote }, "/api/profile")) setEditing(false); }}>{tr("保存偏好", "Enregistrer mes critères", "Save preferences")}</Button></>}
    </Card>
    <Card><h3>{tr("软件语言", "Langue de l’application", "App language")}</h3><Hint>{tr("界面、分析和建议使用此语言，不影响简历内容。", "Pour l’interface, les analyses et les conseils. Aucun effet sur le contenu du CV.", "For interface, analysis and advice; does not change CV content.")}</Hint><div className="jp-chips">{[["system", tr("系统", "Système", "System")], ["light", tr("亮色", "Clair", "Light")], ["dark", tr("暗色", "Sombre", "Dark")]].map(([key, label]) => <Chip key={key} selected={theme === key} data-testid={`theme-${key}`} onClick={() => setTheme(key)}>{label}</Chip>)}</div><div className="jp-chips">{([["zh", "中文"], ["fr", "Français"], ["en", "English"]] as const).map(([key, label]) => <Chip key={key} selected={locale === key} data-testid={`ui-language-${key}`} onClick={() => setLocale(key)}>{label}</Chip>)}</div></Card>
    <Card><h3>{tr("连接", "Connexion", "Connection")}</h3><Hint>{tr("电脑、JobPilot 和 AgentDock 需要保持运行。", "Votre PC, JobPilot et AgentDock doivent rester allumés.", "Your PC, JobPilot and AgentDock must remain running.")}</Hint><Input label={tr("当前服务器", "Serveur actuel", "Current server")} readOnly value={origin} /><Button kind="outline" onClick={() => p.refresh()}>{tr("连接并刷新", "Connecter et actualiser", "Connect and refresh")}</Button>
      {authenticated && <Button kind="text" onClick={() => p.execute(async () => { await p.request("/api/mobile-auth/logout", { method: "POST", body: "{}" }); window.location.reload(); })}>{tr("退出登录", "Se déconnecter", "Sign out")}</Button>}
      <Hint>{`JobPilot Web 0.4.3 · ${tr("与 Android 共享数据", "Données partagées avec Android", "Shared data with Android")}`}</Hint>
    </Card>
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
  return <Card><h3>{tr("模拟面试", "Entraînement à l’entretien", "Interview practice")}</h3><Hint>{tr("反馈评分衡量回答质量，不代表录用概率。", "Le score mesure votre réponse, pas votre chance d’être recruté.", "Scores assess your answer, not your hiring probability.")}</Hint>{!!suggestions.length && <div className="jp-chips">{suggestions.map((q, i) => <Chip key={i} selected={q === question} onClick={() => setQuestion(q)}>{tr(`问题 ${i + 1}`, `Question ${i + 1}`, `Question ${i + 1}`)}</Chip>)}</div>}<TextArea label={tr("面试问题", "Question", "Question")} value={question} rows={2} onChange={e => setQuestion(e.target.value)} /><TextArea label={tr("我的回答", "Ma réponse", "My answer")} value={answer} rows={5} onChange={e => setAnswer(e.target.value)} /><Button disabled={!answer.trim() || !question.trim()} onClick={() => startTask({ kind: "practice", jobId: job?.id, question, answer })}>{tr("获取逐项反馈", "Recevoir un retour précis", "Get detailed feedback")}</Button></Card>;
}
export function PreparePage() {
  const { data, tr, navigate, startTask, setTrainingJob, busy } = usePilot();
  const jobs = rows(data.jobs);
  const [selectedId, setSelectedId] = useState("");
  const selected = jobs.find(j => j.id === selectedId) || jobs[0];
  const [minutes, setMinutes] = useState(30), [deadline, setDeadline] = useState(""), [coach, setCoach] = useState("");
  useEffect(() => { setTrainingJob(selected?.id || ""); }, [selected?.id, setTrainingJob]);
  return <div className="jp-page roomy" data-testid="prepare-page"><Title sub={tr("训练围绕真实经历和目标岗位展开。", "Un entraînement lié à vos preuves et au poste visé.", "Practice grounded in your experience and target job.")}>{tr("把优势讲清楚。", "Préparez votre différence.", "Prepare your advantage.")}</Title>{data.analysis?.markdown && <Button kind="text" onClick={() => navigate({ tab: "prepare", view: "analysis" })}>{tr("查看已有的优势与能力分析", "Consulter mes forces et compétences", "Review my strengths and skills")}</Button>}<Localization value={selected?.localization} />
    <Card><h3>{tr("为一个具体岗位准备", "Un plan pour un poste précis", "A plan for a specific role")}</h3><Select label={tr("目标岗位", "Poste ciblé", "Target role")} value={selected?.id || ""} onChange={setSelectedId} disabled={!jobs.length}>{!jobs.length && <option value="">{tr("先收藏一个岗位", "Enregistrez d’abord une offre", "Save an offer first")}</option>}{jobs.map(j => <option key={j.id} value={j.id}>{j.company} · {j.role}</option>)}</Select><label>{tr(`每天 ${minutes} 分钟`, `${minutes} minutes par jour`, `${minutes} minutes per day`)}<input className="jp-range" type="range" min="15" max="60" step="15" value={minutes} onChange={e => setMinutes(Number(e.target.value))} /></label><Input type="date" label={tr("面试日期（可选）", "Date d’entretien (facultative)", "Interview date (optional)")} value={deadline} onChange={e => setDeadline(e.target.value)} /><Button disabled={!selected || busy} onClick={() => startTask({ kind: "plan", jobId: selected?.id, minutesPerDay: minutes, interviewDate: deadline })}>{selected?.mobilePlan?.markdown ? tr("查看／更新训练计划", "Consulter / actualiser le plan", "Review / update plan") : tr("生成针对性训练计划", "Créer mon plan ciblé", "Create a targeted plan")}</Button></Card>
    {selected && <PrepChecklist job={selected} />}<PracticeCard job={selected} key={selected?.id || "general"} />
    <Card><h3>{tr("职业教练", "Coach carrière", "Career coach")}</h3><TextArea label={tr("关于我的职业路径……", "À propos de mon parcours…", "About my career…")} value={coach} rows={3} onChange={e => setCoach(e.target.value)} /><Button kind="outline" disabled={!coach.trim()} onClick={() => startTask({ kind: "coach", jobId: selected?.id, question: coach })}>{tr("一起思考", "Réfléchir avec mon coach", "Think with my coach")}</Button></Card>
  </div>;
}
