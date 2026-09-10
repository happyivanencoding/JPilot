"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckSquare, ChevronRight, GraduationCap, Square } from "lucide-react";
import { DISCOVERY_OFFER_LIMIT } from "@/lib/mobile-domain.mjs";
import { rows, texts, usePilot, type Json } from "./pilot-context";
import { ACTIVE, safeExternalUrl } from "./model.mjs";
import { AiProgressButton, Button, Card, Chip, Empty, External, Hint, Input, Pill, RowLink, Score, TextArea, Title } from "./ui";

export function HomePage() {
  const { data, tr, navigate, openOffer } = usePilot();
  const offers=rows(data.discovery?.offers),directions=rows(data.v1?.careerDirections),signals=rows(data.analysis?.globalLayout?.signals),actions=rows(data.analysis?.actionIssues);
  const hasCv = Boolean(data.cv?.trim());
  const analysing=hasCv && ["queued","running","reconciling","pending"].includes(String(data.v1?.analysisState||"")) && !directions.length;
  return <div className="jp-page" data-testid="home-page">
    <Title sub={data.profile?.name}>{tr("先看清楚，你适合什么。", "Voyez d’abord où votre profil peut aller.", "First, see where your profile can go.")}</Title>
    {!hasCv ? <section className="jp-hero"><h2>{tr("上传一份简历，从真实岗位开始判断。","Importez votre CV et comparez-le à de vraies offres.","Upload your CV and compare it with real roles.")}</h2><Hint>{tr("JobPilot 会先理解你的经历，再给出适合探索的职业方向和岗位。","JobPilot comprend d’abord votre parcours, puis propose des directions et des offres à explorer.","JobPilot first understands your experience, then suggests directions and roles to explore.")}</Hint><Button onClick={()=>navigate({tab:"profile"})}>{tr("上传我的简历","Importer mon CV","Upload my CV")}</Button></section> : <>
      <section className="jp-stack"><div className="jp-row spread"><h3>{tr("你可以先探索这些方向","Directions à explorer","Directions to explore")}</h3><Button kind="text" onClick={()=>navigate({tab:"profile"})}>{tr("调整","Modifier","Edit")}</Button></div>{analysing?<><div className="jp-progress indeterminate"/><Hint>{tr("正在理解你的经历。你可以离开这个页面。","Analyse de votre parcours en arrière-plan.","Understanding your experience in the background.")}</Hint></>:<div className="jp-direction-grid">{directions.slice(0,5).map((d,i)=><button type="button" key={i} className="jp-direction-card" onClick={()=>navigate({tab:"offers"})}><strong>{d.title}</strong><p>{d.why}</p><Hint>{texts(d.evidence).slice(0,2).join(" · ")}</Hint><ArrowRight size={17}/></button>)}</div>}</section>
      {!!offers.length&&<section className="jp-stack"><div className="jp-row spread"><h3>{tr("先试这几个真实岗位","Essayez d’abord ces offres","Try these real roles first")}</h3><Button kind="text" onClick={()=>navigate({tab:"offers"})}>{tr("全部","Tout voir","See all")}</Button></div>{offers.slice(0,3).map(offer=><button type="button" key={offer.url} className="jp-v1-role-card" onClick={()=>openOffer(String(offer.url))}><div className="jp-row"><div className="jp-grow"><div className="jp-company">{offer.company}</div><strong>{offer.title}</strong></div><Match100 value={offer.deepMatch?.currentScore ?? offer.fastMatch?.score}/></div><p>{offer.deepMatch?.roleSummary || offer.why}</p><Hint>{offer.deepMatchState==="loading"?tr("正在补充岗位解释…","Explication du poste en cours…","Adding role explanation…"):tr("点开看为什么是这个分数","Ouvrez pour comprendre ce score","Open to see why this score")}</Hint></button>)}</section>}
      {(signals.length>0||actions.length>0)&&<section className="jp-stack"><h3>{tr("你的当前信号","Vos signaux actuels","Your current signals")}</h3>{signals.slice(0,3).map((s,i)=><Card key={i}><strong>{s.title}</strong><p>{s.why}</p><Hint>{s.evidence}</Hint></Card>)}{actions.slice(0,2).map((a,i)=><Card key={`gap-${i}`}><strong>{tr("值得补齐：","À développer : ","Worth building: ")}{a.title}</strong><p>{a.detail}</p><Hint>{a.nextAction}</Hint></Card>)}</section>}
    </>}
  </div>;
}

