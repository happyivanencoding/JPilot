// Real model-call acceptance for JobPilot, using only isolated fictional Candidate roots.
// Raw model output stays in ignored .career-ops-web/mobile-qa artifacts.
import './register-source-loader.mjs';
const {readCandidatureStore}=await import('../src/lib/candidatures.ts');
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {prepareCase,benchmarkRoot,fixtureJob} from './jobpilot-benchmark-fixture.mjs';

function loadLocalEnv() {
  const file=path.resolve(import.meta.dirname,'../.env.local');
  if(!fs.existsSync(file))return;
  for(const raw of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
    const line=raw.trim();if(!line||line.startsWith('#'))continue;
    const match=line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);if(!match)continue;
    let value=match[2].trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
    if(!process.env[match[1]])process.env[match[1]]=value;
  }
}
loadLocalEnv();

const flows=['analysis','evaluate','cv','plan','practice','compare','coach','localization'];
const caseIndex=process.argv.indexOf('--case');
const tag=(process.argv.find(arg=>arg.startsWith('--tag='))?.slice(6) || new Date().toISOString().replace(/\D/g,'').slice(0,14)).toLowerCase();
if(!/^[a-z0-9-]+$/.test(tag))throw new Error('Invalid acceptance tag.');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

if(caseIndex<0) {
  const runRoot=path.join(benchmarkRoot,'ai-full',tag);fs.mkdirSync(runRoot,{recursive:true});
  const results=[];let cursor=0;
  const worker=async()=>{
    while(cursor<flows.length) {
      const flow=flows[cursor++];
      const id=`ai-${flow}-${tag}`;
      const directory=prepareCase(id,flow==='evaluate'?'evaluate':'ai');
      const previousFile=path.join(directory,'ai-acceptance.json');
      const previous=fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile,'utf8')):null;
      // A tag identifies one acceptance run. Resume interrupted runners without rebilling completed cases.
      if(previous?.status==='completed') {
        results.push(previous);
        console.log(JSON.stringify({flow,status:'completed',reusedAcceptance:true,wallMs:previous.wallMs}));
        continue;
      }
      const child=spawn(process.execPath,['--no-warnings','--experimental-strip-types',path.resolve(import.meta.filename),'--case',flow,`--tag=${tag}`],{
        cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,CAREER_OPS_ROOT:directory},windowsHide:true,stdio:['ignore','pipe','pipe'],
      });
      let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
      const code=await new Promise(resolve=>{child.on('error',()=>resolve(-1));child.on('close',resolve);});
      const file=path.join(directory,'ai-acceptance.json');
      const record=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{flow,status:'failed',error:`runner exited ${code}: ${stderr.slice(-800)}`};
      results.push(record);
      console.log(JSON.stringify({flow,status:record.status,wallMs:record.wallMs,model:record.metrics?.model,transport:record.metrics?.transport,error:record.error||null}));
      if(code!==0&&!record.error)record.error=(stderr||stdout).slice(-800);
    }
  };
  await Promise.all([worker(),worker()]);
  results.sort((a,b)=>flows.indexOf(a.flow)-flows.indexOf(b.flow));
  const summary={syntheticOnly:true,productionCandidateWrites:0,tag,createdAt:new Date().toISOString(),passed:results.every(r=>r.status==='completed'),results:results.map(r=>({flow:r.flow,status:r.status,wallMs:r.wallMs,model:r.metrics?.model||null,reasoning:r.metrics?.reasoning||null,transport:r.metrics?.transport||null,totalTokens:r.metrics?.totalTokens??null,estimatedCostUsd:r.metrics?.estimatedCostUsd??null,checks:r.checks||{},error:r.error||null}))};
  fs.writeFileSync(path.join(runRoot,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(`AI ACCEPTANCE ${summary.passed?'PASS':'FAIL'}: ${path.join(runRoot,'summary.json')}`);
  if(!summary.passed)process.exitCode=1;
} else {
  const flow=process.argv[caseIndex+1];if(!flows.includes(flow))throw new Error('Unknown AI flow.');
  const directory=process.env.CAREER_OPS_ROOT;
  if(!directory?.startsWith(path.join(benchmarkRoot,'cases')) || !fs.existsSync(path.join(directory,'fixture.json')))throw new Error('Isolated fixture root required.');
  const started=Date.now();const record={flow,status:'running',startedAt:new Date().toISOString(),syntheticOnly:true,productionCandidateWrites:0,metrics:{},checks:{}};
  const file=path.join(directory,'ai-acceptance.json');const save=()=>fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');save();
  try {
    const storeFile=path.join(directory,'data/candidatures.json');
    const store=JSON.parse(fs.readFileSync(storeFile,'utf8'));
    const primary=store.jobs[0];
    primary.sourceDescription='Synthetic job description: Junior quantitative portfolio support in Paris. Requires Python, SQL, fixed-income research, disciplined data controls, clear English communication and collaboration with portfolio managers. Direct discretionary portfolio ownership is helpful but not mandatory for this junior role.';
    if(flow==='cv') primary.cv={...(primary.cv||{}),keywords:[]}; // regression: empty ATS keyword list must still render successfully.
    if(flow==='compare') store.jobs.push({...fixtureJob,id:'benchmark-job-2',company:'Demo Capital',role:'Junior Market Risk Analyst',url:'https://example.invalid/jobs/risk',score:3.6,reportNum:'902',summary:'Synthetic alternative emphasizing market risk analytics, SQL and controls.',angle:'Risk analytics and data quality.',sourceDescription:'Synthetic market-risk role.',cv:{keywords:['SQL','risk']}});
    fs.writeFileSync(storeFile,JSON.stringify(store,null,2)+'\n');

    if(flow==='localization') {
      const {localizeDisplay}=await import('../src/lib/display-localization.ts');
      const {historyDirectory}=await import('../src/lib/mobile-history.ts');
      const {readJson}=await import('../src/lib/mobile-state.mjs');
      const source={markdown:'The candidate should emphasize documented Python experience and prepare concrete evidence for portfolio-support work.',summary:'The role requires disciplined reporting and clear communication.'};
      const initial=await localizeDisplay('benchmark','zh',source,'result',{identity:`ai-localization-${tag}`,retry:true});
      record.checks.initialPending=initial.localization?.pending===true;
      const activeFile=path.join(historyDirectory('benchmark'),'localizations','zh','active.json');
      let operation=null;
      for(let i=0;i<80;i++){operation=readJson(activeFile);if(operation&&['completed','failed','interrupted'].includes(operation.status))break;await sleep(1000);}
      if(operation?.status!=='completed')throw new Error(operation?.error || `Localization did not complete: ${operation?.status||'missing'}`);
      record.metrics=operation.metrics||{};
      const translated=await localizeDisplay('benchmark','zh',source,'result',{identity:`ai-localization-${tag}`,schedule:false});
      record.checks.translated=translated.localization?.pending===false && translated.markdown!==source.markdown && !String(translated.markdown).includes('正在翻译');
      if(!record.checks.translated)throw new Error('Localization completed but translated projection was not reusable.');
    } else {
      const {startMobileTask,readMobileTask}=await import('../src/lib/mobile-engine.ts');
      const input=flow==='analysis'?{kind:'analysis',language:'zh',uiLocale:'zh'}
        :flow==='evaluate'?{kind:'evaluate',url:fixtureJob.url,language:'zh',uiLocale:'zh'}
        :flow==='cv'?{kind:'cv',jobId:fixtureJob.id,language:'zh',uiLocale:'zh',applicationLanguage:'fr'}
        :flow==='plan'?{kind:'plan',jobId:fixtureJob.id,minutesPerDay:30,language:'zh',uiLocale:'zh'}
        :flow==='practice'?{kind:'practice',jobId:fixtureJob.id,question:'请用一个真实经历说明你如何保证金融数据质量。',answer:'在虚构基准经历中，我使用 Python 清洗金融时间序列，并记录数据质量检查，再把结果与经理讨论。',language:'zh',uiLocale:'zh'}
        :flow==='compare'?{kind:'compare',jobIds:[fixtureJob.id,'benchmark-job-2'],language:'zh',uiLocale:'zh'}
        :{kind:'coach',jobId:fixtureJob.id,question:'基于已记录证据，我转向巴黎初级固定收益量化岗位时应如何定位自己？',language:'zh',uiLocale:'zh'};
      let task=await startMobileTask('benchmark',{...input,retry:true});
      for(let i=0;i<180 && ['queued','running','reconciling'].includes(task.status);i++){await sleep(1000);task=readMobileTask('benchmark',task.id);}
      record.taskId=task.id;record.metrics=task.metrics||{};record.checks.terminal=task.status==='completed';
      if(task.status!=='completed')throw new Error(task.error || `Task ended as ${task.status}`);
      if(flow==='analysis') {
        record.checks.structured=Boolean(task.result?.markdown && Array.isArray(task.result?.expressionIssues));
        if(!record.checks.structured)throw new Error('Analysis result missing structured fields.');
      } else if(['practice','compare','coach'].includes(flow)) {
        record.checks.markdown=Boolean(task.result?.markdown);
        if(!record.checks.markdown)throw new Error(`${flow} result missing markdown.`);
      } else if(flow==='plan') {
        const job=readCandidatureStore('benchmark').jobs.find(j=>j.id===fixtureJob.id);
        record.checks.persisted=job?.mobilePlan?.taskId===task.id && Array.isArray(job?.prepTasks) && job.prepTasks.length>0;
        if(!record.checks.persisted)throw new Error('Plan completed but did not persist checklist/plan.');
      } else if(flow==='cv') {
        const job=readCandidatureStore('benchmark').jobs.find(j=>j.id===fixtureJob.id),draft=job?.cvDraft;
        const pdf=path.join(directory,draft?.file||'missing');
        record.checks.pdf=fs.existsSync(pdf) && fs.readFileSync(pdf).subarray(0,5).toString()==='%PDF-';
        record.checks.ats=typeof draft?.atsScore==='number';
        record.checks.emptyKeywordCoverage=draft?.keywordCoverage===null;
        record.checks.pendingConfirmation=draft?.status==='pending' && task.result?.draftId===draft?.id;
        record.checks.savedCvUnchanged=JSON.stringify(job?.cv)===JSON.stringify(primary.cv);
        record.checks.presentationScore=Number.isFinite(draft?.assessment?.baselineScore) && draft.assessment.draftScore>=draft.assessment.baselineScore;
        if(Object.values(record.checks).some(value=>value!==true))throw new Error('Tailored CV did not persist a valid pending PDF/ATS/assessment draft or changed the saved CV before confirmation.');
      } else if(flow==='evaluate') {
        const {findPersistedEvaluation}=await import('../src/lib/evaluation-state.ts');
        const evaluation=findPersistedEvaluation('benchmark',fixtureJob.url);
        record.checks.persisted=Boolean(evaluation?.source==='official-report' && evaluation?.reportNum);
        if(!record.checks.persisted)throw new Error('Evaluation completed without an official persisted report.');
      }
    }
    record.status='completed';
  } catch(error) {record.status='failed';record.error=error instanceof Error?error.message:String(error);}
  record.finishedAt=new Date().toISOString();record.wallMs=Date.now()-started;save();
  console.log(JSON.stringify({flow:record.flow,status:record.status,wallMs:record.wallMs,error:record.error||null}));
  if(record.status!=='completed')process.exitCode=1;
}
