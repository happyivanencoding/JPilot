"use client";
import {analyticsContext,useAnalytics} from "./analytics";
import {systemUiLanguage} from "@/lib/search-area.mjs";
import {trackingAutosave} from "./tracking-autosave.mjs";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dictionary from "../../../shared/jobpilot-i18n.json";
import { ACTIVE, destinationFor, parseRoute, pendingDisplay, routeUrl } from "./model.mjs";

// The existing mobile API is a versioned JSON projection, not a second browser database.
export type Json = Record<string, any>;
export type Locale = "zh" | "fr" | "en";
export type Route = { tab: string; filter?: string; view?: string; job?: string; offer?: string; jobTab?: string; task?: string; draft?: string; report?: string; ids?: string };
export const rows = (value: unknown): Json[] => Array.isArray(value) ? value.filter(x => x && typeof x === "object") : [];
export const texts = (value: unknown): string[] => Array.isArray(value) ? value.filter(x => typeof x === "string") : [];
const empty = (): Json => ({ jobs: [], tasks: [], profiles: [], profile: {}, config: {}, dashboard: { actionSets: {} }, discovery: { offers: [] }, cv: "", cvState: {}, analysis: {} });
const translations = dictionary as Record<string, Partial<Record<Locale, string>>>;
type Notice = { text: string; taskId?: string } | null;
export type TaskLaunch = { ids: string[]; title: string; estimate: Json; createdAt: string } | null;
const AI_TASK_KINDS = new Set(["evaluate", "cv", "cv_review", "analysis", "plan", "practice", "compare", "coach"]);

