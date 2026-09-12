import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readJson, writeJson, withProfileLock } from './mobile-state.mjs';
import { previewToken, readPreviewSession } from './v1-session.mjs';

export const FUNNEL_STEPS = ['login','upload_cv','choose_direction','view_jobs','open_job','view_cv','generate_cv','tracking'];
export const CORE_FUNNEL_STEPS = ['cv_ready','jobs_seen','job_opened','analysis_read','generate_cv_started','cv_completed'];
export const CANONICAL_PAGES = ['onboarding_email','onboarding_upload','onboarding_analysis','onboarding_direction','onboarding_search','onboarding_results','home','offers','profile','profile_analysis','task_center','task_detail','job_report','compare','cv_edit','job_match','job_cv','job_tracking','pdf'];
export const RETENTION_MONTHS = 6;
// UTC calendar months make the rolling boundary independent of the server timezone.
// Clamp month-end dates (for example August 31 -> February 28/29).
export function analyticsRetentionCutoff(now = Date.now()) {
  const date = new Date(now), day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - RETENTION_MONTHS);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-z][a-z0-9_-]{0,63}$/;
const CONTEXT = /^[a-f0-9]{16,64}$/i;
const EVENTS = ['page_enter','page_exit','page_heartbeat','click','scroll','funnel','ai_wait'];
const KINDS = ['analysis','search','evaluate','cv'];
const VALID_STEPS = new Set([...FUNNEL_STEPS,'generate_cv_started']);
const FIELDS = new Set(['id','sessionId','event','page','action','step','durationMs','scrollDepth','kind','status','timestamp','contextId']);
const PAGE_ALIASES = {
  login:'onboarding_email',upload:'onboarding_upload',analysis_wait:'onboarding_analysis',directions:'onboarding_direction',
  search_wait:'onboarding_search',first_results:'onboarding_results',opportunities:'offers',cv_preview:'pdf',analysis:'profile_analysis',
  tasks:'task_center',task:'task_detail',report:'job_report','edit-cv':'cv_edit',
};
export function normalizeAnalyticsPage(value) {
  if(!value) return value;
  return PAGE_ALIASES[value] || value;
}
const fail = message => { throw Object.assign(new Error(message), {status:400}); };