export function Match100({value}:{value:unknown}) { const n=Number(value);return <div className="jp-match100" aria-label={Number.isFinite(n)?`${Math.round(n)} / 100`:"—"}>{Number.isFinite(n)?Math.round(n):"—"}<span>/100</span></div>; }

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
function OfferCard({offer}:{offer:Json}) {
  const {tr,product,openOffer}=usePilot();
  const deep=offer.deepMatch||{},fast=offer.fastMatch||{};
  const strengths=rows(deep.strengths).length?rows(deep.strengths).map(x=>x.title):rows(fast.strengths).map(x=>x.title);
  const gaps=rows(deep.capabilityGaps).length?rows(deep.capabilityGaps).map(x=>x.title):rows(fast.gaps).map(x=>x.title);
  return <button type="button" className="jp-v1-role-card jp-offer" data-testid="discovery-offer" onClick={()=>openOffer(String(offer.url))}>
    <div className="jp-row"><div className="jp-grow"><div className="jp-company">{offer.company}</div><h2>{offer.title}</h2></div><Match100 value={deep.currentScore ?? fast.score}/></div>
    <Hint>{[offer.location,offer.contractType!=="unknown"?product(offer.contractType):""].filter(Boolean).join(" · ")}</Hint>
    <p>{deep.roleSummary || offer.why}</p>
    <div className="jp-v1-signal-row">{strengths.slice(0,2).map((x,i)=><span className="jp-v1-plus" key={`s-${i}`}>+ {x}</span>)}{gaps.slice(0,2).map((x,i)=><span className="jp-v1-minus" key={`g-${i}`}>− {x}</span>)}</div>
    <Hint>{offer.deepMatchState==="loading"?tr("正在后台补充职责、要求和提升空间…","Responsabilités et écarts en cours d’analyse…","Adding responsibilities, requirements and upside in the background…"):deep.cvPotentialScore>deep.currentScore?tr(`只优化现有表达，预计可到约 ${deep.cvPotentialScore}/100`,`En optimisant seulement la présentation : ~${deep.cvPotentialScore}/100`,`With presentation improvements only: ~${deep.cvPotentialScore}/100`):tr("打开看职责、要求和你的差距","Ouvrez pour voir missions, exigences et écarts","Open for responsibilities, requirements and gaps")}</Hint>
  </button>;
}
export function OffersPage() {
  const { data, tr, product, startTask } = usePilot();
  const directions=rows(data.v1?.careerDirections),keywords=texts(data.v1?.searchKeywords);
  const targetRoles=texts(data.config?.target_roles?.primary);
  const defaultQuery = String(targetRoles[0] || directions[0]?.searchQuery || directions[0]?.title || keywords.slice(0,3).join(" ") || tr("适合我当前经历的初级岗位","postes junior adaptés à mon parcours","junior roles suited to my experience"));
  const [query, setQuery] = useState<string>(defaultQuery), priorDefault = useRef<string>(defaultQuery);
  useEffect(() => { setQuery((previous:string) => previous === priorDefault.current ? defaultQuery : previous); priorDefault.current = defaultQuery; }, [defaultQuery]);
  const searching = ACTIVE.has(String(data.v1?.searchState || ""));
  const discovery = data.discovery || {};
  const offers=rows(discovery.offers).slice(0,DISCOVERY_OFFER_LIMIT);
  return <div className="jp-page" data-testid="offers-page"><Title sub={tr("先快速看分，再点开理解为什么。","Un score immédiat, puis l’explication si vous ouvrez l’offre.","See the score first, then open a role to understand why.")}>{tr("机会", "Opportunités", "Opportunities")}</Title>
    <div className="jp-stack"><Input label={tr("我想看看什么工作","Quel type de poste voulez-vous explorer ?","What roles do you want to explore?")} value={query} onChange={e=>setQuery(e.target.value)}/><div className="jp-chips">{[...directions.map(d=>d.title),...keywords].filter(Boolean).slice(0,8).map((item,i)=><Chip key={i} selected={query===item} onClick={()=>setQuery(String(item))}>{item}</Chip>)}</div><Hint>{tr("你可以直接改关键词；明确写下的意图会优先于 AI 推断。","Vous pouvez modifier les mots-clés ; votre intention explicite reste prioritaire.","Edit the keywords freely; your explicit intent takes priority over AI inference.")}</Hint><Button data-testid="search-offers" disabled={searching||!query.trim()} onClick={()=>startTask({kind:"search",query,silent:true})}>{searching?tr("正在找岗位…","Recherche en cours…","Finding roles…"):tr("搜索这个方向","Rechercher cette direction","Search this direction")}</Button></div>
    <div className="jp-row spread"><strong>{tr("最值得先看的岗位","À regarder en premier","Best roles to inspect first")}</strong><Hint>{discovery.searchedAt?.slice(0,10)}</Hint></div>
    {!offers.length&&<Empty title={data.v1?.backgroundActive?tr("正在准备第一批岗位","Premières offres en préparation","Preparing your first roles"):tr("还没有岗位","Aucune offre pour l’instant","No roles yet")}>{tr("确认简历后 JobPilot 会自动准备第一批结果；你也可以在上方换一个方向。","Après confirmation du CV, JobPilot prépare automatiquement une première sélection. Vous pouvez aussi changer de direction ci-dessus.","After you confirm your CV, JobPilot prepares an initial set automatically. You can also change direction above.")}</Empty>}
    {offers.map(offer=><OfferCard key={offer.url} offer={offer}/>) }
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
