"use client";
import {CvOutcome} from "./cv-outcome";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, CheckSquare, ChevronRight, GraduationCap, Square } from "lucide-react";
import { DISCOVERY_OFFER_LIMIT } from "@/lib/mobile-domain.mjs";
import { rows, texts, usePilot, type Json } from "./pilot-context";
import { ACTIVE, safeExternalUrl } from "./model.mjs";
import { AiProgressButton, Button, Card, Chip, Empty, External, Hint, Input, Pill, RowLink, Score, TextArea, Title } from "./ui";
import {CompanyMark,DirectionMedallion,MatchLabel,MetaRow,OnwardArcMotif} from "./onward-visual";

function identityStatement(signal:Json|undefined,tr:(zh:string,fr:string,en:string)=>string){
 return String(signal?.title||"").trim() || tr("你的优势正在形成清晰方向。","Vos points forts dessinent une direction claire.","Your strengths are pointing to a clear direction.");
}

export function HomePage() {
  const { data, tr, navigate, openOffer, startTask, retryV1,product } = usePilot();
  const offers=rows(data.discovery?.offers),directions=rows(data.v1?.careerDirections),signals=rows(data.analysis?.strengths).length?rows(data.analysis?.strengths):rows(data.analysis?.globalLayout?.signals),growth=rows(data.analysis?.growthAreas)[0];
  const hasCv = Boolean(data.cv?.trim());
  const analysing=hasCv && ["queued","running","reconciling","pending"].includes(String(data.v1?.analysisState||"")) && !directions.length;
  const displayName=String(data.profile?.name||"").trim();
  const [activeStrength,setActiveStrength]=useState<Json|null>(null);
  useEffect(()=>{if(!activeStrength)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setActiveStrength(null);};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[activeStrength]);
  return <div className="jp-page onward-home" data-testid="home-page">
    <OnwardArcMotif className="home"/>
    <div className="onward-home-greeting">{tr(displayName?`你好，${displayName}。`:"你好。",displayName?`Bonjour, ${displayName}.`:"Bonjour.",displayName?`Hello, ${displayName}.`:"Hello.")}</div>
    {!hasCv ? <section className="jp-hero onward-home-empty"><h2>{tr("你的下一章，从这里开始。","Votre prochain chapitre commence ici.","Your next chapter starts here.")}</h2><Hint>{tr("上传简历，Onward 会从你的真实经历出发，找出值得探索的方向与岗位。","Importez votre CV : Onward part de votre parcours réel pour faire émerger les directions et les offres à explorer.","Upload your CV and Onward will use your real experience to surface directions and roles worth exploring.")}</Hint><Button onClick={()=>navigate({tab:"profile"})}>{tr("上传我的简历","Importer mon CV","Upload my CV")}</Button></section> : <>
      <section className="onward-home-strengths" aria-labelledby="home-strengths-title"><p id="home-strengths-title">{tr("你的经历已经显现出这些核心优势：","Votre parcours fait déjà ressortir ces forces essentielles :","Your experience already shows these core strengths:")}</p><ul>{signals.slice(0,3).map((signal,i)=><li key={i}><button type="button" data-testid={`home-strength-${i}`} aria-haspopup="dialog" onClick={()=>setActiveStrength(signal)}><span aria-hidden="true" className="onward-strength-dot"/><span>{identityStatement(signal,tr)}</span><ChevronRight size={15}/></button></li>)}</ul></section>
      {growth&&<Card className="onward-home-growth"><strong>{tr("下一步补强","Prochaine progression","Next area to strengthen")}</strong><h3>{growth.title}</h3><Hint>{growth.nextAction}</Hint></Card>}
      {data.v1?.cvProgress?.status==="failed"&&<Card><p role="alert">{data.v1.cvProgress.failure?.message}</p><Button onClick={()=>retryV1()}>{tr("继续分析","Reprendre l’analyse","Continue analysis")}</Button></Card>}
      <section className="jp-stack onward-home-section direction-section"><div className="jp-row"><div><h3>{tr("值得探索的方向","Directions à explorer","Directions to explore")}</h3><Hint>{tr("选一个方向，直接查看对应岗位。","Choisissez une piste pour voir les offres correspondantes.","Choose a direction to see matching roles.")}</Hint></div></div>{analysing?<><div className="jp-progress indeterminate"/><Hint>{tr("为你准备新的方向。","De nouvelles pistes se préparent.","New possibilities are on their way.")}</Hint></>:<div className="jp-direction-grid">{directions.slice(0,4).map((d,i)=><button type="button" key={i} className="jp-direction-card onward-interactive-row" style={{"--onward-delay":`${Math.min(i,4)*34}ms`} as CSSProperties} data-analytics="choose_direction" onClick={()=>{navigate({tab:"offers"});void startTask({kind:"search",query:d.searchQuery,silent:true});}}><DirectionMedallion label={String(d.title)}/><span className="onward-row-copy"><strong>{d.title}</strong><Hint>{texts(d.evidence).slice(0,2).join(" · ")}</Hint></span><ArrowRight size={17}/></button>)}</div>}</section>
      {!!offers.length&&<section className="jp-stack onward-home-section offer-section"><div className="jp-row spread"><h3>{tr("今天值得看的岗位","Pour vous aujourd’hui","For you today")}</h3><Button kind="text" onClick={()=>navigate({tab:"offers"})}>{tr("全部","Tout voir","See all")}</Button></div>{offers.slice(0,3).map((offer,i)=>{const score=offer.deepMatch?.currentScore ?? offer.fastMatch?.score;return <button type="button" key={offer.url} className="jp-v1-role-card onward-job-row onward-interactive-row" style={{"--onward-delay":`${Math.min(i,4)*34}ms`} as CSSProperties} data-analytics="open_job" onClick={()=>openOffer(String(offer.url))}><CompanyMark company={String(offer.company||"")}/><span className="onward-row-copy"><strong>{offer.title}</strong><span className="jp-company">{offer.company}</span><MetaRow location={String(offer.location||"")} contract={offer.contractType&&offer.contractType!=="unknown"?product(offer.contractType):undefined}/></span><MatchLabel value={score}/><ChevronRight size={17}/></button>})}</section>}
    </>}
    {activeStrength&&<div className="onward-strength-popover-backdrop" data-testid="home-strength-popover" onClick={()=>setActiveStrength(null)}><section className="onward-strength-popover" role="dialog" aria-modal="true" aria-labelledby="home-strength-popover-title" onClick={event=>event.stopPropagation()}><small>{tr("简历中的具体例子","Exemple concret tiré du CV","Concrete example from your CV")}</small><h3 id="home-strength-popover-title">{identityStatement(activeStrength,tr)}</h3><p>{String(activeStrength.evidence||activeStrength.why||tr("这个优势来自你简历中已经写明的经历。","Cet atout vient d’une expérience déjà présente dans votre CV.","This strength comes from experience already stated in your CV."))}</p></section></div>}
  </div>;
}
export function Match100({value}:{value:unknown}) { const n=value==null?NaN:Number(value);return <div className="jp-match100" aria-label={Number.isFinite(n)?`${Math.round(n)} / 100`:"—"}>{Number.isFinite(n)?Math.round(n):"—"}<span>/100</span></div>; }

