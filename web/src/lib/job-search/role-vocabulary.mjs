// Market vocabulary only. CV/UI language and nationality are deliberately absent.
const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const families=[
 ['finops',/finops|technology business management|\btbm\b|cloud cost|cloud financial|gouvernance.{0,20}(?:cout|coût).{0,12}cloud|(?:cout|coût).{0,12}cloud/, 'finops technical lead','responsable finops'],
 ['enterprise-platform',/enterprise platform architect|platform architect|architecte.{0,20}plateforme|enterprise architect|architecte.{0,20}entreprise|solution architect|architecte.{0,12}solution/, 'enterprise platform architect','architecte plateforme entreprise'],
 ['quantitative',/(?:\bquant(?:itative)?\b|\bquantitat(?:if|ive)\b|量化)/, 'quantitative analyst','analyste quantitatif'],
 ['data-engineering',/data engineer|ingenieur.{0,12}(?:donnees|data)|ingenierie.{0,10}donnees|数据工程/, 'data engineer','ingenieur donnees'],
 ['data-analysis',/data analyst|analys[et].{0,12}(?:donnees|data)|business intelligence|数据分析/,'data analyst','analyste donnees'],
 ['data-science',/data scien|scientifique.{0,10}donnees|数据科学/,'data scientist','data scientist'],
 ['backend',/back.?end|后端/,'backend developer','developpeur backend'],
 ['frontend',/front.?end|前端/,'frontend developer','developpeur frontend'],
 ['fullstack',/full.?stack|全栈/,'full stack developer','developpeur full stack'],
 ['software',/software (?:engineer|developer)|developpeu[rse]+|ingenieur logiciel|genie logiciel|软件开发|软件工程/,'software developer','developpeur logiciel'],
 ['cybersecurity',/cyber.?secur|cyber.?securite|securite informatique|网络安全/,'cybersecurity analyst','analyste cybersecurite'],
 ['devops',/devops|site reliability|云运维/,'devops engineer','ingenieur devops'],
 ['human-resources',/human resources|ressources humaines|人力资源/,'human resources','ressources humaines'],
 ['recruitment',/recruit|recrutement|招聘/,'recruitment','charge recrutement'],
 ['accounting',/accountan|comptab|会计/,'accountant','comptable'],
 ['audit',/\baudit|审计/,'audit','audit'],
 ['procurement',/procurement|purchasing|acheteur|\bachats|采购/,'procurement','acheteur'],
 ['communications',/communications?|relations publiques|公关|传播/,'communications','charge communication'],
 ['project-coordination',/project coordin|coordina.*projet|项目协调/,'project coordinator','coordinateur projet'],
];
export function roleFamily(value){return families.find(([,pattern])=>pattern.test(norm(value))) || null;}
export function bilingualRoleQueries(query){
 const family=roleFamily(query);if(!family)return [];
 const text=norm(query),qualifiers=(text.match(/\b(?:java|python|typescript|react|angular|c#|c\+\+|\.net|sql|cloud|azure|aws|finance|banking|sante|health|senior|junior|stage|alternance|cdi|cdd)\b/g)||[]).filter((v,i,a)=>a.indexOf(v)===i).slice(0,3).join(' ');
 const titles=family[0]==='quantitative'
  ? ['quantitative analyst','quantitative researcher','analyste quantitatif','quant analyst','recherche quantitative']
  : [family[2],family[3]];
 return [...new Set(titles.map(title=>`${title} ${qualifiers}`.trim()))];
}
export function bilingualRoleRelevance(query,title){
 const wanted=roleFamily(query),found=roleFamily(title);
 return wanted && found && wanted[0]===found[0] ? 78 : 0;
}
