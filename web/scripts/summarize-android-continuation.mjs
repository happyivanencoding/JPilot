// Aggregate existing task records for the current synthetic-persona acceptance.
// Never calls providers, starts agents, or modifies canonical Candidate files.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const profiles=process.argv.slice(2);
if(!profiles.length||profiles.some(p=>!/^[a-z0-9-]+$/.test(p)))throw new Error('Pass the synthetic profile ids to summarize.');
const all=profiles.flatMap(profile=>{
 const directory=path.join(root,'.career-ops-web/profiles',profile,'mobile/tasks');
 return fs.readdirSync(directory).filter(f=>/^[a-f0-9-]{36}\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(directory,f),'utf8')));
}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
const analyses=all.filter(t=>t.kind==='analysis'&&t.status==='completed'&&t.result?.globalPlan);
const newest=(profile,kind)=>all.find(t=>t.profileId===profile&&t.kind===kind&&t.status==='completed');
const selected=[...analyses,...profiles.flatMap(p=>[newest(p,'search'),newest(p,'evaluate')]).filter(Boolean)];
const started=Math.min(...analyses.map(t=>Date.parse(t.createdAt)));
const relevant=all.filter(t=>Date.parse(t.createdAt)>=started);
const groups=new Map();
for(const t of relevant.filter(t=>t.status==='completed'&&t.runId)){
 const key=t.profileId+'|'+t.operationKey;groups.set(key,[...(groups.get(key)||[]),t.id]);
}
const runs=selected.filter(t=>Date.parse(t.createdAt)>=started).map(t=>({profile:t.profileId,taskId:t.id,flow:t.kind,cvVersion:t.cvVersion,status:t.status,createdAt:t.createdAt,metrics:t.metrics}));
const result={recordedAt:new Date().toISOString(),runs,
 duplicateSuccessfulOperationGroups:[...groups.values()].filter(ids=>ids.length>1),
 setupOnlyFailures:relevant.filter(t=>t.status==='failed'&&!t.runId).map(t=>({profile:t.profileId,id:t.id,kind:t.kind,error:t.error})),
};
const file=path.join(root,'.career-ops-web/mobile-qa/continuation-20260908/release-summary.json');
fs.writeFileSync(file,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,setupOnlyFailures:result.setupOnlyFailures.length},null,2));
