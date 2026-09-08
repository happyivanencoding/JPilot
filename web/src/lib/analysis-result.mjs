import {jsonrepair} from 'jsonrepair';
/** The prefill salvage parser is unsuitable for a complete CV decision. Syntax repair is local, never a new model call. */
export function parseAnalysisResult(output) {
  const text=String(output).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  if(!text.startsWith('{')||!text.endsWith('}'))throw new Error('Analyse incomplète : aucun résultat partiel ne sera présenté comme terminé.');
  let result,repaired=false;
  try{result=JSON.parse(text);}catch{
    // Observed model defect: a dangling ," immediately before an object close.
    // Only remove it outside strings; never rewrite candidate text or numbers.
    let cleaned='',quoted=false,escape=false;
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if(!quoted && c===',') {const bad=text.slice(i).match(/^,\s*"\s*(?=})/);if(bad){i+=bad[0].length-1;continue;}}
      cleaned+=c;
      if(quoted){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quoted=false;}
      else if(c==='"')quoted=true;
    }
    result=JSON.parse(jsonrepair(cleaned));repaired=true;
  }
  // Some models place companion sections inside globalPlan. This is structural,
  // not missing content: preserve the exact supplied fields without inventing any.
  for(const key of ['expressionIssues','actionIssues','tasks','questions'])if(!result[key]&&result.globalPlan?.[key])result[key]=result.globalPlan[key];
  if(typeof result.markdown!=='string'||!result.markdown.trim()||!result.globalPlan||!Array.isArray(result.globalPlan.targetBlocks)||!Array.isArray(result.expressionIssues)||!Array.isArray(result.actionIssues))throw new Error('L’analyse ne contient pas le plan global et les actions attendus. Le résultat doit être récupéré ou corrigé, pas masqué par un résumé.');
  return {...result,formatRepair:repaired?'local-json-syntax':'none'};
}