export function authenticatedAnalyticsProfile(root, headers) {
  // Identity is never accepted from body, profile cookie or unsigned gateway headers.
  const session = readPreviewSession(root, previewToken(headers));
  if (!session) throw Object.assign(new Error('Please sign in.'), {status:401});
  return session.profileId;
}
export function validateAnalyticsEvents(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => key !== 'events') ||
      !Array.isArray(input.events) || input.events.length < 1 || input.events.length > 50) fail('Expected 1–50 analytics events.');
  return input.events.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !FIELDS.has(key))) fail('Unknown analytics field.');
    if (!UUID.test(value.id) || !UUID.test(value.sessionId) || !EVENTS.includes(value.event)) fail('Invalid analytics identity or event.');
    const event = {id:value.id.toLowerCase(),sessionId:value.sessionId.toLowerCase(),event:value.event};
    for (const key of ['page','action']) if (value[key] !== undefined) {
      if (typeof value[key] !== 'string' || !TOKEN.test(value[key])) fail('Invalid analytics token.');
      event[key] = key==='page' ? normalizeAnalyticsPage(value[key]) : value[key];
    }
    if (event.page && !CANONICAL_PAGES.includes(event.page)) fail('Invalid analytics page.');
    if (value.contextId !== undefined) { if (typeof value.contextId !== 'string' || !CONTEXT.test(value.contextId)) fail('Invalid analytics context.'); event.contextId=value.contextId.toLowerCase(); }
    if (value.step !== undefined) { if (!VALID_STEPS.has(value.step)) fail('Invalid funnel step.'); event.step=value.step; }
    for (const [key,max] of [['durationMs',86400000],['scrollDepth',100]]) if (value[key] !== undefined) {
      if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > max) fail('Invalid analytics measurement.');
      event[key]=Math.round(value[key]);
    }
    if (value.kind !== undefined) { if (!KINDS.includes(value.kind)) fail('Invalid AI kind.'); event.kind=value.kind; }
    if (value.status !== undefined) { if (!['completed','failed','abandoned'].includes(value.status)) fail('Invalid AI status.'); event.status=value.status; }
    if (['page_enter','page_exit','page_heartbeat','scroll'].includes(value.event) && !event.page) fail('Page required.');
    if (['page_exit','page_heartbeat'].includes(value.event) && event.durationMs===undefined) fail('Duration required.');
    if (value.event==='scroll' && event.scrollDepth===undefined) fail('Scroll depth required.');
    if (value.event==='click' && !event.action) fail('Action required.');
    if (value.event==='funnel' && !event.step) fail('Step required.');
    if (value.event==='ai_wait' && (!event.kind || !event.status || event.durationMs===undefined)) fail('AI wait fields required.');
    const timestamp = value.timestamp ?? now;
    if (!Number.isSafeInteger(timestamp) || timestamp < analyticsRetentionCutoff(now) || timestamp > now+300000) fail('Invalid analytics timestamp.');
    return {...event,timestamp,receivedAt:now};
  });
}
function directory(root, profileId) {
  if (typeof profileId !== 'string' || !profileId || profileId.length > 160) fail('Invalid profile.');
  return path.join(root,'.career-ops-web','analytics',createHash('sha256').update(profileId).digest('hex'));
}
export async function recordAnalytics(root, profileId, input, now = Date.now()) {
  return persistAnalytics(root,profileId,validateAnalyticsEvents(input,now),now);
}
async function persistAnalytics(root,profileId,incoming,now) {
  await pruneAnalytics(root,now);
  const dir=directory(root,profileId);
  return withProfileLock(dir, () => {
    const file=path.join(dir,'events.json');
    const store=readJson(file,{userId:randomUUID(),events:[],discarded:0});
    const retained=store.events.filter(event=>event.timestamp>=analyticsRetentionCutoff(now));
    const identity=event=>(event.source==='server'?'server:':'client:')+String(event.event||'event')+':'+event.id;
    const ids=new Set(retained.map(identity));
    const added=[];
    for(const event of incoming) if(!ids.has(identity(event))) { ids.add(identity(event)); added.push(event); }
    const all=[...retained,...added];
    const discarded=(store.discarded||0)+store.events.length-retained.length;
    writeJson(file,{userId:store.userId,discarded,events:all});
    return {accepted:added.length,duplicates:incoming.length-added.length};
  });
}
export async function recordServerProductEvent(root,profileId,type,id,timestamp=Date.now()) {
  try {
    if(!['cv_ready','cv_completed','cv_failed'].includes(type)||!UUID.test(id)) return {recorded:false};
    const result=await persistAnalytics(root,profileId,[{id:id.toLowerCase(),event:type,source:'server',timestamp,receivedAt:Date.now()}],timestamp);
    return {recorded:result.accepted>0};
  } catch { return {recorded:false}; }
}
export async function recordCvDecision(root,profileId,draftId,decision,rejectionReasonProvided=false,timestamp=Date.now()) {
  try {
    if(!UUID.test(draftId)||!['accept','reject'].includes(decision))return {recorded:false};
    const result=await persistAnalytics(root,profileId,[{id:draftId.toLowerCase(),event:'cv_decision',source:'server',decision,rejectionReasonProvided:Boolean(rejectionReasonProvided),timestamp,receivedAt:Date.now()}],timestamp);
    return {recorded:result.accepted>0};
  }catch{return {recorded:false};}
}
// Called only at the live backend task terminal persistence boundary. Never backfills history.
export async function recordServerAiTask(root,task,finishedAt=Date.now()) {
  try {
    const kind=task.kind==='deep_match'?'evaluate':task.kind==='cv_review'?'cv':task.kind;
    if(!KINDS.includes(kind)||!UUID.test(task.id)||!['completed','failed'].includes(task.status)) return {recorded:false};
    const createdAt=Date.parse(task.createdAt);
    if(!Number.isFinite(createdAt)||!Number.isFinite(finishedAt)||finishedAt<createdAt) return {recorded:false};
    const incoming=[{
      id:task.id.toLowerCase(),event:'server_ai_task',source:'server',kind,taskKind:task.kind,status:task.status,
      durationMs:Math.round(finishedAt-createdAt),createdAt,finishedAt,timestamp:finishedAt,receivedAt:Date.now(),
    }];
    if(task.kind==='cv') incoming.push({id:task.id.toLowerCase(),event:task.status==='completed'?'cv_completed':'cv_failed',source:'server',timestamp:finishedAt,receivedAt:Date.now()});
    const result=await persistAnalytics(root,task.profileId,incoming,finishedAt);
    return {recorded:result.accepted>0};
  } catch { return {recorded:false}; } // Telemetry must never fail a business task.
}
export function readProfileAnalytics(root,profileId,now=Date.now()) {
  const store=readJson(path.join(directory(root,profileId),'events.json'),{userId:null,events:[],discarded:0});
  return {...store,events:store.events.filter(event=>event.timestamp>=analyticsRetentionCutoff(now))};
}
const percentile=(values,p)=>values.length ? [...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)] : null;
const rate=(a,b)=>b? a/b : null;
const first=(events,predicate,after=-Infinity)=>events.find(e=>e.timestamp>=after&&predicate(e))?.timestamp??null;
const parisDayKey=timestamp=>{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const plusDays=(day,count)=>{const [y,m,d]=day.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d+count));return date.toISOString().slice(0,10);};
function analysisReads(events) {
  const states=new Map(),reads=[];
  for(const event of events) {
    if(event.page!=='job_match') continue;
    const key=event.contextId||`legacy:${event.sessionId}`;
    const state=states.get(key)||{durationMs:0,maxScrollDepth:0,readAt:null};
    if(['page_exit','page_heartbeat'].includes(event.event))state.durationMs+=Number(event.durationMs)||0;
    if(['scroll','page_exit','page_heartbeat'].includes(event.event))state.maxScrollDepth=Math.max(state.maxScrollDepth,Number(event.scrollDepth)||0);
    if(state.readAt==null&&(state.durationMs>=8000||state.maxScrollDepth>=50)){state.readAt=event.timestamp;reads.push({contextId:key,readAt:event.timestamp,durationMs:state.durationMs,maxScrollDepth:state.maxScrollDepth});}
    states.set(key,state);
  }
  return reads;
}
function waitSummary(waits) {
  const abandoned=waits.filter(e=>e.status==='abandoned');
  return {segments:waits.length,p50Ms:percentile(waits.map(e=>e.durationMs),.5),p90Ms:percentile(waits.map(e=>e.durationMs),.9),
    completed:waits.filter(e=>e.status==='completed').length,failed:waits.filter(e=>e.status==='failed').length,abandoned:abandoned.length,abandonedRate:rate(abandoned.length,waits.length),
    abandonedP50Ms:percentile(abandoned.map(e=>e.durationMs),.5),abandonedP90Ms:percentile(abandoned.map(e=>e.durationMs),.9),
    abandonedBuckets:[5000,15000,30000,60000,120000,Infinity].map((ceiling,i,bounds)=>({upToMs:Number.isFinite(ceiling)?ceiling:null,count:abandoned.filter(e=>e.durationMs<ceiling&&e.durationMs>=(i?bounds[i-1]:0)).length}))};
}
function serverSummary(tasks) {
  const failed=tasks.filter(e=>e.status==='failed').length;
  return {tasks:tasks.length,completed:tasks.filter(e=>e.status==='completed').length,failed,failureRate:rate(failed,tasks.length),p50Ms:percentile(tasks.map(e=>e.durationMs),.5),p90Ms:percentile(tasks.map(e=>e.durationMs),.9),measurement:'server_task_created_to_terminal_ms_including_queue_and_non_model_work'};
}
function ttv(label,users,start,end) {
  const values=[];
  for(const user of users){const a=start(user),b=end(user,a);if(a!=null&&b!=null&&b>=a)values.push(b-a);}
  return {metric:label,samples:values.length,p50Ms:percentile(values,.5),p90Ms:percentile(values,.9)};
}
export function analyticsReport(stores,now=Date.now()) {
  const retainedStores=stores.map(store=>({...store,events:(store.events||[]).filter(e=>e.timestamp>=analyticsRetentionCutoff(now)).map(e=>e.page?{...e,page:normalizeAnalyticsPage(e.page)}:e)})).filter(store=>store.events.length);
  const users=retainedStores.map(store=>{
    const events=store.events.filter(e=>e.source!=='server').sort((a,b)=>a.timestamp-b.timestamp);
    const serverEvents=store.events.filter(e=>e.source==='server').sort((a,b)=>a.timestamp-b.timestamp);
    let reached=0;
    for(const event of events){const step=event.step==='generate_cv_started'?'generate_cv':event.step;if(event.event==='funnel'&&step===FUNNEL_STEPS[reached])reached++;}
    const sessions=new Map();
    for(const event of events){if(!sessions.has(event.sessionId))sessions.set(event.sessionId,[]);sessions.get(event.sessionId).push(event);}
    const reads=analysisReads(events);
    const loginAt=first(events,e=>e.event==='funnel'&&e.step==='login');
    const cvReadyAt=first(serverEvents,e=>e.event==='cv_ready');
    const jobsSeenAt=first(events,e=>e.event==='funnel'&&e.step==='view_jobs',cvReadyAt??-Infinity);
    const jobOpenedAt=first(events,e=>e.event==='funnel'&&e.step==='open_job',jobsSeenAt??-Infinity);
    const analysisReadAt=reads.map(x=>x.readAt).filter(x=>jobOpenedAt==null||x>=jobOpenedAt).sort((a,b)=>a-b)[0]??null;
    const generateStartedAt=first(events,e=>e.event==='funnel'&&['generate_cv','generate_cv_started'].includes(e.step),analysisReadAt??-Infinity);
    const cvCompletedAt=first(serverEvents,e=>e.event==='cv_completed',generateStartedAt??-Infinity);
    const coreTimes=[cvReadyAt,jobsSeenAt,jobOpenedAt,analysisReadAt,generateStartedAt,cvCompletedAt];
    let coreReached=0;while(coreReached<coreTimes.length&&coreTimes[coreReached]!=null)coreReached++;
    const d0=cvReadyAt==null?null:parisDayKey(cvReadyAt),d1=d0?plusDays(d0,1):null;
    const d1Eligible=Boolean(d0&&plusDays(d0,2)<=parisDayKey(now));
    const d1Returned=Boolean(d1Eligible&&events.some(e=>['page_enter','page_heartbeat'].includes(e.event)&&parisDayKey(e.timestamp)===d1));
    return {userId:store.userId,reached,coreReached,coreTimes,discarded:store.discarded||0,events,serverEvents,analysisReads:reads,loginAt,cvReadyAt,jobsSeenAt,jobOpenedAt,analysisReadAt,generateStartedAt,cvCompletedAt,d0,d1,d1Eligible,d1Returned,
      sessions:[...sessions].map(([sessionId,journey])=>({sessionId,startedAt:journey[0].timestamp,lastSeenAt:journey.at(-1).timestamp,pagePath:journey.filter(e=>e.event==='page_enter').map(e=>e.page),
        exitStep:[...journey].reverse().find(e=>e.step)?.step||null,lastPage:[...journey].reverse().find(e=>e.page)?.page||null,
        visibleDurationMs:journey.filter(e=>['page_exit','page_heartbeat'].includes(e.event)).reduce((n,e)=>n+(e.durationMs||0),0),maxScrollDepth:journey.reduce((m,e)=>Math.max(m,e.scrollDepth||0),0),
        exitObserved:[...journey].reverse().find(e=>['page_enter','page_exit','page_heartbeat'].includes(e.event))?.event==='page_exit',journey}))};
  });
  const all=users.flatMap(u=>u.events),serverEvents=retainedStores.flatMap(s=>s.events).filter(e=>e.source==='server');
  const loggedInUsers=users.filter(u=>u.loginAt!=null).length;
  const funnel=FUNNEL_STEPS.map((step,index)=>{const count=users.filter(u=>u.reached>index).length,previous=index?users.filter(u=>u.reached>=index).length:users.length;return {step,users:count,conversionFromPrevious:rate(count,previous),droppedAfter:users.filter(u=>u.reached===index+1&&index<FUNNEL_STEPS.length-1).length};});
  const coreFunnel=CORE_FUNNEL_STEPS.map((step,index)=>{const count=users.filter(u=>u.coreReached>index).length,previous=index?users.filter(u=>u.coreReached>=index).length:loggedInUsers;return {step,users:count,conversionFromPrevious:rate(count,previous),rateOfLoggedIn:rate(count,loggedInUsers),droppedFromPrevious:Math.max(0,previous-count)};});
  const eligible=users.filter(u=>u.d1Eligible),returned=eligible.filter(u=>u.d1Returned);
  const pageIds=[...new Set(all.filter(e=>e.page).map(e=>e.page))];
  const aiWaits=Object.fromEntries(KINDS.map(kind=>[kind,waitSummary(all.filter(e=>e.event==='ai_wait'&&e.kind===kind))]));
  const serverAiTasks=Object.fromEntries(KINDS.map(kind=>[kind,serverSummary(serverEvents.filter(e=>e.event==='server_ai_task'&&e.kind===kind))]));
  const performanceDefs={cv_analysis:['analysis','analysis'],search:['search','search'],job_analysis:['evaluate','deep_match'],cv_generation:['cv','cv']};
  const aiPerformance=Object.fromEntries(Object.entries(performanceDefs).map(([name,[clientKind,taskKind]])=>{
    const client=waitSummary(all.filter(e=>e.event==='ai_wait'&&e.kind===clientKind));
    const server=serverSummary(serverEvents.filter(e=>e.event==='server_ai_task'&&(e.taskKind?e.taskKind===taskKind:e.kind===clientKind)));
    return [name,{clientP50Ms:client.p50Ms,clientP90Ms:client.p90Ms,abandonedRate:client.abandonedRate,failedRate:rate(client.failed,client.segments),serverP50Ms:server.p50Ms,serverP90Ms:server.p90Ms,failureRate:server.failureRate,clientSegments:client.segments,serverTasks:server.tasks}];
  }));
  const timeToValue=[
    ttv('login_to_cv_ready',users,u=>u.loginAt,u=>u.cvReadyAt),
    ttv('cv_ready_to_jobs_seen',users,u=>u.cvReadyAt,u=>u.jobsSeenAt),
    ttv('login_to_jobs_seen',users,u=>u.loginAt,u=>u.jobsSeenAt),
    ttv('login_to_first_job_opened',users,u=>u.loginAt,u=>u.jobOpenedAt),
    ttv('first_job_opened_to_analysis_read',users,u=>u.jobOpenedAt,u=>u.analysisReadAt),
  ];
  const decisions=serverEvents.filter(e=>e.event==='cv_decision'),accepted=decisions.filter(e=>e.decision==='accept'),rejected=decisions.filter(e=>e.decision==='reject'),rejectedWithReason=rejected.filter(e=>e.rejectionReasonProvided===true);
  const cvDecisions={total:decisions.length,accepted:accepted.length,rejected:rejected.length,rejectedWithReason:rejectedWithReason.length,rejectionReasonRate:rate(rejectedWithReason.length,rejected.length)};
  const overview={testUsers:users.length,loggedInUsers,cvReady:coreFunnel[0].users,jobsSeen:coreFunnel[1].users,jobOpened:coreFunnel[2].users,analysisRead:coreFunnel[3].users,cvGenerateStarted:coreFunnel[4].users,cvGenerateCompleted:coreFunnel[5].users,cvFailed:users.filter(u=>u.serverEvents.some(e=>e.event==='cv_failed')).length,cvAccepted:accepted.length,cvRejected:rejected.length,d1Returned:returned.length,d1Eligible:eligible.length,d1RetentionRate:rate(returned.length,eligible.length)};
  return {generatedAt:now,timeZone:'Europe/Paris',retentionMonths:RETENTION_MONTHS,retentionCutoffAt:analyticsRetentionCutoff(now),retentionTimeZone:'UTC',retentionDays:(now-analyticsRetentionCutoff(now))/86400000,measurement:'client_observed_visible_wait_segments',pageTaxonomy:CANONICAL_PAGES,
    coreFunnelDefinition:'CV Ready → Jobs Seen → Job Opened → Analysis Read → CV Generate Started → CV Generate Completed. Each later stage must occur after the prior stage for the same pseudonymous user.',
    analysisReadDefinition:'A pseudonymous user/job context qualifies after >=8 seconds of accumulated foreground job_match time or >=50% scroll. New clients send only an opaque hashed job context; legacy contextless data is grouped per session.',
    d1Definition:'Day 0 is the Europe/Paris calendar day of first cv_ready. D1 return requires page_enter or page_heartbeat on the next Paris day. D0 users enter the denominator only after that entire D1 calendar day has ended.',
    funnelDefinition:'Legacy ordered funnel retained for compatibility; missing prior steps are not inferred.',exitDefinition:'Last observed page/step; page_exit is best-effort and backgrounding is not proof of permanent abandonment.',
    users:users.length,sessions:users.reduce((n,u)=>n+u.sessions.length,0),events:all.length,discardedEvents:users.reduce((n,u)=>n+u.discarded,0),overview,cvDecisions,coreFunnel,d1Retention:{eligibleD0Users:eligible.length,d1ReturnedUsers:returned.length,rate:rate(returned.length,eligible.length)},timeToValue,funnel,serverAiTasks,aiWaits,aiPerformance,
    pages:pageIds.map(page=>({page,enters:all.filter(e=>e.page===page&&e.event==='page_enter').length,visibleDurationMs:all.filter(e=>e.page===page&&['page_exit','page_heartbeat'].includes(e.event)).reduce((n,e)=>n+e.durationMs,0),maxScrollDepth:all.filter(e=>e.page===page&&['scroll','page_heartbeat'].includes(e.event)).reduce((max,e)=>Math.max(max,e.scrollDepth||0),0)})),
    clicks:Object.entries(all.filter(e=>e.event==='click').reduce((counts,e)=>({...counts,[e.action]:(counts[e.action]||0)+1}),{})).map(([action,count])=>({action,count})),
    journeys:users.map(user=>({userId:user.userId,firstSeenAt:user.events[0]?.timestamp??user.serverEvents[0]?.timestamp??null,lastSeenAt:[...user.events,...user.serverEvents].reduce((m,e)=>Math.max(m,e.timestamp||0),0)||null,discarded:user.discarded,completedOrderedSteps:user.reached,coreFunnelCompleted:user.coreReached,
      cvReady:user.cvReadyAt!=null,jobsSeen:user.jobsSeenAt!=null,jobsOpened:user.events.filter(e=>e.event==='funnel'&&e.step==='open_job').length,analysisReadCount:user.analysisReads.length,cvGenerateStarted:user.generateStartedAt!=null,cvGenerated:user.cvCompletedAt!=null,cvFailed:user.serverEvents.some(e=>e.event==='cv_failed'),d0:user.d0,d1Eligible:user.d1Eligible,d1Returned:user.d1Returned,sessions:user.sessions})),
  };
}
export function readAllAnalytics(root,now=Date.now()) {
  const base=path.join(root,'.career-ops-web','analytics');
  if(!fs.existsSync(base)) return [];
  return fs.readdirSync(base,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^[a-f0-9]{64}$/.test(e.name)).map(e=>{
    const store=readJson(path.join(base,e.name,'events.json'),{userId:null,events:[],discarded:0});
    return {...store,events:store.events.filter(event=>event.timestamp>=analyticsRetentionCutoff(now))};
  });
}

export async function pruneAnalytics(root,now=Date.now(),force=false) {
  const base=path.join(root,'.career-ops-web','analytics');
  return withProfileLock(base,async()=>{
    const marker=path.join(base,'retention.json');
    if(!force && now-(readJson(marker,{at:0}).at||0)<3600000) return;
    for(const entry of fs.readdirSync(base,{withFileTypes:true})) {
      if(!entry.isDirectory() || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
      const dir=path.join(base,entry.name);
      await withProfileLock(dir,()=>{
        const file=path.join(dir,'events.json');
        const store=readJson(file);
        if(!store) return;
        const retained=store.events.filter(event=>event.timestamp>=analyticsRetentionCutoff(now));
        if(retained.length!==store.events.length) writeJson(file,{...store,events:retained,discarded:(store.discarded||0)+store.events.length-retained.length});
      });
    }
    writeJson(marker,{at:now});
  });
}
