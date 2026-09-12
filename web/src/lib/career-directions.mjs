// Broaden inferred suggestions, not user-entered searches or career facts.
const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const roles=[
 ['data-engineer',/data engineer|ingenieur.*(?:donnees|data)|数据工程/,['Data engineer','Ingénieur données','数据工程师'],'data engineer'],
 ['data-scientist',/data scien|数据科学/,['Data scientist','Data scientist','数据科学家'],'data scientist'],
 ['data-analyst',/data analys|analys.*(?:donnees|data)|business intelligence|数据分析|数据.*分析/,['Data analyst','Data analyst','数据分析师'],'data analyst'],
 ['policy-analyst',/public polic|policy (?:evalua|analys)|politiques? publiques?|政策/,['Policy analyst','Analyste politiques publiques','政策分析师'],'analyste politiques publiques'],
 ['economist',/economist|economiste|economics|经济学家|环境经济/,['Economist','Économiste','经济学家'],'economiste'],
 ['esg-analyst',/\besg\b|sustainab|durabil|developpement durable|可持续|环境.*咨询/,['ESG analyst','Analyste ESG','ESG 分析师'],'analyste ESG'],
 ['financial-analyst',/financial analys|analyste financi|财务分析|金融分析/,['Financial analyst','Analyste financier','金融分析师'],'analyste financier'],
 ['business-analyst',/business analys|业务分析/,['Business analyst','Business analyst','业务分析师'],'business analyst'],
 ['supply-planning',/supply planner|demand planner|planif.*supply|supply chain plan|planificateur.*(?:supply|chaine|flux)|prevision.*(?:supply|demande)|供应链.*计划|计划.*供应链/,['Supply planning','Planification supply chain','供应链计划'],'planificateur supply chain'],
 ['procurement-supply',/procurement|purchas|\bachats?\b|approvision|acheteur|采购|供应/,['Procurement & supply','Achats et approvisionnement','采购与供应'],'approvisionneur'],
 ['logistics',/logistic|logistiqu|transport|物流/,['Logistics coordination','Coordination logistique','物流协调'],'coordinateur logistique'],
 ['continuous-improvement',/continuous improvement|amelioration continue|lean|excellence operation|performance industrielle|持续改进/,['Continuous improvement','Amélioration continue industrielle','工业持续改进'],'ingenieur amelioration continue'],
 ['backend-developer',/back.?end|后端/,['Backend developer','Développeur backend','后端开发工程师'],'developpeur backend'],
 ['frontend-developer',/front.?end|前端/,['Frontend developer','Développeur frontend','前端开发工程师'],'developpeur frontend'],
 ['software-developer',/software (?:engineer|develop)|developpeur|ingenieur logiciel|软件开发|软件工程/,['Software developer','Développeur logiciel','软件开发工程师'],'developpeur logiciel'],
 ['marketing',/marketing|市场营销/,['Marketing specialist','Chargé de marketing','市场营销专员'],'charge marketing'],
 ['communication',/communication|公关|传播/,['Communications specialist','Chargé de communication','传播专员'],'charge communication'],
];
export function broadCareerDirections(directions=[],locale='en',explicitRoles=[]) {
 const index=locale==='zh'?2:locale==='fr'?1:0,explicit=new Set(explicitRoles.map(norm)),seen=new Set(),result=[];
 for(const [sourceIndex,direction] of directions.entries()) {
  const title=norm(direction.title),query=norm(direction.searchQuery);
  const userChosen=explicit.has(title)||explicit.has(query);
  const role=userChosen?null:roles.find(([,re])=>re.test(title)) || roles.find(([,re])=>re.test(query));
  const key=role?.[0]||query||title;
  if(seen.has(key))continue;seen.add(key);
  result.push({...direction,sourceIndex,key:role?'market:'+key:direction.key,
    title:role?role[2][index]:direction.title,searchQuery:role?role[3]:direction.searchQuery,
    broad:!!role,aliases:[...new Set([direction.title,direction.searchQuery,...(direction.aliases||[])].filter(Boolean))]});
 }
 return result.slice(0,5);
}
