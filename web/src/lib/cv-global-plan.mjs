import { documentLanguage, contradictsDocumentLanguage } from './language-contract.mjs';
// A single analysis plans the entire page. Applying it is deterministic, never another model call.
export function presentationLanguage(candidate,fallback='fr') {
  return documentLanguage(candidate); // fallback is legacy signature only; UI language is never used.
}
export function preservePresentationLanguage(result,candidate,analysisLanguage) {
  const language=documentLanguage(candidate);
  const source=candidate.sources.cv.text;
  result={...result,expressionIssues:(result.expressionIssues || []).map(i=>contradictsDocumentLanguage(i.after,language,i.before) ? {...i,after:i.before,languageBlocked:true} : i)};
  if(!result.globalPlan)return result;
  const sourceBlocks=new Map(cvBlocks(source).map(b=>[b.id,b.text]));
  const mixed=(result.globalPlan.targetBlocks || []).some(b=>b.text && contradictsDocumentLanguage(b.text,language,(b.sourceIds || []).map(id=>sourceBlocks.get(id)||'').join('\n')));
  if(!mixed && result.globalPlan.cvLanguage===language)return result;
  // Observed failure: French analysis translated only some English CV bullets.
  // Preserve source wording rather than silently accepting a mixed-language CV.
  // The saved structural decisions (order/removals) still apply, without new AI.
  const targetBlocks=result.globalPlan.targetBlocks.map(b=>b.action==='remove'||b.action==='keep'?b:{...b,action:'keep',text:undefined,reason:`${b.reason || ''} Texte source conservé : aucune traduction demandée.`});
  return {...result,globalPlan:{...result.globalPlan,targetBlocks,cvLanguage:language,sourceWordingOnly:true,
    languageNote:'Le texte original est conservé pour éviter une traduction partielle non demandée. Ce plan applique la sélection et l’ordre des contenus ; les reformulations ne sont pas enregistrées.'}};
}
export function cvBlocks(markdown) {
  const blocks=[];let paragraph=[];
  const push=()=>{if(paragraph.length){blocks.push({id:`b${blocks.length+1}`,text:paragraph.join('\n')});paragraph=[];}};
  for(const line of String(markdown).replace(/\r\n/g,'\n').split('\n')) {
    if(!line.trim()){push();continue;}
    if(/^#{1,4}\s|^\s*[-*]\s|^>\s/.test(line)){push();paragraph=[line];push();}
    else paragraph.push(line);
  }
  push();return blocks;
}
export function cvTextBudget(text) {
  const lines=String(text).split(/\r?\n/);let run=0,maxBulletRun=0;
  for(const line of lines){if(/^\s*[-*]\s/.test(line)){run++;maxBulletRun=Math.max(maxBulletRun,run);}else if(line.trim())run=0;}
  return {words:String(text).trim().split(/\s+/).filter(Boolean).length,characters:String(text).length,
    bullets:lines.filter(l=>/^\s*[-*]\s/.test(l)).length,maxBulletRun,sections:lines.filter(l=>/^##\s/.test(l)).length};
}
export function compileGlobalPlan(plan,cv) {
  const source=cvBlocks(cv),byId=new Map(source.map(b=>[b.id,b]));
  if(!plan || !Array.isArray(plan.targetBlocks) || !Array.isArray(plan.signals) || plan.signals.length<2 || plan.signals.length>3) throw new Error('Le plan doit identifier 2–3 signaux et une version complète du CV.');
  const seen=new Set(),parts=[],changes=[];
  for(const block of plan.targetBlocks) {
    if(!Array.isArray(block.sourceIds) || !block.sourceIds.length)throw new Error('Chaque bloc proposé doit citer ses preuves dans le CV.');
    const inputs=block.sourceIds.map(id=>{if(!byId.has(id)||seen.has(id))throw new Error('Un bloc source est absent ou utilisé deux fois.');seen.add(id);return byId.get(id);});
    const before=inputs.map(b=>b.text).join('\n\n');
    if(!['keep','shorten','rewrite','merge','remove'].includes(block.action))throw new Error('Action de mise en page inconnue.');
    const text=block.action==='keep'?before:block.action==='remove'?'':String(block.text || '').trim();
    if(block.action!=='remove'&&!text)throw new Error('Une modification vide doit être une suppression explicite.');
    if(inputs.some(b=>/^#\s/.test(b.text)||/@/.test(b.text)) && text!==before)throw new Error('L’identité et les coordonnées ne peuvent être modifiées par le plan de présentation.');
    for(const number of text.match(/\b\d+(?:[.,]\d+)?%?\b/g)||[]) if(!before.includes(number))throw new Error('Le plan introduit ou déplace un chiffre sans preuve dans le bloc concerné.');
    if(text)parts.push(text);
    if(text!==before)changes.push({id:`global-${changes.length+1}`,sourceIds:block.sourceIds,before,after:text,action:block.action,reason:block.reason || ''});
  }
  if(seen.size!==source.length)throw new Error('Le plan doit décider du sort de chaque bloc : conserver, raccourcir, fusionner ou retirer.');
  const content=parts.join('\n\n')+'\n';
  for(const language of ['French','Français','English','Anglais']) {
    const pattern=new RegExp(`\\b${language}\\s*[:—-]?\\s*(A[12]|B[12]|C[12])\\b`,'i');
    const level=cv.match(pattern)?.[1];
    if(level && content.match(pattern)?.[1]?.toUpperCase()!==level.toUpperCase())throw new Error('Le niveau de langue explicite doit rester visible et inchangé.');
  }
  if(/fictif|fictional|synthetic/i.test(cv) && !/fictif|fictional|synthetic/i.test(content))throw new Error('Le marquage du profil fictif doit rester visible.');
  const budget=cvTextBudget(content),junior=plan.audience==='junior';
  const limits={maxWords:junior?470:620,maxBullets:junior?12:18,maxBulletsPerBlock:junior?3:5};
  const issues=[];
  if(budget.words>limits.maxWords)issues.push('Trop de texte : privilégier la sélection, pas une police plus petite.');
  if(budget.bullets>limits.maxBullets)issues.push('Trop de puces pour distinguer les signaux prioritaires.');
  if(budget.maxBulletRun>limits.maxBulletsPerBlock)issues.push('Une expérience comporte trop de puces pour cette cible.');
  return {content,changes,budget,beforeBudget:cvTextBudget(cv),limits,issues,applicable:issues.length===0};
}
export function globalPlanView(plan,cv) {
  if(!plan)return null;
  try {const compiled=compileGlobalPlan(plan,cv);return {...plan,...compiled,targetBlocks:undefined,content:undefined};}
  catch(error){return {...plan,targetBlocks:undefined,applicable:false,issues:[error.message]};}
}