function useController(profileId: string, preview: boolean) {
  const analytics=useAnalytics(profileId);
  const [locale, setUiLocale] = useState<Locale>("en");
  const setLocale=useCallback((language:Locale)=>{
    try {localStorage.setItem('onward:ui-language-mode','manual');localStorage.setItem('jobpilot:language',language);}catch{}
    setUiLocale(language);
  },[]);
  const [theme, setTheme] = useState("system");
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Json>(empty);
  const [detail, setDetail] = useState<Json | null>(null);
  const [route, setRoute] = useState<Route>({ tab: "home" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [taskLaunch, setTaskLaunch] = useState<TaskLaunch>(null);
  const [trainingJob, setTrainingJob] = useState("");
  const dataRef = useRef(data), routeRef = useRef(route), detailRef = useRef(detail);
  dataRef.current = data; routeRef.current = route; detailRef.current = detail;
  const scope = `${profileId}:${locale}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const controllers = useRef(new Set<AbortController>());
  const generation = useRef(0);
  const busyRef = useRef(false);
  const refreshRef = useRef<{ scope: string; promise: Promise<void> } | null>(null);
  const displayIdsRef = useRef("");
  const displaySurfaceRef = useRef<"match"|"cv">("match");
  const v1BootstrapRef = useRef("");
  const tr = useCallback((zh: string, fr: string, en: string = fr) => locale === "zh" ? zh : locale === "en" ? en : fr, [locale]);
  const product = useCallback((value: unknown): string => {
    if (value == null) return "";
    const text = String(value);
    return translations[text]?.[locale] || text;
  }, [locale]);
  const notify = useCallback((text: string, taskId?: string) => setNotice({ text, taskId }), []);
  const fail = useCallback((e: unknown) => {
    if (e instanceof DOMException && e.name === "AbortError") return;
    setError(product(e instanceof Error ? e.message : String(e)));
  }, [product]);

  const apiUrl = useCallback((path: string) => {
    const u = new URL(path, window.location.origin);
    if (u.origin !== window.location.origin || !u.pathname.startsWith("/api/")) throw new Error("Same-origin Onward API required");
    if (!u.pathname.startsWith("/api/mobile-auth/") && u.pathname !== "/api/profiles" && u.pathname !== "/api/v1/session") u.searchParams.set("profileId", profileId);
    return u.pathname + u.search;
  }, [profileId]);
  const fetchScoped = useCallback(async (path: string, init: RequestInit = {}, binary = false): Promise<any> => {
    const epoch=generation.current;
    const controller = new AbortController(); controllers.current.add(controller);
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, binary || path.startsWith("/api/mobile/cv") ? 95000 : 60000);
    try {
      const headers = new Headers(init.headers);
      headers.set("X-JobPilot-Locale", locale); headers.set("X-JobPilot-Profile", profileId);
      if (!binary) headers.set("Accept", "application/json");
      if (typeof init.body === "string") headers.set("Content-Type", "application/json");
      const response = await fetch(apiUrl(path), { ...init, headers, credentials: "same-origin", cache: "no-store", signal: controller.signal });
      if (response.status === 401 && scopeRef.current === scope) setExpired(true);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || tr(`请求失败 (${response.status})`, `Requête impossible (${response.status})`, `Request failed (${response.status})`));
      }
      const result = binary ? new Uint8Array(await response.arrayBuffer()) : await response.json();
      if (scopeRef.current !== scope || generation.current!==epoch) throw new DOMException("Outdated profile or language", "AbortError");
      return result;
    } catch (e) {
      if (timedOut && scopeRef.current === scope) throw new Error(tr("连接超时。后台任务不会因此取消，请稍后刷新。", "Connexion expirée. Les tâches en arrière-plan continuent ; actualisez dans un instant.", "Connection timed out. Background tasks continue; refresh shortly."));
      throw e;
    } finally { clearTimeout(timeout); controllers.current.delete(controller); }
  }, [apiUrl, locale, profileId, scope, tr]);
  const request = useCallback((path: string, init?: RequestInit): Promise<Json> => fetchScoped(path, init), [fetchScoped]);
  const documentBytes = useCallback((path: string): Promise<Uint8Array> => fetchScoped(path, {}, true), [fetchScoped]);

  const navigate = useCallback((next: Partial<Route>, replace = false) => {
    const target: Route = { tab: next.tab || routeRef.current.tab, ...next };
    const depth = replace ? (history.state?.jpDepth || 0) : (history.state?.jpDepth || 0) + 1;
    history[replace ? "replaceState" : "pushState"]({ jpDepth: depth }, "", routeUrl(target));
    setRoute(target); setError(null);
  }, []);
  const close = useCallback(() => {
    if (history.state?.jpDepth > 0) history.back();
    else navigate({ tab: routeRef.current.tab, filter: routeRef.current.filter }, true);
  }, [navigate]);
  const refresh = useCallback(async (retry = false) => {
    if(preview && !profileId) { setLoading(false); return; }
    if (refreshRef.current?.scope === scope) return refreshRef.current.promise;
    const promise = (async () => {
      try {
        const suffix = new URLSearchParams();
        if (displayIdsRef.current) { suffix.set("displayJobIds", displayIdsRef.current); suffix.set("displayJobSurface", displaySurfaceRef.current); }
        if (retry) suffix.set("retryLocalization", "1");
        const snapshot = await request(`/api/mobile?${suffix}`);
        const previous = rows(dataRef.current.tasks);
        const completed = rows(snapshot.tasks).find(t => t.status === "completed" && previous.some(p => p.id === t.id && ACTIVE.has(p.status)));
        const failed = rows(snapshot.tasks).find(t => ["failed","interrupted"].includes(String(t.status)) && previous.some(p => p.id === t.id && ACTIVE.has(p.status)));
        dataRef.current = snapshot; setData(snapshot); setExpired(false);
        if (failed) {
          setTaskLaunch(current => current?.ids.includes(String(failed.id)) ? null : current);
          const title = failed.title || tr("AI 处理失败", "Échec du traitement IA", "AI processing failed");
          const reason = product(failed.error || failed.phase || tr("请查看任务详情后重试。", "Consultez le détail de la tâche avant de réessayer.", "Review the task details before retrying."));
          setError(`${title} · ${reason}`);
        } else if (completed) notify(completed.title, completed.id);
      } catch (e) { if (scopeRef.current === scope) fail(e); }
      finally { if (scopeRef.current === scope) setLoading(false); }
    })();
    refreshRef.current = { scope, promise };
    try { await promise; } finally { if (refreshRef.current?.promise === promise) refreshRef.current = null; }
  }, [request, scope, fail, notify, product, tr]);

  const refreshDetail = useCallback(async (retry = false) => {
    const r = routeRef.current;
    const query = r.view === "report" ? `reportJobId=${encodeURIComponent(r.report || r.job || "")}` : r.view === "task" ? `taskId=${encodeURIComponent(r.task || "")}` : "";
    if (!query) return;
    const key = routeUrl(r);
    try {
      const result = await request(`/api/mobile?${query}${retry ? "&retryLocalization=1" : ""}`);
      if (routeUrl(routeRef.current) === key) setDetail(result);
    } catch (e) { if (scopeRef.current === scope) fail(e); }
  }, [request, scope, fail]);

  useEffect(() => {
    let lang = systemUiLanguage(navigator.language), appearance = "system";
    try { if(localStorage.getItem("onward:ui-language-mode")==="manual")lang=localStorage.getItem("jobpilot:language") || lang; appearance = localStorage.getItem("jobpilot:theme") || localStorage.getItem("career-ops:theme") || "system"; } catch { /* Private browsing can deny storage; session state still works. */ }
    setUiLocale(["zh", "fr", "en"].includes(lang) ? lang as Locale : "en");
    setTheme(["system", "light", "dark"].includes(appearance) ? appearance : "system");
    setRoute(parseRoute(window.location.search) as Route); setReady(true);
    const pop = () => { setRoute(parseRoute(window.location.search) as Route); setError(null); };
    const systemChanged=()=>{let manual=false;try{manual=localStorage.getItem('onward:ui-language-mode')==='manual';}catch{}if(!manual)setUiLocale(systemUiLanguage(navigator.language) as Locale);};
    window.addEventListener('languagechange',systemChanged);window.addEventListener('focus',systemChanged);
    window.addEventListener("popstate", pop); return () => {window.removeEventListener("popstate", pop);window.removeEventListener('languagechange',systemChanged);window.removeEventListener('focus',systemChanged);};
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
    try { localStorage.setItem("jobpilot:language", locale); localStorage.setItem("jobpilot:theme", theme); } catch { /* Session-only preferences. */ }
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || theme === "system" && media.matches;
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#101A17" : "#FAF8F1");
    };
    apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply);
  }, [ready, locale, theme]);
  useEffect(() => {
    if (!ready) return;
    setLoading(true); setError(null); setDetail(null); busyRef.current = false; setBusy(false);
    setData(old => ({ ...empty(), profile: old.profile, profiles: old.profiles, cv: old.cv, cvState: old.cvState, config: old.config, languageSettings: old.languageSettings }));
    if(preview && !profileId) { setLoading(false); return; }
    void refresh();
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    let lastPoll = Date.now();
    const tick = async () => {
      const s = dataRef.current, d = detailRef.current;
      const ids = displayIdsRef.current.split(",");
      const active = rows(s.tasks).some(t => ACTIVE.has(t.status)) || s.v1?.backgroundActive === true || ACTIVE.has(d?.status) || pendingDisplay(s) || rows(s.jobs).some(j => ids.includes(j.id) && pendingDisplay(j)) || pendingDisplay(d) || pendingDisplay(d?.result);
      // Check for newly active work every 2.5 s, but keep idle network reads at 15 s.
      // A task started during an idle interval must not inherit a 15-second UI delay.
      if (!document.hidden && (active || Date.now() - lastPoll >= 15000)) {
        await refresh();
        if (pendingDisplay(d) || pendingDisplay(d?.result) || ACTIVE.has(d?.status)) await refreshDetail();
        lastPoll = Date.now();
      }
      if (!disposed) timer = setTimeout(tick, 2500);
    };
    timer = setTimeout(tick, 2500);
    const visible = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", visible); document.addEventListener("visibilitychange", visible);
    return () => { disposed = true; clearTimeout(timer); controllers.current.forEach(c => c.abort()); controllers.current.clear(); window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, [ready, scope, refresh, refreshDetail]);
  useEffect(() => {
    const versionId=String(data.cvState?.versionId || "");
    if(!ready || data.v1?.needsBootstrap !== true || !versionId) return;
    if(data.v1?.importState && ACTIVE.has(data.v1.importState)) return;
    const key=`${profileId}:${versionId}`;
    if(v1BootstrapRef.current===key) return;
    v1BootstrapRef.current=key;
    void request("/api/mobile",{method:"POST",body:JSON.stringify({action:"bootstrapV1",profileId,uiLocale:locale})})
      .then(()=>refresh())
      .catch(e=>{if(scopeRef.current===scope){v1BootstrapRef.current="";fail(e);}});
  }, [ready,data.v1?.needsBootstrap,data.cvState?.versionId,profileId,locale,request,refresh,scope,fail]);
  const selectedJob = rows(data.jobs).find(j => j.id === route.job || String(j.reportNum) === route.job);
  const discoveryOffers=[...rows(data.discovery?.offers),...rows(data.discovery?.history).flatMap(group=>rows(group.offers))];
  const selectedOffer = discoveryOffers.find(offer => String(offer.url) === String(route.offer || ""));
  const analyticsPage=preview&&data.v1?.journey?.completed!==true
    ? (!profileId?"onboarding_email":!data.cv?"onboarding_upload":!data.v1?.analysisReady?"onboarding_analysis":!data.v1?.journey?.query?"onboarding_direction":!data.v1?.offersReady?"onboarding_search":"onboarding_results")
    : route.view==="job"||route.view==="offer" ? (Number(route.jobTab)===1?"job_cv":"job_match") : route.view||route.tab;
  useEffect(()=>{
    if(!ready || loading&&!data.profile?.id)return;
    let live=true;
    const roleKey=analyticsPage.startsWith("job_")?String(selectedJob?.url||selectedOffer?.url||""):"";
    void (roleKey?analyticsContext(roleKey):Promise.resolve("")).then(context=>{if(!live)return;analytics.current?.enter(analyticsPage,context);
      const step=analyticsPage==="job_match"?"open_job":analyticsPage==="job_cv"||analyticsPage==="pdf"?"view_cv":analyticsPage==="job_tracking"?"tracking":analyticsPage==="onboarding_results"||analyticsPage==="offers"&&rows(data.discovery?.offers).length?"view_jobs":"";
      if(step)analytics.current?.step(step);
    });
    return()=>{live=false;};
  },[ready,analyticsPage,profileId,loading,Boolean(rows(data.discovery?.offers).length),selectedJob?.url,selectedOffer?.url]);
  useEffect(()=>{
    const tasks=rows(data.tasks);
    const visible=preview?tasks.filter(t=>!["ingest","analysis","search"].includes(t.kind)):tasks;
    if(preview&&data.v1?.cvProgress)visible.push({...data.v1.cvProgress,kind:"analysis"});
    if(preview&&data.v1?.searchProgress)visible.push({...data.v1.searchProgress,kind:"search"});
    analytics.current?.tasks(visible);
  },[data.tasks,data.v1?.cvProgress,data.v1?.searchProgress,preview]);
  const displayIds = route.view === "compare" ? route.ids || "" : selectedJob && ["job", "report", "pdf"].includes(route.view || "") ? selectedJob.id : "";
  const displaySurface: "match"|"cv" = Number(route.jobTab)===1 ? "cv" : "match";
  useEffect(() => { if (displayIdsRef.current !== displayIds || displaySurfaceRef.current !== displaySurface) { displayIdsRef.current = displayIds; displaySurfaceRef.current = displaySurface; if (ready && displayIds) void refresh(); } }, [displayIds, displaySurface, ready, refresh]);
  useEffect(() => { setDetail(null); if (ready) void refreshDetail(); }, [route.view, route.task, route.report, ready, scope, refreshDetail]);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(id); }, [notice]);

  const execute = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    try { return await operation(); } catch (e) { if (scopeRef.current === scope) fail(e); return; }
    finally { if (scopeRef.current === scope) { busyRef.current = false; setBusy(false); } }
  }, [scope, fail]);
  const invalidateReads=useCallback(()=>{generation.current++;controllers.current.forEach(c=>c.abort());controllers.current.clear();refreshRef.current=null;},[]);
  const trackingQueues=useRef(new Map<string,any>());
  const [trackingStates,setTrackingStates]=useState<Record<string,string>>({});
  const trackingKey=(job:Json,offer?:Json)=>`${profileId}:${job.url || offer?.url || job.id}`;
  const queueTracking=(job:Json,offer:Json|undefined,patch:Json,immediate=false)=>{
    const key=trackingKey(job,offer);
    let queue=trackingQueues.current.get(key);
    if(!queue) {
      let jobId=job.id;
      queue=trackingAutosave(async(change:Json)=>{
        // Writes outlive the sheet. A navigation read must not abort a user's edit.
        const response=await fetch('/api/mobile?profileId='+encodeURIComponent(profileId),{
          method:'POST',credentials:'same-origin',keepalive:true,
          headers:{'Content-Type':'application/json','X-JobPilot-Profile':profileId,'X-JobPilot-Locale':locale},
          body:JSON.stringify({action:jobId?'updateJob':'trackOffer',profileId,id:jobId,offer,change}),
        });
        const result=await response.json();
        if(!response.ok)throw new Error(result.error || tr('自动保存失败，改动仍保留。','Échec de la sauvegarde. Vos modifications sont conservées.','Autosave failed. Your edits are retained.'));
        if(result.job?.id)jobId=result.job.id;
        if(scopeRef.current===scope&&result.job)setData(old=>({...old,jobs:[...(old.jobs||[]).filter((j:Json)=>j.id!==result.job.id),result.job]}));
      },(state:string,error?:Error)=>{
        setTrackingStates(old=>({...old,[key]:state}));
        if(state==='failed')setError(error?.message || tr('自动保存失败，请重试。','Sauvegarde impossible, réessayez.','Autosave failed. Please retry.'));
        if(state==='saved'&&scopeRef.current===scope)void refresh();
      });
      trackingQueues.current.set(key,queue);
    }
    queue.edit(patch,immediate);
  };
  const flushTracking=(key:string)=>trackingQueues.current.get(key)?.flush();
  useEffect(()=>{const flush=()=>{for(const queue of trackingQueues.current.values())void queue.flush();};window.addEventListener('pagehide',flush);return()=>{window.removeEventListener('pagehide',flush);flush();};},[]);
  const act = useCallback(async (body: Json, path = "/api/mobile") => execute(async () => {
    const result = await request(path, { method: "POST", body: JSON.stringify({ ...body, profileId }) });
    invalidateReads(); await refresh(); notify(tr("已保存", "Enregistré", "Saved")); return result;
  }), [execute, request, profileId, refresh, notify, tr]);
  const openTask = useCallback(async (id: string) => execute(async () => {
    const task = await request(`/api/mobile?taskId=${encodeURIComponent(id)}`);
    await refresh(); navigate(destinationFor(task));
  }), [execute, request, refresh, navigate]);
  const startTask = useCallback(async (input: Json) => execute(async () => {
    const silent=input.silent===true;
    const waitId=crypto.randomUUID();analytics.current?.begin(waitId,String(input.kind));
    if(input.kind==="search")analytics.current?.step("choose_direction");
    if(input.kind==="cv")analytics.current?.step("generate_cv_started");
    const task = await request("/api/mobile", { method: "POST", body: JSON.stringify({ action: "task", profileId, input: { ...input, uiLocale: locale, language: locale } }) }).catch(e=>{analytics.current?.bind(waitId,{});throw e;});
    invalidateReads(); await refresh();
    analytics.current?.bind(waitId,preview&&["search","analysis"].includes(String(input.kind))?{...task,status:task.status==="failed"?"failed":"running"}:task);
    if(silent) return task;
    if (task.status === "completed" || task.status === "failed") navigate(destinationFor(task));
    else if(preview) setNotice(null);
    else if (AI_TASK_KINDS.has(String(input.kind))) setTaskLaunch({ ids: [task.id], title: task.title || String(input.kind), estimate: task.estimate || dataRef.current.flowEstimates?.[String(input.kind)] || { label: tr("正在估算耗时", "Estimation en cours", "Estimating duration") }, createdAt: task.createdAt || new Date().toISOString() });
    else notify(`${task.title} · ${task.estimate?.label || tr("可继续使用其他页面", "Vous pouvez continuer à naviguer", "You can keep browsing")}`, task.id);
    return task;
  }), [execute, request, profileId, locale, refresh, navigate, notify, tr]);
  const startTasks = useCallback(async (inputs: Json[], title: string) => execute(async () => {
    if (!inputs.length) return;
    const result = await request("/api/mobile", { method: "POST", body: JSON.stringify({ action: "batchTasks", profileId, uiLocale: locale, inputs: inputs.map(input => ({ ...input, uiLocale: locale, language: locale })) }) });
    await refresh();
    const active = rows(result.tasks).filter(task => ACTIVE.has(task.status));
    if (active.length) {
      const slowest = [...active].sort((a,b) => Number(b.estimate?.targetSeconds || b.estimate?.maxSeconds || 0) - Number(a.estimate?.targetSeconds || a.estimate?.maxSeconds || 0))[0];
      setTaskLaunch({ ids: active.map(task => String(task.id)), title, estimate: slowest?.estimate || { label: tr("正在估算耗时", "Estimation en cours", "Estimating duration") }, createdAt: slowest?.createdAt || new Date().toISOString() });
    }
    else notify(title);
    return result;
  }), [execute, request, profileId, locale, refresh, notify, tr]);
  const saveOffers = useCallback(async (offers: Json[]) => execute(async () => {
    if (!offers.length) return;
    const result = await request("/api/mobile", { method: "POST", body: JSON.stringify({ action: "saveOffers", profileId, offers }) });
    await refresh(); notify(tr(`已收藏 ${offers.length} 个岗位`, `${offers.length} offres enregistrées`, `Saved ${offers.length} roles`)); return result;
  }), [execute, request, profileId, refresh, notify, tr]);
  const tailorOffer = useCallback(async (offer: Json) => execute(async () => {
    const waitId=crypto.randomUUID();analytics.current?.begin(waitId,"cv");analytics.current?.step("generate_cv_started");
    const result = await request("/api/mobile", { method: "POST", body: JSON.stringify({ action: "tailorOffer", profileId, uiLocale: locale, offer }) }).catch(e=>{analytics.current?.bind(waitId,{});throw e;});
    invalidateReads(); await refresh();
    const task=result.task || {};
    analytics.current?.bind(waitId,task);
    if(task.status!=="completed") notify(tr("正在准备岗位版简历，可继续浏览。",`Préparation de votre version ciblée ; vous pouvez continuer à naviguer.`,`Preparing your targeted CV; you can keep browsing.`),task.id);
    return result;
  }), [execute, request, profileId, locale, refresh, navigate, notify, tr]);
  const upload = useCallback(async (file: File, sourceLanguage="auto", analysisLanguage:Locale=locale, contractTypes?:string[],searchArea?:Json) => execute(async () => {
    if (!/\.(pdf|docx|txt|md)$/i.test(file.name) || !file.size || file.size > 12 * 1024 * 1024) throw new Error(tr("请选择 PDF、DOCX、TXT 或 MD，最大 12 MB。", "PDF, DOCX, TXT ou MD · 12 Mo maximum.", "Choose PDF, DOCX, TXT or MD, up to 12 MB."));
    const form = new FormData(); form.set("file", file);
    form.set("sourceLanguage",sourceLanguage); form.set("analysisLanguage",analysisLanguage);
    const analyticsSessionId=analytics.current?.sessionId;
    if(analyticsSessionId){form.set("analyticsSessionId",analyticsSessionId);form.set("analyticsEventId",crypto.randomUUID());}
    if(contractTypes) form.set("contractTypes",JSON.stringify(contractTypes));
    if(searchArea)form.set("searchArea",JSON.stringify(searchArea));
    if(preview) { setData(old=>({...empty(),profile:old.profile,languageSettings:old.languageSettings,v1:{importState:"queued",backgroundActive:true,journey:{completed:false}}})); setDetail(null); }

    const waitId=crypto.randomUUID();if(!analyticsSessionId)analytics.current?.step("upload_cv");analytics.current?.begin(waitId,"analysis");
    const task = await request("/api/mobile/upload", { method: "POST", body: form }).catch(e=>{analytics.current?.bind(waitId,{});throw e;});
    analytics.current?.bind(waitId,preview?{...task,kind:"analysis",status:task.status==="failed"?"failed":"running"}:task);
    invalidateReads(); await refresh(); if(!preview) navigate({ tab: "profile", view: "task", task: task.id }); return task;
  }), [execute, request, refresh, navigate, tr]);
  const logout=useCallback(async()=>{
    generation.current++;controllers.current.forEach(c=>c.abort());controllers.current.clear();
    scopeRef.current="signed-out";setData(empty());setDetail(null);setRoute({tab:"home"});setExpired(true);
    try { await fetch(preview?"/api/v1/session":"/api/mobile-auth/logout",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({action:"logout"})}); }
    finally {window.location.replace("/");}
  },[preview]);
  const retryV1=useCallback(async()=>execute(async()=>{
    await request("/api/mobile",{method:"POST",body:JSON.stringify({action:"retryV1",profileId})});
    invalidateReads(); await refresh(true);
  }),[execute,request,profileId,refresh]);
  const changeAnalysisLanguage=useCallback(async(language:Locale)=>execute(async()=>{
    generation.current++;controllers.current.forEach(c=>c.abort());controllers.current.clear();refreshRef.current=null;
    setData(old=>({...old,analysis:null,v1:{...old.v1,analysisReady:false,offersReady:false,careerDirections:[]},discovery:{offers:[],history:[]}}));
    await request("/api/profile",{method:"POST",body:JSON.stringify({analysisLanguage:language})});
    invalidateReads(); await refresh();
  }),[execute,request,refresh]);
  const switchProfile = useCallback((id: string) => execute(async () => {
    await request("/api/profiles", { method: "POST", body: JSON.stringify({ profileId: id }) });
    window.location.assign("/");
  }), [execute, request]);
  const retryLocalization = useCallback(() => routeRef.current.view === "task" || routeRef.current.view === "report" ? refreshDetail(true) : refresh(true), [refresh, refreshDetail]);
  const openJob = useCallback((job: string, jobTab = 0) => navigate({ tab: routeRef.current.tab, view: "job", job, jobTab: String(jobTab) }), [navigate]);
  const openOffer = useCallback((offer: string) => navigate({ tab: "offers", view: "offer", offer }), [navigate]);
  return { analytics, profileId, preview, locale, theme, invalidateReads, logout, retryV1, changeAnalysisLanguage, ready, data, detail, route, selectedJob, selectedOffer, loading, busy, error, expired, notice, taskLaunch,
    tr, product, setLocale, setTheme, setError, setNotice, setTaskLaunch, setTrainingJob, request, documentBytes, apiUrl, fail, notify,
    navigate, close, refresh, retryLocalization, trackingKey,trackingStates,queueTracking,flushTracking, act, startTask, startTasks, saveOffers, tailorOffer, openTask, upload, switchProfile, openJob, openOffer, execute };
}
type PilotController = ReturnType<typeof useController>;
const Context = createContext<PilotController | null>(null);
export function PilotProvider({ profileId, preview=false, children }: { profileId: string; preview?:boolean; children: ReactNode }) {
  const value = useController(profileId,preview);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePilot() { const value = useContext(Context); if (!value) throw new Error("Onward provider missing"); return value; }
