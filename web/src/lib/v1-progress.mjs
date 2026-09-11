export function estimatedProgress(elapsedSeconds, status, targetSeconds=90) {
 if(status==='completed')return 1;
 if(!['queued','running','reconciling','failed','interrupted'].includes(status))return 0;
 return Math.min(.96,Math.max(.04,.96*(1-Math.exp(-3*Math.max(0,elapsedSeconds)/Math.max(1,targetSeconds)))));
}
export function searchProgress(task,group,locale='en',requestedAt) {
 if(!task)return null;
 const phase=['queued','running','reconciling'].includes(task.status)?'search':!(group.offers || []).every(o=>o.deepMatchState==='ready')?'match':'translate';
 const failed=['failed','interrupted'].includes(task.status)||group.failed;
 const status=failed?'failed':task.status==='completed'&&(group.ready||group.availableCount===0&&group.resultMatches!==false)?'completed':'running';
 const labels={search:['正在找岗位','Recherche des offres','Finding roles'],match:['正在比较匹配','Comparaison des profils','Comparing your fit'],translate:['正在准备建议','Préparation des conseils','Preparing insights']};
 const label=labels[phase][locale==='zh'?0:locale==='fr'?1:2];
 return {id:task.id,kind:'search',status,createdAt:requestedAt||task.createdAt,updatedAt:task.updatedAt,estimate:{targetSeconds:90},label};
}
