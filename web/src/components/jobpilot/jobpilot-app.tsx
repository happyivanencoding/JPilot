"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, X } from "lucide-react";
import { WorkOutline as BriefcaseBusiness, PendingActions as ClipboardClock, School as GraduationCap, Home as House, Search, PersonOutline as UserRound } from "./native-icons";
import { PilotProvider, rows, usePilot } from "./pilot-context";
import { ACTIVE, desktopScale, TABS } from "./model.mjs";
import { ApplicationsPage, HomePage, OffersPage } from "./catalog";
import { CvEditor, PreparePage, ProfilePage } from "./profile-prepare";
import { AnalysisSheet, CompareSheet, JobSheet, ResultSheet, TasksSheet } from "./sheets";
import { PdfPreview } from "./pdf-preview";
import { Button, Empty, EstimatedProgress, Hint, IconButton, Loading, Localization, Sheet, Spinner } from "./ui";

function TaskLaunchOverlay() {
  const {taskLaunch,setTaskLaunch,tr}=usePilot();
  const [flying,setFlying]=useState(false);
  const identity=taskLaunch?.ids.join(",") || "";
  useEffect(()=>{setFlying(false);},[identity]);
  useEffect(()=>{if(!flying)return;const timer=setTimeout(()=>setTaskLaunch(null),430);return()=>clearTimeout(timer);},[flying,setTaskLaunch]);
  if(!taskLaunch)return null;
  return <div className={`jp-task-launch-backdrop${flying?" flying":""}`} data-testid="background-task-launch"><div className="jp-task-launch-card"><div className="jp-task-launch-icon"><ClipboardClock size={44}/></div><h2>{tr("正在后台处理","Traitement en arrière-plan","Processing in the background")}</h2><strong>{taskLaunch.title}</strong><EstimatedProgress createdAt={taskLaunch.createdAt} estimate={taskLaunch.estimate} large /><Hint>{taskLaunch.ids.length>1?tr(`${taskLaunch.ids.length} 个任务已经加入右上角任务列表。你可以继续使用其他页面。`,`${taskLaunch.ids.length} tâches ont été ajoutées en haut à droite. Vous pouvez continuer à naviguer.`,`${taskLaunch.ids.length} tasks were added to the top-right task center. You can keep browsing.`):tr("任务已经加入右上角任务列表。你可以继续使用其他页面。","La tâche a été ajoutée en haut à droite. Vous pouvez continuer à naviguer.","The task was added to the top-right task center. You can keep browsing.")}</Hint><Button data-testid="confirm-background-task" disabled={flying} onClick={()=>setFlying(true)}>{tr("知道了","Compris","Got it")}</Button></div></div>;
}