export function SearchMetrics({ value: m }: { value: Json }) {
  const { tr } = usePilot();
  if (m?.returnedCount == null) return null;
  const parts = [tr(`${m.returnedCount} 个岗位`, `${m.returnedCount} offres`, `${m.returnedCount} roles`)];
  if (m.strongCount) parts.push(tr(`${m.strongCount} 个强相关`, `${m.strongCount} très proches`, `${m.strongCount} strong`));
  if (m.adjacentCount) parts.push(tr(`${m.adjacentCount} 个相邻`, `${m.adjacentCount} adjacentes`, `${m.adjacentCount} adjacent`));
  if (m.closestCount) parts.push(tr(`${m.closestCount} 个最接近备选`, `${m.closestCount} options de repli`, `${m.closestCount} closest fallbacks`));
  if (m.wallMs != null) parts.push(`${(m.wallMs / 1000).toFixed(1)} s`);
  if (m.fresh7dRate != null) parts.push(tr(`${m.fresh7dRate}% ≤7天`, `${m.fresh7dRate}% ≤7 j`, `${m.fresh7dRate}% ≤7d`));
  if (m.datedRate != null) parts.push(tr(`${m.datedRate}% 有日期`, `${m.datedRate}% datées`, `${m.datedRate}% dated`));
  const status = (s: string) => s === "ok" ? tr("可用", "actif", "active") : s === "unconfigured" ? tr("未配置", "non configuré", "not configured") : s === "error" ? tr("错误", "erreur", "error") : tr("关闭", "désactivé", "disabled");
  return <section className="jp-stack"><strong>{tr("本次搜索表现", "Performance de cette recherche", "Search performance")}</strong><Hint>{parts.join(" · ")}</Hint><Hint>{m.aiFallbackUsed ? tr("结构化源不足，已使用精简 AI 补充。", "Sources structurées insuffisantes : complément IA ciblé utilisé.", "Structured sources were insufficient; targeted AI fallback was used.") : tr("本次未调用搜索 Agent。", "Aucun agent de recherche utilisé pour cette requête.", "No search agent was used for this query.")}</Hint><Hint>{rows(m.providers).map(p => `${p.label}: ${status(p.status)}`).join(" · ")}</Hint><hr /></section>;
}
function OfferCard({offer,index=0}:{offer:Json;index?:number}) {
  const {tr,product,openOffer}=usePilot();
  const deep=offer.deepMatch||{},fast=offer.fastMatch||{};
  const score=offer.historyStale?undefined:offer.matchScore?.current ?? deep.currentScore ?? fast.score;
  const enrichmentState=offer.enrichment?.deepMatchState;
  return <button type="button" className={`jp-v1-role-card jp-offer onward-job-row onward-interactive-row${offer.roleCv?" has-role-cv":""}`} style={{"--onward-delay":`${Math.min(index,4)*34}ms`} as CSSProperties} data-testid="discovery-offer" onClick={()=>openOffer(String(offer.url))}>
    <CompanyMark company={String(offer.company||"")}/>
    <span className="onward-row-copy"><h2>{offer.title}</h2><span className="jp-company">{offer.company}</span><MetaRow location={String(offer.location||"")} contract={offer.contractType!=="unknown"?product(offer.contractType):undefined}/>{offer.historyStale&&<span className="jp-role-cv-label">{tr("旧版 CV 搜索 · 分数不代表当前简历","Recherche avec un ancien CV · score masqué","Older CV search · score hidden")}</span>}{!offer.historyStale&&['queued','running','reconciling','pending'].includes(String(enrichmentState||''))&&<span className="jp-role-cv-label">{tr("详细匹配分析中","Analyse détaillée en cours","Detailed match analysis in progress")}</span>}{offer.roleCv&&<span className="jp-role-cv-label">{offer.roleCv.status==="generating"?tr("岗位简历准备中","CV en préparation","Preparing role CV"):offer.roleCv.status==="pending"?tr("岗位简历已就绪 · 待确认","CV prêt · à confirmer","Role CV ready · review"):tr("已保留岗位简历","CV ciblé conservé","Role CV saved")}</span>}</span>
    <MatchLabel value={score}/><ChevronRight size={17}/>
  </button>;
}
export function OffersPage() {
  const { data, tr, startTask, retryV1 } = usePilot();
  const directions=rows(data.v1?.careerDirections);
  const defaultQuery = String(data.v1?.journey?.label || directions[0]?.title || tr("适合我当前经历的初级岗位","postes junior adaptés à mon parcours","junior roles suited to my experience"));
  const [query, setQuery] = useState<string>(defaultQuery), priorDefault = useRef<string>(defaultQuery);
  useEffect(() => { setQuery((previous:string) => previous === priorDefault.current ? defaultQuery : previous); priorDefault.current = defaultQuery; }, [defaultQuery]);
  const discovery = data.discovery || {},offers=rows(discovery.offers).slice(0,DISCOVERY_OFFER_LIMIT),history=rows(discovery.history);
  return <div className="jp-page onward-opportunities" data-testid="offers-page">
    <Title sub={tr("根据你的经历挑选的岗位。","Des postes choisis à partir de votre parcours.","Roles selected from your experience.")}>{tr("机会", "Opportunités", "Opportunities")}</Title>
    <section className="onward-opportunity-search"><Input label={tr("搜索职位或公司","Rechercher un poste, une entreprise…","Search a role or company…")} value={query} onChange={e=>setQuery(e.target.value)}/><AiProgressButton taskKind="search" data-testid="search-offers" disabled={!query.trim()} onClick={()=>startTask({kind:"search",query:directions.find(d=>d.title===query)?.searchQuery || query,silent:true})}>{tr("搜索","Rechercher","Search")}</AiProgressButton></section>
    {!offers.length&&<section className="jp-stack onward-empty-actions">{(data.v1?.presentationFailed||data.v1?.searchIncomplete)&&<Button onClick={()=>retryV1()}>{tr("重试","Réessayer","Retry")}</Button>}</section>}
    {!!offers.length&&data.v1?.searchProgress?.status==="failed"&&<Button kind="text" onClick={()=>retryV1()}>{tr("重试搜索","Réessayer","Retry search")}</Button>}
    <div className="onward-job-list">{offers.map((offer,index)=><OfferCard key={offer.url} offer={offer} index={index}/>)}</div>
    {!!history.length&&<section className="jp-stack jp-search-history"><strong>{tr("之前看过的方向","Recherches précédentes","Previously explored")}</strong>{history.map((group,index)=><details className="jp-history-group" key={`${group.candidateVersionId||'legacy'}:${group.directionKey || group.taskId || index}`} data-testid="history-direction"><summary><span>{group.label || tr("之前的方向","Piste précédente","Previous direction")}{group.cvVersion?` · CV v${group.cvVersion}`:''}</span><small>{group.staleForCurrentCv?tr("旧 CV · 分数已隐藏","Ancien CV · scores masqués","Older CV · scores hidden"):tr(`${rows(group.offers).length} 个岗位`,`${rows(group.offers).length} offres`,`${rows(group.offers).length} roles`)}</small></summary><div className="jp-history-body">{rows(group.offers).map((offer,i)=><OfferCard key={offer.url} offer={offer} index={i}/>)}</div></details>)}</section>}
  </div>;
}
export function ApplicationsPage() {
  const { data, route, tr, product, navigate, openJob, startTasks, busy } = usePilot();
  const [query, setQuery] = useState(""), [compare, setCompare] = useState(false), [chosen, setChosen] = useState<string[]>([]);
  const [refine,setRefine]=useState(false),[sortMode,setSortMode]=useState("score-desc"),[evaluationFilter,setEvaluationFilter]=useState("all");
  const filter = route.filter || "";
  useEffect(() => { setQuery(""); }, [filter]);
  const allJobs=rows(data.jobs),sets=data.dashboard?.actionSets || {},specialIds=new Set(texts(sets[filter]));
  const categoryMatches=(job:Json)=>filter==="" ? true : filter==="offer" ? ["offer","hired"].includes(job.stage) : filter==="closed" ? ["rejected","archived"].includes(job.stage) : ["high","due","decide"].includes(filter) ? specialIds.has(job.id) : job.stage===filter;
  const updatedKey=(job:Json)=>String(job.updatedAt || job.lastChecked || job.discoveredAt || job.postedAt || "");
  const score=(job:Json)=>typeof job.score==="number"&&Number.isFinite(job.score)?job.score:null;
  const jobs=allJobs.filter(job=>categoryMatches(job)&&(job.company+" "+job.role).toLowerCase().includes(query.toLowerCase())&&(evaluationFilter==="all" || evaluationFilter==="evaluated"&&job.evaluationState==="evaluated" || evaluationFilter==="unrated"&&job.evaluationState!=="evaluated")).sort((a,b)=>sortMode==="recent"?updatedKey(b).localeCompare(updatedKey(a)):sortMode==="score-asc"?(score(a)??Infinity)-(score(b)??Infinity)||updatedKey(b).localeCompare(updatedKey(a)):(score(b)??-Infinity)-(score(a)??-Infinity)||updatedKey(b).localeCompare(updatedKey(a)));
  const activeEvaluations=rows(data.tasks).filter(task=>task.kind==="evaluate" && ACTIVE.has(task.status));
  const unrated=allJobs.filter(job=>job.evaluationState!=="evaluated" && safeExternalUrl(String(job.url || "")) && !activeEvaluations.some(task=>task.jobId===job.id || task.input?.url===job.url));
  const options = [["", tr("全部", "Tout", "All")], ["preparing", tr("准备投递", "À préparer", "Prepare")], ["applied", tr("已投递", "Envoyées", "Applied")], ["responded", tr("收到回复", "Réponses", "Replies")], ["interview", tr("面试", "Entretiens", "Interviews")], ["offer", tr("Offer / 入职", "Offre / embauche", "Offer / hired")], ["closed", tr("已结束", "Terminées", "Closed")]];
  const choose = (id: string) => setChosen(previous => previous.includes(id) ? previous.filter(x => x !== id) : previous.length < 4 ? [...previous, id] : previous);
  const openCompare = () => navigate({ tab: "applications", filter, view: "compare", ids: chosen.join(",") });
  const quickLabel=filter==="high"?tr("高匹配","Match élevé","High match"):filter==="due"?tr("待跟进","À relancer","Follow up"):filter==="decide"?tr("已评估待投递","Évaluées à candidater","Evaluated to apply"):"";
  return <div className="jp-page" data-testid="applications-page" data-filter={filter} data-count={jobs.length}>
    <div className="jp-row"><div className="jp-grow"><Title>{tr("我的投递", "Mes candidatures", "My applications")}</Title><Hint>{jobs.length + " " + tr("个岗位", "postes", "roles")}</Hint></div><Button kind="text" onClick={() => compare && chosen.length >= 2 ? openCompare() : setCompare(!compare)}>{compare ? `${chosen.length}/4` : tr("对比", "Comparer", "Compare")}</Button></div>
    {!!unrated.length && <Button kind="outline" data-testid="evaluate-all-unrated" disabled={busy} onClick={() => startTasks(unrated.map(job=>({kind:"evaluate",url:job.url,retry:true})),tr(`批量评估 ${unrated.length} 个未评估岗位`, `Évaluation de ${unrated.length} offres`, `Evaluate ${unrated.length} unrated roles`))}>{tr(`一键评估所有未评估岗位（${unrated.length}）`, `Évaluer toutes les offres non évaluées (${unrated.length})`, `Evaluate all unrated roles (${unrated.length})`)}</Button>}
    <Input label={tr("公司或职位", "Entreprise ou poste", "Company or role")} type="search" value={query} onChange={e => setQuery(e.target.value)} />
    <div className="jp-chips">{options.map(([key, label]) => <Chip key={key} selected={filter === key} data-testid={`filter-${key || "all"}`} onClick={() => navigate({ tab: "applications", filter: key }, true)}>{label}</Chip>)}</div>
    <div className="jp-row"><Button kind="outline" data-testid="application-refine" onClick={()=>setRefine(v=>!v)}>{tr("筛选与排序", "Filtrer et trier", "Filter & sort")}</Button>{quickLabel&&<Pill>{quickLabel}</Pill>}</div>
    {refine&&<Card><strong>{tr("评估状态","État de l’évaluation","Evaluation status")}</strong><div className="jp-chips">{[["all",tr("全部","Toutes","All")],["evaluated",tr("仅已评估","Évaluées","Evaluated")],["unrated",tr("仅未评估","Non évaluées","Unrated")]].map(([key,label])=><Chip key={key} selected={evaluationFilter===key} onClick={()=>setEvaluationFilter(key)}>{label}</Chip>)}</div><strong>{tr("排序","Tri","Sort")}</strong><div className="jp-chips">{[["score-desc",tr("评分高→低","Score décroissant","Score high→low")],["score-asc",tr("评分低→高","Score croissant","Score low→high")],["recent",tr("最近更新","Plus récentes","Recently updated")]].map(([key,label])=><Chip key={key} selected={sortMode===key} onClick={()=>setSortMode(key)}>{label}</Chip>)}</div></Card>}
    {["high","due","decide"].includes(filter)&&<Button kind="text" onClick={() => navigate({ tab: "applications" }, true)}>{tr("清除快捷筛选", "Effacer ce filtre", "Clear quick filter")}</Button>}
    {compare && <div className="jp-row spread"><Hint>{tr("选择 2–4 个岗位", "Sélectionnez 2 à 4 postes", "Select 2–4 roles")}</Hint><Button kind="text" onClick={() => { setCompare(false); setChosen([]); }}>{tr("取消", "Annuler", "Cancel")}</Button></div>}
    {!jobs.length && <Empty title={tr("当前筛选没有岗位", "Aucun poste dans ce filtre", "No roles in this filter")}>{tr("更换筛选，或到机会页寻找岗位。", "Changez le filtre ou recherchez des opportunités.", "Change the filter or explore opportunities.")}</Empty>}
    {jobs.map(job => <button type="button" className="jp-list-item" key={job.id} data-testid={`job-${job.id}`} aria-pressed={compare ? chosen.includes(job.id) : undefined} onClick={() => compare ? choose(job.id) : openJob(job.id)}><div className="jp-row">{compare && (chosen.includes(job.id) ? <CheckSquare size={20} /> : <Square size={20} />)}<div className="jp-grow jp-stack"><div className="jp-company">{job.company}</div><div className="jp-role">{job.role}</div></div><Score score={job.score} /></div><Hint>{[job.location, product(job.contract)].filter(Boolean).join(" · ")}</Hint><div className="jp-row spread"><span className="jp-status-line">{product(job.status)}</span><ChevronRight size={18} /></div><Hint>{job.followup?.nextAction}</Hint></button>)}
    {compare && chosen.length >= 2 && <Button onClick={openCompare}>{tr("比较选中的岗位", "Comparer la sélection", "Compare selected roles")}</Button>}
  </div>;
}
