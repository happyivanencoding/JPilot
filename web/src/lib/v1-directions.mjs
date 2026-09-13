// Conservative, local direction grouping. No model call is needed to recognise
// common bilingual job titles, and specialisms are never discarded when merging.
export const V1_NEW_SEARCHES_PER_DAY=6;
export const V1_SEARCH_CACHE_MS=24*60*60*1000;
export const V1_SEARCH_REVISION='v16-intent-first-deep-score';
const norm=value=>String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const families=[
 ['export-sales',/\bexport\b|出口/,['Export sales support','Support commercial export','出口销售支持'],'assistant commercial export junior'],
 ['business-development',/business develop|developpement commercial|business developer|拓展|业务发展/,['Business development','Développement commercial','业务发展'],'business developer junior'],
 ['market-research',/market research|market intelligence|etude.*marche|recherche.*marche|市场调研|市场研究/,['Market research','Études de marché','市场调研'],'charge etudes de marche junior'],
 ['supply-planning',/supply planner|demand plann|planif.*supply|supply chain plan|planificateur.*(?:supply|chaine|flux)|供应链.*计划|计划.*供应链/,['Supply planning','Planification supply chain','供应链计划'],'planificateur supply chain'],
 ['procurement-supply',/approvision|procurement|purchas|\bachats?\b|acheteur|采购|供应/,['Procurement & supply','Achats et approvisionnement','采购与供应'],'approvisionneur'],
 ['logistics',/logistic|logistiqu|物流/,['Logistics','Logistique','物流'],'assistant logistique junior'],
 ['continuous-improvement',/continuous improvement|amelioration continue|lean|excellence operation|performance industrielle|持续改进/,['Continuous improvement','Amélioration continue industrielle','工业持续改进'],'ingenieur amelioration continue'],
 ['project-coordination',/project coordin|coordina.*projet|项目协调|运营与项目/,['Project coordination','Coordination de projets','项目协调'],'coordinateur projet junior'],
 ['operations',/\boperations?\b|运营/,['Operations','Opérations','运营'],'assistant operations junior'],
 ['data-analysis',/data analyst|analys.*donnee|数据分析/,['Data analysis','Analyse de données','数据分析'],'data analyst junior'],
 ['financial-analysis',/financial analys|analys.*financier|财务分析/,['Financial analysis','Analyse financière','财务分析'],'analyste financier junior'],
 ['marketing',/marketing|市场营销/,['Marketing','Marketing','市场营销'],'assistant marketing junior'],
];
const specialisms=[['finance',/\bfinance\b|financial|financier|金融/],['quant',/quant|量化/],['construction',/construction|batiment|建筑/],['energy',/energy|energie|petrol|能源/],['health',/health|sante|medical|医疗/],['digital',/digital|numerique|数字/],['compliance',/customs|douane|compliance|conformite|合规|海关/],['engineering',/engineer|ingenieur|工程/],['senior',/\bsenior\b|director|directeur|高级|总监/]];
const stop=new Set('junior assistant assistante analyste analyst intern stage cdi cdd alternance emploi job jobs international internationale junior h f et and de du des en the for in'.split(' '));
function genericKey(value){return [...new Set(norm(value).split(' ').filter(x=>!stop.has(x)))].sort().join('-');}
export function directionDescriptor(query,analysis={},locale='en') {
 const normalized=norm(query);
 const own=(analysis.careerDirections || []).find(d=>[d.searchQuery,d.title,...(d.aliases || [])].some(x=>x&&norm(x)===normalized));
 const source=own?.searchQuery || String(query).trim();
 const family=families.find(([,pattern])=>pattern.test(norm(source)));
 const qualifiers=specialisms.filter(([,pattern])=>pattern.test(norm(source))).map(([key])=>key);
 const key=(family?.[0] || genericKey(source) || normalized)+ (qualifiers.length?':'+qualifiers.join(':'):'');
 const index=locale==='zh'?2:locale==='fr'?1:0;
 // A known personalised title is preferred by the client, but this stable label
 // also covers custom searches in history without displaying execution tokens.
 const title=family && !qualifiers.length ? family[2][index] : own?.title || String(query).trim();
 const searchQuery=source; // Market translation is performed by the AI search planner.
 return {key,title,searchQuery,sourceTitle:own?.title || String(query).trim(),known:!!family&&!qualifiers.length};
}
export function incompleteEmptySearch(task) {
 return task?.kind==='search' && task.status==='completed' && !(task.result?.offers || []).length
   && (task.result?.searchMetrics?.providers || []).some(run=>!['arbeitnow-dev','tracked-ats'].includes(run.id)&&['error','partial'].includes(run.status));
}
export function planDirectionSearch(tasks,input,versionId,analysis={},now=Date.now()) {
 const descriptor=directionDescriptor(input.query,analysis);
 const searches=tasks.filter(t=>t.kind==='search'&&t.inputVersionId===versionId);
 const compatible=t=>(t.input.directionKey || directionDescriptor(t.input.query,analysis).key)===descriptor.key
  && (!input.searchRevision || t.input.searchRevision===input.searchRevision);
 const active=searches.find(t=>['queued','running','reconciling'].includes(t.status));
 const cached=!input.refresh&&searches.find(t=>compatible(t)&&t.status==='completed'&&!incompleteEmptySearch(t)&&now-Date.parse(t.createdAt)<V1_SEARCH_CACHE_MS);
 if(cached) return {descriptor,reuse:cached,reason:norm(cached.input.query)===norm(input.query)?'reused':'merged'};
 if(active) return {descriptor,reuse:active,reason:compatible(active)?'reused':'active'};
 const date=new Date(now).toISOString().slice(0,10);
 // Direction budgets belong to the current Candidate Version. Uploading a new
 // CV creates a new evidence version and must not inherit yesterday's/current
 // day's exploratory quota from a different CV.
 const today=searches.filter(t=>!incompleteEmptySearch(t)&&t.createdAt?.slice(0,10)===date);
 const usedDirections=new Set(today.map(t=>t.input.directionKey || directionDescriptor(t.input.query,analysis).key));
 const used=usedDirections.size;
 if(used>=V1_NEW_SEARCHES_PER_DAY && !usedDirections.has(descriptor.key)) return {descriptor,reason:'daily-limit',used,limit:V1_NEW_SEARCHES_PER_DAY};
 const refreshSequence=input.refresh ? 1+searches.filter(t=>compatible(t)&&t.createdAt?.slice(0,10)===date).length : 0;
 return {descriptor,reason:input.refresh?'refresh':'new',used,limit:V1_NEW_SEARCHES_PER_DAY,refreshSequence};
}
export function directionNotice(reason,title,locale='en') {
 const choose=(zh,fr,en)=>locale==='zh'?zh:locale==='fr'?fr:en;
 if(reason==='merged') return choose(`已并入「${title}」，一起查看已找到的岗位。`,`Regroupé dans « ${title} » : retrouvez les offres déjà sélectionnées.`,`Grouped with “${title}” so you can compare the roles already found.`);
 if(reason==='reused') return choose(`已打开「${title}」的现有结果。`,`Résultats existants de « ${title} ».`,`Showing your existing “${title}” results.`);
 if(reason==='active') return choose('先完成正在准备的这一组，再探索下一步。','La sélection en cours se termine avant une nouvelle piste.','Let this selection finish before exploring another direction.');
 if(reason==='daily-limit')return choose(`今天已探索 ${V1_NEW_SEARCHES_PER_DAY} 个方向。先比较现有岗位，明天可以继续拓展。`,`Vous avez exploré ${V1_NEW_SEARCHES_PER_DAY} pistes aujourd’hui. Comparez ces offres ; de nouvelles pistes seront disponibles demain.`,`You have explored ${V1_NEW_SEARCHES_PER_DAY} directions today. Compare your existing roles; explore more tomorrow.`);
 return '';
}
export function compactDirectionHistory(tasks,analysis={}) {
 const seen=new Set();return tasks.filter(t=>{const direction=t.input.directionKey || directionDescriptor(t.input.query,analysis).key;const key=`${t.inputVersionId || 'legacy'}:${direction}`;if(seen.has(key))return false;seen.add(key);return true;});
}

export function v1CandidatePriority(offer,query) {
 const requested=directionDescriptor(query).key.split(':')[0],actual=directionDescriptor(offer.title).key.split(':')[0];
 const commercial=new Set(['export-sales','business-development']);
 const affinity=requested===actual?8:commercial.has(requested)&&commercial.has(actual)?3:0;
 const tier={strong:3,adjacent:2,closest:1}[offer.relevanceTier] || 0;
 const search=Number(offer.rankScore ?? offer.searchRelevance ?? 0);
 const bridge=Number(offer.fastMatch?.bridgeability ?? 60);
 const fit=Number(offer.fastMatch?.score ?? 50);
 const bounded=Number(offer.discoveryRank ?? Math.round(search*.82+bridge*.12+fit*.06));
 // Reused search tasks must preserve the same intent-first semantics as fresh
 // searches. Candidate fit only breaks ties inside the requested occupation.
 return tier*1000+bounded+affinity;
}
