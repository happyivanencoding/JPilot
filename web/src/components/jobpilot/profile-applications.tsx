"use client";
import {useState} from 'react';
import {rows,texts,usePilot,type Json} from './pilot-context';
import {applicationRows} from './model.mjs';
import {Hint,Input,Pill,Select} from './ui';

/** Read-only candidature history; callers may pass a pre-filtered collection. */
export function ProfileApplications({jobs:providedJobs,heading=true,openTab=2}:{jobs?:Json[];heading?:boolean;openTab?:number}={}) {
 const {data,tr,product,openJob}=usePilot();
 const [status,setStatus]=useState(''),[query,setQuery]=useState('');
 const jobs=providedJobs||rows(data.jobs),visible=applicationRows(jobs,status,query) as Json[];
 const statuses=[...new Set([...texts(data.statuses),...jobs.map(j=>j.status).filter(Boolean)])];
 return <div className="jp-stack" data-testid="profile-applications">
  {heading&&<h2>{tr('投递情况','Mes candidatures','My applications')}</h2>}
  <Hint>{tr(`全部 ${jobs.length} 个岗位 · 当前显示 ${visible.length} 个`,`${jobs.length} offres · ${visible.length} affichées`,`${jobs.length} roles · ${visible.length} shown`)}</Hint>
  <Input label={tr('搜索公司或岗位','Rechercher une entreprise ou un poste','Search company or role')} value={query} data-testid="application-query" onChange={e=>setQuery(e.target.value)}/>
  <Select label={tr('状态','Statut','Status')} value={status} onChange={setStatus}><option value="">{tr('全部状态','Tous les statuts','All statuses')}</option>{statuses.map(s=><option key={s} value={s}>{product(s)}</option>)}</Select>
  {!visible.length&&<Hint>{jobs.length?tr('没有符合筛选的岗位。','Aucune offre ne correspond aux filtres.','No roles match these filters.'):tr('保存或跟踪的岗位会显示在这里。','Vos offres enregistrées et suivies apparaîtront ici.','Saved and tracked roles will appear here.')}</Hint>}
  {visible.map(job=>{
   const followup=job.followup||{},changed=rows(job.statusHistory).at(-1)?.at,reply=rows(job.replies).at(-1);
   const documents=[job.cv?.file?tr('岗位 CV 已保留','CV ciblé conservé','Tailored CV saved'):'',job.cvDraft?.status==='pending'?tr('新草稿待确认','Nouveau brouillon à confirmer','New draft awaiting review'):''].filter(Boolean);
   return <button type="button" key={job.id} className="jp-card jp-application-card" data-testid={`application-${job.id}`} onClick={()=>openJob(job.id,openTab)}>
    <strong className="jp-accent">{job.company}</strong><h3>{job.role}</h3><div><Pill>{product(job.status||'À candidater')}</Pill></div>
    <Hint>{[job.location,job.contract&&product(job.contract)].filter(x=>x&&x!=='unknown').join(' · ')}</Hint>
    {changed&&<Hint>{tr('状态更新：','Statut modifié : ','Status updated: ')}{String(changed).slice(0,10)}</Hint>}
    {followup.dueDate&&<Hint>{tr('跟进日期：','Relance : ','Follow-up: ')}{followup.dueDate}</Hint>}
    {followup.nextActionSource==='user'&&followup.nextAction&&<p>{followup.nextAction}</p>}{followup.note&&<p className="jp-application-excerpt">{followup.note}</p>}
    <Hint>{documents.join(' · ')||tr('尚无岗位版 CV','Pas encore de CV ciblé','No tailored CV yet')}</Hint>
    {reply&&<p className="jp-application-excerpt">{tr('最近回复：','Dernière réponse : ','Latest reply: ')}{reply.text}</p>}
   </button>;
  })}
 </div>;
}
