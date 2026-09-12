export function estimatedProgress(elapsedSeconds, status, targetSeconds=90) {
 if(status==='completed')return 1;
 if(!['queued','running','reconciling','failed','interrupted'].includes(status))return 0;
 return Math.min(.96,Math.max(.04,.96*(1-Math.exp(-3*Math.max(0,elapsedSeconds)/Math.max(1,targetSeconds)))));
}
export function searchProgress(task,group,locale='en',requestedAt) {
 if(!task)return null;
 // Search is complete once provider retrieval + Fast Match are persisted. Deep
 // Match, localization and role-CV work are independent enrichment states and
 // must never hold the search button at 96%.
 const failed=['failed','interrupted'].includes(task.status);
 const status=failed?'failed':task.status==='completed'?'completed':'running';
 const labels={running:['正在找岗位','Recherche des offres','Finding roles'],completed:['岗位已找到','Offres trouvées','Roles found'],failed:['搜索未完成','Recherche interrompue','Search did not finish']};
 const label=labels[status][locale==='zh'?0:locale==='fr'?1:2];
 return {id:task.id,kind:'search',status,createdAt:requestedAt||task.createdAt,updatedAt:task.updatedAt,estimate:{targetSeconds:90},label};
}
