"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckSquare, ChevronRight, GraduationCap, Square } from "lucide-react";
import { DISCOVERY_OFFER_LIMIT } from "@/lib/mobile-domain.mjs";
import { rows, texts, usePilot, type Json } from "./pilot-context";
import { ACTIVE, safeExternalUrl } from "./model.mjs";
import { AiProgressButton, Button, Card, Chip, Empty, External, Hint, Input, Pill, RowLink, Score, TextArea, Title } from "./ui";

export function HomePage() {
  const { data, tr, product, navigate, openJob } = usePilot();
  const jobs = rows(data.jobs), d = data.dashboard || {}, sets = d.actionSets || {};
  const count = (name: string) => texts(sets[name]).length;
  const hasCv = Boolean(data.cv?.trim());
  const filter = (name: string) => navigate({ tab: "applications", filter: name });
  const headline = !jobs.length && !hasCv ? tr("从你的简历开始。", "Commençons par votre CV.", "Start with your CV.") : !jobs.length ? tr("选好你的第一批机会。", "Faites votre première sélection.", "Choose your first opportunities.") : count("decide") ? tr(`${count("decide")} 个岗位已经评估，待安排投递`, `${count("decide")} postes évalués restent à candidater`, `${count("decide")} evaluated roles are ready to apply`) : tr("把下一步安排好。", "Gardez une longueur d’avance.", "Plan your next move.");
  return <div className="jp-page" data-testid="home-page">
    <Title sub={data.profile?.name}>{tr("今天，推进哪一步？", "Votre prochain pas.", "Your next step.")}</Title>
    <section className="jp-hero"><h2>{headline}</h2><Hint>{tr("把精力放在值得投递的岗位与下一步行动上。", "Les postes qui méritent votre attention. Les actions qui suivent.", "Roles worth your attention. Clear next steps.")}</Hint>
      <Button onClick={() => count("decide") ? filter("decide") : navigate({ tab: hasCv ? "offers" : "profile" })}>{count("decide") ? tr("查看已评估待投递岗位", "Voir les postes évalués à candidater", "Review evaluated roles to apply") : hasCv ? tr("寻找适合我的岗位", "Trouver des opportunités", "Find opportunities") : tr("导入我的简历", "Importer mon CV", "Import my CV")}</Button>
    </section>
    {!!jobs.length && <div className="jp-action-metrics">{[["high", tr("匹配 ≥85%", "Match ≥85%", "Match ≥85%")], ["due", tr("待跟进", "À relancer", "Follow-ups")], ["interview", tr("面试", "Entretiens", "Interviews")]].map(([key, label]) => <button type="button" key={key} data-testid={`metric-${key}`} onClick={() => filter(key)}><strong>{count(key)}</strong><span>{label}</span><ArrowRight size={16} /></button>)}</div>}
    {!!rows(d.due).length && <section className="jp-stack large"><h3>{tr("优先行动", "À faire en priorité", "Priorities")}</h3>{rows(d.due).slice(0, 3).map(item => <button type="button" className="jp-list-item" key={item.id} onClick={() => openJob(item.id, 3)}><strong>{item.company}</strong><p>{item.nextAction || tr("联系招聘方", "Recontacter le recruteur", "Follow up with recruiter")}</p><Hint>{item.dueDate}</Hint></button>)}</section>}
    {!!jobs.length && <section><h3>{tr("我的求职进展", "Votre recherche", "Your job search")}</h3>{[["", tr("所有岗位", "Tous les postes", "All roles"), jobs.length], ["preparing", tr("准备投递", "À préparer", "Prepare to apply"), d.byStage?.preparing || 0], ["applied", tr("已投递 / 等待回复", "Envoyées / en attente", "Applied / awaiting reply"), d.byStage?.applied || 0], ["responded", tr("收到回复", "Réponses reçues", "Replies received"), d.byStage?.responded || 0], ["interview", tr("面试", "Entretiens", "Interviews"), d.byStage?.interview || 0], ["offer", tr("Offer / 入职", "Offre / embauche", "Offer / hired"), (d.byStage?.offer || 0)+(d.byStage?.hired || 0)], ["closed", tr("已结束", "Terminées", "Closed"), (d.byStage?.rejected || 0)+(d.byStage?.archived || 0)]].map(([key, label, value]) => <RowLink key={String(key)} onClick={() => filter(String(key))} trailing={<strong>{value}</strong>}>{label}</RowLink>)}</section>}
    {!jobs.length && hasCv && <section className="jp-stack"><h3>{tr("从你的目标开始", "À partir de votre objectif", "Start with your goal")}</h3><Hint>{texts(data.config?.target_roles?.contract_types).map(product).join(" · ")}</Hint>{data.config?.availability?.earliest && <Hint>{tr("预计可入职：", "Disponibilité prévue : ", "Expected availability: ") + data.config.availability.earliest}</Hint>}<p>{tr("先比较少量相关岗位，再根据真实要求准备材料。", "Comparez quelques offres pertinentes, puis préparez vos preuves pour leurs exigences réelles.", "Compare a few relevant roles, then prepare evidence for their actual requirements.")}</p>{data.analysis?.markdown && <Button kind="outline" onClick={() => navigate({ tab: "profile", view: "analysis" })}>{tr("查看我的核心优势与行动", "Voir mes atouts et mes actions", "Review my signals and next actions")}</Button>}</section>}
    {!!rows(d.recentReplies).length && <section className="jp-stack"><h3>{tr("最近回复", "Dernières réponses", "Recent replies")}</h3>{rows(d.recentReplies).slice(0, 2).map((reply, index) => <button type="button" className="jp-list-item" key={index} onClick={() => openJob(reply.jobId, 3)}><strong>{reply.company}</strong><p>{reply.text}</p><Hint>{reply.at?.slice(0, 10)}</Hint></button>)}</section>}
    <Button kind="outline" onClick={() => navigate({ tab: "prepare" })}><GraduationCap size={20} />{tr("准备下一场面试", "Préparer mon prochain entretien", "Prepare for my next interview")}</Button>
  </div>;
}

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
  return <section className="jp-stack"><strong>{tr("本次搜索表现", "Performance de cette recherche", "Search performance")}</strong><Hint>{parts.join(" · ")}</Hint><Hint>{m.aiFallbackUsed ? tr("结构化源不足，已使用精简 AI 补充。", "Sources structurées insuffisantes : complément IA ciblé utilisé.", "Structured sources were insufficient; targeted AI fallback was used.") : tr("本次未调用搜索 Agent。", "Aucun agent de recherche utilisé pour cette requête.", "No search agent was used for this query.")}</Hint><Hint>{rows(m.providers).map(p => `${p.label}: ${status(p.status)}`).join(" · ")}</Hint>{m.estimatedApiCostUsd > 0 && <Hint>{tr("估算搜索 API 成本", "Coût API estimé", "Estimated search API cost") + `: $${m.estimatedApiCostUsd.toFixed(3)}`}</Hint>}<hr /></section>;
}
function OfferCard({ offer, selected, onSelect }: { offer: Json; selected: boolean; onSelect: () => void }) {
  const { data, tr, product, act, startTask } = usePilot();
  const savedJob = rows(data.jobs).find(j => j.url === offer.url);
  const saved = offer.jobId || savedJob;
  const evaluateJobId = offer.jobId || savedJob?.id;
  const evaluating = offer.lifecycle === "evaluating";
  const bits: string[] = [];
  if (offer.sourceLabel || offer.source) bits.push(product(offer.sourceLabel || offer.source));
  if (offer.relevanceTier === "adjacent") bits.push(tr("相邻机会", "opportunité adjacente", "adjacent opportunity"));
  if (offer.relevanceTier === "closest") bits.push(tr("最接近的备选", "meilleure option de repli", "closest fallback"));
  if (offer.seniorityFit === "above-target") bits.push(tr("资历可能高于当前目标", "séniorité possiblement supérieure", "seniority may be above target"));
  if (offer.roleFit === "outside-primary") bits.push(tr("岗位方向偏离主目标", "hors cible principale", "outside primary target"));
  if (offer.locationFit === "same-country") bits.push(tr("法国其他地区", "autre région en France", "elsewhere in France"));
  if (offer.locationFit === "europe-other") bits.push(tr("欧洲其他国家", "autre pays européen", "another European country"));
  if (offer.locationFit === "outside-europe") bits.push(tr("欧洲以外", "hors Europe", "outside Europe"));
  if (offer.locationFit === "outside-target") bits.push(tr("地点偏离主目标", "hors zone cible", "outside target location"));
  if (offer.contractType === "unknown") bits.push(tr("合同待确认", "contrat à confirmer", "contract to confirm"));
  if (offer.ageDays != null) bits.push(offer.ageDays === 0 ? tr("今天发布", "publiée aujourd’hui", "posted today") : tr(`${offer.ageDays} 天前`, `il y a ${offer.ageDays} j`, `${offer.ageDays}d ago`));
  if (offer.searchRelevance != null) bits.push(tr(`检索相关度 ${offer.searchRelevance}/100`, `pertinence recherche ${offer.searchRelevance}/100`, `search relevance ${offer.searchRelevance}/100`));
  return <article className="jp-offer" data-testid="discovery-offer"><div className="jp-row jp-offer-select-row"><button type="button" className="jp-select-box" aria-pressed={selected} aria-label={selected ? tr("取消选择岗位", "Désélectionner l’offre", "Deselect role") : tr("选择岗位", "Sélectionner l’offre", "Select role")} onClick={onSelect}>{selected ? <CheckSquare size={22} /> : <Square size={22} />}</button><div className="jp-grow"><div className="jp-company">{offer.company}</div><h2>{offer.title}</h2></div></div><Hint>{[offer.location, offer.contractType !== "unknown" ? product(offer.contractType) : ""].filter(Boolean).join(" · ")}</Hint><Hint>{bits.join(" · ")}</Hint><p>{offer.why}</p><Hint>{evaluating ? tr("分析中 · 不会重复启动", "Évaluation en cours · une seule tâche", "Evaluation in progress · one task only") : tr("待评估 · 岗位开放情况需核实", "À évaluer · disponibilité à confirmer", "Unassessed · availability unconfirmed")}</Hint><External url={offer.url}>{tr("查看职位来源", "Voir l’annonce source", "View source posting")}</External><div className="jp-row"><Button kind="outline" disabled={Boolean(saved)} onClick={() => act({ action: "saveOffer", offer })}>{saved ? tr("已收藏", "Enregistrée", "Saved") : tr("保存", "Enregistrer", "Save")}</Button><AiProgressButton taskKind="evaluate" jobId={evaluateJobId} disabled={evaluating} onClick={() => startTask({ kind: "evaluate", url: offer.url, offer })}>{tr("岗位评估", "Évaluer", "Evaluate")}</AiProgressButton></div></article>;
}
export function OffersPage() {
  const { data, tr, product, startTask, startTasks, saveOffers, busy } = usePilot();
  const defaultQuery = tr("根据当前简历、合同类型和目标，优先寻找巴黎和法国岗位，并扩展到欧洲其他国家或欧洲远程机会。优先官方职位页。", "Selon mon CV, les contrats ciblés et mes objectifs, chercher d’abord à Paris et en France, puis élargir aux autres pays européens et aux opportunités européennes à distance. Privilégier les pages employeur officielles.", "Based on my CV, target contracts and goals, search Paris and France first, then broaden to other European countries and Europe-based remote opportunities. Prefer official employer pages.");
  const [query, setQuery] = useState(defaultQuery), priorDefault = useRef(defaultQuery);
  useEffect(() => { setQuery(previous => previous === priorDefault.current ? defaultQuery : previous); priorDefault.current = defaultQuery; }, [defaultQuery]);
  const [url, setUrl] = useState("");
  const pastedJobId = rows(data.jobs).find(job=>job.url===url.trim())?.id;
  const searching = rows(data.tasks).some(t => t.kind === "search" && ACTIVE.has(t.status));
  const discovery = data.discovery || {};
  const offers=rows(discovery.offers).slice(0,DISCOVERY_OFFER_LIMIT);
  const [selected,setSelected]=useState<string[]>([]);
  useEffect(() => { const current=new Set(offers.map(offer=>String(offer.url)));setSelected(previous=>previous.filter(url=>current.has(url))); }, [offers.map(offer=>String(offer.url)).join("\n")]);
  const picked=offers.filter(offer=>selected.includes(String(offer.url))), allSelected=offers.length>0 && picked.length===offers.length;
  return <div className="jp-page" data-testid="offers-page"><Title sub={tr("已评估的岗位在「投递」中，不会重复出现在这里。", "Les postes évalués se retrouvent dans Candidatures.", "Evaluated roles move to Applications.")}>{tr("值得看的机会", "Les bonnes opportunités", "Worth a closer look")}</Title>
    <div className="jp-stack"><TextArea label={tr("搜索目标", "Ma recherche", "My search")} rows={3} value={query} onChange={e => setQuery(e.target.value)} /><Hint>{tr("合同类型：", "Contrats : ", "Contracts: ") + (texts(data.config?.target_roles?.contract_types).map(product).join(" · ") || tr("不限", "Tous", "All"))}</Hint><Button data-testid="search-offers" disabled={searching || !query.trim()} onClick={() => startTask({ kind: "search", query })}>{searching ? tr("搜索中", "Recherche en cours", "Searching") : tr("寻找适合我的岗位", "Rechercher des offres", "Find opportunities")}</Button></div>
    <div className="jp-stack"><Input label={tr("或粘贴职位链接", "Ou coller le lien d’un poste", "Or paste a job URL")} value={url} type="url" autoCapitalize="none" onChange={e => setUrl(e.target.value)} /><AiProgressButton taskKind="evaluate" jobId={pastedJobId} kind="outline" disabled={!safeExternalUrl(url.trim())} onClick={() => startTask({ kind: "evaluate", url: url.trim() })}>{tr("查看／评估该岗位", "Consulter / évaluer cette offre", "View / evaluate this role")}</AiProgressButton><hr /></div>
    <div className="jp-row spread"><strong>{tr("待处理岗位", "À examiner", "To review")}</strong><Hint>{discovery.searchedAt?.slice(0, 10)}</Hint></div>
    {!!offers.length && <Button kind="text" data-testid="select-all-pending" onClick={() => setSelected(allSelected ? [] : offers.map(offer=>String(offer.url)))}>{allSelected ? tr("取消全选", "Tout désélectionner", "Clear selection") : tr("一键选中所有待处理岗位", "Tout sélectionner", "Select all pending roles")}</Button>}
    {!!picked.length && <div className="jp-row"><Button kind="outline" data-testid="bulk-save-offers" disabled={busy} onClick={() => { const batch=[...picked];setSelected([]);void saveOffers(batch); }}>{tr(`收藏 ${picked.length}`, `Enregistrer ${picked.length}`, `Save ${picked.length}`)}</Button><Button data-testid="bulk-evaluate-offers" disabled={busy || !picked.some(offer=>offer.lifecycle!=="evaluating")} onClick={() => { const batch=picked.filter(offer=>offer.lifecycle!=="evaluating").map(offer=>({kind:"evaluate",url:offer.url,offer}));setSelected([]);void startTasks(batch,tr("批量岗位评估", "Évaluations groupées", "Batch evaluations")); }}>{tr(`评估 ${picked.length}`, `Évaluer ${picked.length}`, `Evaluate ${picked.length}`)}</Button></div>}
    {discovery.partial && <Hint>{discovery.warning}</Hint>}<SearchMetrics value={discovery.searchMetrics} />
    {!offers.length && <Empty title={tr("这里没有待处理的岗位", "Aucune offre en attente ici", "No pending offers here")}>{tr("可以发起搜索，或到投递页查看已有评估。", "Lancez une recherche ou consultez vos évaluations dans Candidatures.", "Search for opportunities or view evaluations in Applications.")}</Empty>}{offers.map(offer => <OfferCard key={offer.url} offer={offer} selected={selected.includes(String(offer.url))} onSelect={() => setSelected(previous=>previous.includes(String(offer.url))?previous.filter(url=>url!==String(offer.url)):[...previous,String(offer.url)])} />)}
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
