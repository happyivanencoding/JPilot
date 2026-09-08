// Fictional browser QA data only. No production module imports this file.
import { dashboardFor, applyJobUpdate } from '../../src/lib/mobile-domain.mjs';
const pick=(l,z,f,e)=>l==='zh'?z:l==='en'?e:f;
export function tinyPdf(label='ORIGINAL SYNTHETIC CV') {
  const content=`BT /F1 20 Tf 48 785 Td (JobPilot browser QA) Tj 0 -34 Td /F1 12 Tf (${label}) Tj 0 -30 Td (No real candidate data. Test document only.) Tj ET`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out='%PDF-1.4\n',offsets=[0];
  for(const [i,object] of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${object}\nendobj\n`;}
  const xref=Buffer.byteLength(out);out+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}
function seed(id, index) {
  const base={cvVersion:1,versionId:'qa-v1',revision:1,changedAt:'2026-09-08T08:00:00Z'};
  const job={id:'qa-role-1',company:'Sample Research',role:'Research Analyst',url:'https://example.test/jobs/research',location:'Paris',workMode:'Hybrid',contract:'CDI',score:4.6,reportNum:'901',status:'À candidater',stage:'preparing',evaluationState:'evaluated',lastChecked:'2026-09-08',summary:'Saved assessment',strengths:['Evidence from the test profile'],gaps:[{title:'Presentation practice',severity:'Modéré',why:'Test requirement',positioning:'Practice with examples'}],match:[{requirement:'SQL',fit:'Fort',evidence:'Synthetic evidence',action:'Prepare an example'}],followup:{nextAction:'Saved automatic next action',nextActionSource:'system',dueDate:'2026-09-07',note:''},replies:[],statusHistory:[],cv:{file:'fixture.pdf',atsScore:82,keywordCoverage:75,keywords:['SQL','Research'],changes:['Synthetic change'],inputVersionId:'qa-v1',pages:1},mobilePlan:{taskId:'qa-plan-saved',markdown:'Saved plan',questions:['Describe your research process.']},prepTasks:[{id:'prep-1',label:'Prepare an example',done:false}],interview:{processKnown:false,process:['Interview with team'],caseStudy:'Describe a research case.',questions:[{question:'Describe your research process.',answer:'Use a documented example.',proof:'Synthetic project'}]}};
  return {version:'0.3.2',profile:{id,name:index?'Beta QA — SYNTHETIC':'Alpha QA — SYNTHETIC'},profiles:[],cv:'# Synthetic CV\n\nTexte original en français. No real person.',cvState:base,config:{cv:{language:'fr'},candidate:{location:'Paris'},target_roles:{primary:['Research Analyst'],contract_types:['CDI']},compensation:{location_flexibility:'Europe remote'}},languageSettings:{uiLocale:'zh',applicationLanguage:'fr',documentLanguage:'fr'},jobs:index?[]:[job,{...structuredClone(job),id:'qa-role-2',company:'Example Studio',role:'Data Analyst',score:3.7,reportNum:'902',status:'Entretien',stage:'interview',url:'https://example.test/jobs/data',followup:{nextAction:'Prepare',dueDate:'',note:''}},{...structuredClone(job),id:'qa-role-3',company:'Sample Labs',role:'Analyst',score:null,reportNum:null,evaluationState:'saved',url:'https://example.test/jobs/other',followup:{nextAction:'',dueDate:'',note:''},cv:{},summary:'',strengths:[],gaps:[],match:[]}],statuses:['À candidater','CV prêt','Candidature envoyée','Réponse reçue','Entretien','Offre reçue','Embauché','Refus','Archivée'],tasks:[],analysis:{taskId:'qa-analysis-saved',createdAt:'2026-09-08',markdown:'Saved full analysis',stale:false,resolvedCount:0,globalLayout:{headline:'Whole-page plan',languageNote:'Existing document language is preserved.',signals:[{title:'Research experience',why:'This is the strongest signal.',evidence:'Synthetic CV'}],overlooked:['Make the main evidence easy to find.'],beforeBudget:{words:500,bullets:12},budget:{words:420,bullets:10},allocations:[{section:'Experience',priority:'primary',reason:'Prioritize strongest evidence.',spaceTradeoff:'Compress early experience.'}],issues:[],applicable:true},expressionIssues:[{id:'issue-1',title:'Clarify research evidence',detail:'Use a specific example.',before:'Travail de recherche.',after:'Recherche structurée et documentée.',evidence:'Synthetic evidence',applicable:true}],actionIssues:[{id:'action-1',title:'Practice an interview',detail:'Real preparation is needed.',nextAction:'Prepare a short example.',evidence:'Synthetic job requirements'}]},discovery:{searchedAt:'2026-09-08',offers:[{url:'https://example.test/jobs/new',company:'Fictional Employer',title:'Junior Analyst',location:'Paris',contractType:'CDI',why:'Saved search result',sourceLabel:'Official posting',relevanceTier:'strong',ageDays:2,searchRelevance:86}],searchMetrics:{returnedCount:1,strongCount:1,wallMs:1250,fresh7dRate:100,datedRate:100,aiFallbackUsed:false,providers:[{label:'Fixture provider',status:'ok'}]}},flowEstimates:{},localization:{pending:false}};
}
export function fixtureApi(ids) {
  const fixtures=Object.fromEntries(ids.map((id,i)=>[id,seed(id,i)]));
  for(const f of Object.values(fixtures))f.profiles=ids.map((id,i)=>({id,name:i?'Beta QA — SYNTHETIC':'Alpha QA — SYNTHETIC',shortName:i?'Beta QA':'Alpha QA'}));
  const posts=[],requests=[],unexpected=[],drafts=new Map();let serial=0,failNext=false,slowLocale='';
  const snapshots=(id,locale)=>{
    const s=structuredClone(fixtures[id]);s.languageSettings.uiLocale=locale;s.dashboard=dashboardFor(s.jobs,'2026-09-08');
    s.analysis.markdown=pick(locale,'## 已保存的完整分析\n\n所有内容均为测试数据。','## Analyse enregistrée\n\nDonnées de test uniquement.','## Saved full analysis\n\nSynthetic data only.');
    s.analysis.globalLayout.headline=pick(locale,'一页中突出最有价值的证据','Mettre en avant les preuves utiles','Prioritize the strongest evidence');
    s.analysis.globalLayout.languageNote=pick(locale,'原始材料为法语，改写保持文档语言。','Les retouches gardent la langue du document.','Edits preserve the document language.');
    for(const j of s.jobs){if(j.summary)j.summary=pick(locale,'已有评估：测试档案具备相关证据。','Évaluation enregistrée : preuves pertinentes.','Saved assessment: relevant evidence.');j.strengths=(j.strengths || []).map(()=>pick(locale,'研究经历有可核实的佐证。','Expérience de recherche documentée.','Documented research experience.'));}
    for(const t of s.tasks){t.title=pick(locale,'测试任务','Traitement de test','Test task');t.phase=pick(locale,t.status==='completed'?'已保存结果':'后台进行中',t.status==='completed'?'Résultat enregistré':'Traitement en cours',t.status==='completed'?'Saved result':'Running in background');}
    return s;
  };
  async function handler(route) {
    const req=route.request(),u=new URL(req.url()),profile=u.searchParams.get('profileId')||req.headers()['x-jobpilot-profile']||ids[0],locale=req.headers()['x-jobpilot-locale']||'fr';
    requests.push({path:u.pathname,profile,locale,method:req.method()});
    const f=fixtures[profile];
    const send=(body,status=200,headers={})=>route.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(body)}).catch(()=>{});
    if(!f)return send({error:'Invalid fixture profile'},400);
    let body={};if(req.method()==='POST'&&req.headers()['content-type']?.includes('application/json'))body=req.postDataJSON();
    if(req.method()==='POST')posts.push({path:u.pathname,profile,locale,body,headers:req.headers()});
    if(req.method()==='GET'&&locale===slowLocale)await new Promise(r=>setTimeout(r,600));
    if(req.method()==='GET'&&failNext&&u.pathname==='/api/mobile'){failNext=false;return send({error:'QA connection error'},503);}
    if(u.pathname==='/api/profiles'&&req.method()==='POST')return send({ok:true,profileId:body.profileId},200,{'set-cookie':`career-ops-profile=${body.profileId}; Path=/; SameSite=Lax; HttpOnly`});
    if(u.pathname==='/api/profile'&&req.method()==='POST'){
      if(body.applicationLanguage){f.languageSettings.applicationLanguage=body.applicationLanguage;f.config.cv.language=body.applicationLanguage;}
      if(body.contractTypes)f.config.target_roles.contract_types=body.contractTypes;
      if(body.roles)f.config.target_roles.primary=body.roles;
      if(body.location)f.config.candidate.location=body.location;
      if(body.remote)f.config.compensation.location_flexibility=body.remote;
      return send({ok:true});
    }
    if(u.pathname==='/api/cv'&&req.method()==='POST'){
      if(body.expectedVersionId!==f.cvState.versionId)return send({error:'另一个窗口已更新简历，请关闭后重新打开。'},409);
      f.cv=body.content;f.cvState.versionId=`qa-v${++f.cvState.revision}`;f.analysis.stale=true;return send({ok:true,changed:true});
    }
    if(u.pathname==='/api/mobile/upload'&&req.method()==='POST'){
      const task={id:`qa-task-${++serial}`,kind:'ingest',status:'completed',inputVersionId:f.cvState.versionId,title:'Import',input:{kind:'ingest'},result:{proposal:'# Imported synthetic CV\n\nOriginal text for browser QA.',filename:'fixture.txt'}};f.tasks.unshift(task);return send(task);
    }
    if(u.pathname==='/api/mobile/cv'||u.pathname==='/api/candidatures/cv'){
      if(u.searchParams.get('format')==='meta'){
        const id=u.searchParams.get('draftId');
        if(id&&!drafts.has(id))drafts.set(id,{status:'pending',baseVersionId:f.cvState.versionId,globalPlan:true});
        return send({pages:1,layoutNote:pick(locale,'实际 PDF 预览','Aperçu du PDF réel','Actual PDF preview'),warnings:[],layout:{acceptable:true,lines:35,bullets:10,fontPt:10,issues:[]},...(id?{draft:drafts.get(id)}:{})});
      }
      return route.fulfill({status:200,contentType:'application/pdf',body:tinyPdf(u.searchParams.has('draftId')?'PROPOSED SYNTHETIC CV':'ORIGINAL SYNTHETIC CV')});
    }
    if(u.pathname==='/api/mobile'&&req.method()==='GET'){
      if(u.searchParams.get('reportJobId'))return send({markdown:pick(locale,'# 已保存的岗位报告\n\n这是测试报告，不会重新评估。','# Rapport enregistré\n\nRapport de test sans nouvelle évaluation.','# Saved report\n\nTest report without re-evaluation.'),localization:{pending:false}});
      const taskId=u.searchParams.get('taskId');
      if(taskId){const task=snapshots(profile,locale).tasks.find(t=>t.id===taskId);return task?send(task):send({error:'Missing fixture task'},404);}
      return send(snapshots(profile,locale));
    }
    if(u.pathname==='/api/mobile'&&req.method()==='POST'){
      if(body.action==='updateJob'){
        const index=f.jobs.findIndex(j=>j.id===body.id);if(index<0)return send({error:'Wrong profile'},400);
        f.jobs[index]=applyJobUpdate(f.jobs[index],body.change,'2026-09-08T12:00:00Z');return send({ok:true,job:f.jobs[index]});
      }
      if(body.action==='saveOffer'){
        const job={id:'qa-saved-offer',company:body.offer.company,role:body.offer.title,url:body.offer.url,status:'À candidater',score:null,evaluationState:'saved',followup:{}};f.jobs.push(job);f.discovery.offers[0].jobId=job.id;return send({ok:true,job});
      }
      if(body.action==='confirmCv'){
        if(body.expectedVersionId!==f.cvState.versionId)return send({error:'Version conflict'},409);
        f.cv=body.content;f.cvState.versionId=`qa-v${++f.cvState.revision}`;return send({ok:true});
      }
      if(body.action==='decideCvDraft'){
        const d=drafts.get(body.draftId);if(!d||d.status!=='pending')return send({error:'Already decided'},409);
        d.status=body.decision==='accept'?'accepted':'rejected';
        if(body.decision==='accept'){f.cv+='\nAccepted synthetic draft.';f.cvState.versionId=`qa-v${++f.cvState.revision}`;f.analysis.resolvedCount++;}
        return send({ok:true});
      }
      if(body.action==='task'){
        const input=body.input,kind=input.kind,task={id:`qa-task-${++serial}`,kind,input,status:kind==='search'?'queued':'completed',title:'Synthetic test task',inputVersionId:f.cvState.versionId,jobId:input.jobId,estimate:{label:'Synthetic estimate'},metrics:{wallMs:2100,totalTokens:500,estimatedCostUsd:.001},result:{markdown:pick(locale,'# 已保存的测试反馈\n\n清晰的行动建议。','# Retour de test enregistré\n\nProchaine action claire.','# Saved test feedback\n\nA clear next step.')},destination:{jobId:input.jobId}};
        if(kind==='rewrite'){const id=`qa-draft-${serial}`;drafts.set(id,{status:'pending',baseVersionId:f.cvState.versionId,globalPlan:true});task.result.draftId=id;task.destination.draftId=id;}
        if(kind==='evaluate'){const job=f.jobs.find(j=>j.url===input.url)||f.jobs[0];job.evaluationState='evaluated';job.score=4.6;job.summary='Saved evaluation';task.jobId=job.id;task.destination.jobId=job.id;task.result.jobId=job.id;}
        if(kind==='plan'){const job=f.jobs.find(j=>j.id===input.jobId);job.mobilePlan={taskId:task.id,markdown:task.result.markdown,questions:['Describe your experience.']};}
        f.tasks.unshift(task);return send(task,task.status==='queued'?202:200);
      }
    }
    unexpected.push(`${req.method()} ${u.pathname}`);return send({error:'Unmocked API blocked during browser QA'},599);
  }
  return {fixtures,posts,requests,unexpected,drafts,handler,snapshots,setFailNext:()=>{failNext=true;},setSlowLocale:l=>{slowLocale=l;}};
}