function Phone() {
  const p = usePilot();
  const { data, ready, loading, busy, route, selectedJob, notice, error, expired, tr, navigate, close, refresh } = p;
  const [scale, setScale] = useState(1), [keyboard, setKeyboard] = useState(false), [refreshing, setRefreshing] = useState(false);
  const touch = useRef<number | null>(null);
  const maxHeight = useRef(0);
  useEffect(() => {
    const measure = () => {
      setScale(desktopScale(window.innerWidth, window.innerHeight));
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      if (viewport && viewport.scale > 1.05) return; // Browser accessibility zoom must not collapse the app frame.
      const focused = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
      if (!focused) maxHeight.current = height;
      else maxHeight.current = Math.max(maxHeight.current, height);
      setKeyboard(window.innerWidth <= 600 && focused && height < maxHeight.current - 120);
      document.documentElement.style.setProperty("--jp-visible-height", `${height}px`);
    };
    measure(); window.addEventListener("resize", measure); window.visualViewport?.addEventListener("resize", measure);
    document.addEventListener("focusin", measure); document.addEventListener("focusout", measure);
    return () => { window.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("resize", measure); document.removeEventListener("focusin", measure); document.removeEventListener("focusout", measure); };
  }, []);
  const labels = [tr("首页", "Accueil", "Home"), tr("机会", "Offres", "Offers"), tr("投递", "Candidatures", "Applications"), tr("准备", "Préparer", "Prepare"), tr("档案", "Dossier", "Profile")];
  const icons = [House, Search, BriefcaseBusiness, GraduationCap, UserRound];
  const active = rows(data.tasks).filter(t => ACTIVE.has(t.status)).length;
  const hasOverlay = Boolean(route.view || p.taskLaunch);
  const reload = async () => { if (refreshing) return; setRefreshing(true); await refresh(); setRefreshing(false); };
  const pages = [<HomePage key="home" />, <OffersPage key="offers" />, <ApplicationsPage key="applications" />, <PreparePage key="prepare" />, <ProfilePage key="profile" />];
  const canShowData = Boolean(data.profile?.id);
  return <div className="jp-stage"><div className="jp-envelope" style={{ "--jp-scale": scale } as CSSProperties}><div className={`jp-phone${keyboard ? " jp-keyboard" : ""}`} data-testid="jobpilot-phone" data-reference-size="384x832">
    {expired ? <div className="jp-login"><img src="/jobpilot.svg" alt="" /><h1>JobPilot</h1><h2>{tr("你的下一步，值得认真准备。", "Votre prochain pas mérite le meilleur.", "Your next step deserves your best.")}</h2><Hint>{tr("请重新登录以访问你的档案。", "Reconnectez-vous pour accéder à votre profil.", "Sign in again to access your profile.")}</Hint><a href="/api/mobile-auth/bridge">{tr("安全登录", "Connexion sécurisée", "Secure sign in")}</a></div> : <>
      <div className="jp-underlay" inert={hasOverlay}>
        <header className="jp-top"><div className="jp-top-row"><button type="button" className="jp-brand" onClick={() => navigate({ tab: "home" })} aria-label="JobPilot"><img src="/jobpilot.svg" alt="" width={34} height={34} /><strong>JobPilot</strong></button>
          <label className="jp-profile-switch"><select aria-label={tr("切换档案", "Changer de profil", "Switch profile")} data-testid="profile-switch" value={p.profileId} disabled={busy || !canShowData} onChange={e => void p.switchProfile(e.target.value)}>{rows(data.profiles).length ? rows(data.profiles).map(profile => <option key={profile.id} value={profile.id}>{String(profile.shortName || profile.name).split(" · ")[0]}</option>) : <option value={p.profileId}>…</option>}</select><ChevronDown size={18} /></label>
          <IconButton label={tr("后台任务", "Vos traitements", "Background tasks")} data-testid="open-tasks" onClick={() => navigate({ view: "tasks" })}><ClipboardClock size={25} />{active > 0 && <span className="jp-badge">{active}</span>}{busy && <span className="jp-busy-ring"><Spinner /></span>}</IconButton>
        </div></header>
        {error && !hasOverlay && <div className="jp-error" role="alert"><p>{error}</p><IconButton label={tr("关闭提示", "Fermer le message", "Dismiss message")} onClick={() => p.setError(null)}><X size={18} /></IconButton></div>}
        <Localization value={data.localization} />
        <main className="jp-main">
          {refreshing && <span className="jp-refreshing"><Spinner small /></span>}
          {!ready || loading && !canShowData ? <Loading /> : !canShowData ? <div className="jp-page"><Empty title={tr("暂时无法读取档案", "Profil momentanément indisponible", "Profile temporarily unavailable")}>{tr("请检查服务器连接，然后重试。", "Vérifiez la connexion au serveur, puis réessayez.", "Check the server connection, then try again.")}</Empty><Button onClick={reload}>{tr("重新连接", "Réessayer", "Retry")}</Button></div> : TABS.map((tab, index) => <section key={tab} hidden={route.tab !== tab} className="jp-scroll" aria-label={labels[index]} data-testid={`screen-${tab}`} onTouchStart={e => { touch.current = e.currentTarget.scrollTop <= 0 && !(e.target as HTMLElement).closest("button,input,textarea,select,a") ? e.touches[0].clientY : null; }} onTouchEnd={e => { if (touch.current != null && e.changedTouches[0].clientY - touch.current > 85) void reload(); touch.current = null; }}>{pages[index]}</section>)}
        </main>
        <nav className="jp-nav" aria-label={tr("主导航", "Navigation principale", "Main navigation")}>{TABS.map((tab, index) => { const Icon = icons[index]; return <button type="button" key={tab} aria-current={route.tab === tab ? "page" : undefined} data-testid={`nav-${tab}`} onClick={() => navigate({ tab })}><span><Icon size={22} strokeWidth={route.tab === tab ? 2.5 : 2} /></span>{labels[index]}</button>; })}</nav>
      </div>
      {notice && !hasOverlay && <div className="jp-toast" role="status"><span>{p.product(notice.text)}</span>{notice.taskId && <button type="button" onClick={() => { const id = notice.taskId; p.setNotice(null); if (id) void p.openTask(id); }}>{tr("查看", "Voir", "View")}</button>}</div>}
      {route.view === "tasks" && <TasksSheet />}
      {route.view === "job" && (selectedJob ? <JobSheet key={selectedJob.id} job={selectedJob} /> : <Sheet title={tr("岗位详情", "Détails du poste", "Job details")}>{loading ? <Loading /> : <div className="jp-sheet-content"><Hint>{tr("当前档案中没有这个岗位，或旧书签已失效。", "Ce poste n’est pas présent dans ce profil, ou ce favori est périmé.", "This role is not in the current profile, or this bookmark is outdated.")}</Hint><Button onClick={() => navigate({ tab: "applications" })}>{tr("查看我的投递", "Voir mes candidatures", "View my applications")}</Button></div>}</Sheet>)}
      {route.view === "analysis" && (loading && !data.analysis?.markdown ? <Sheet><Loading /></Sheet> : <AnalysisSheet key={data.analysis?.taskId || "empty"} />)}
      {route.view === "compare" && <CompareSheet />}
      {(route.view === "task" || route.view === "report") && <ResultSheet />}
      {route.view === "edit-cv" && <CvEditor />}
      {route.view === "pdf" && <PdfPreview key={`${route.job || ""}:${route.draft || ""}`} />}
      <TaskLaunchOverlay />
    </>}
  </div></div></div>;
}
export function JobPilotApp({ profileId }: { profileId: string }) { return <PilotProvider profileId={profileId}><Phone /></PilotProvider>; }
