import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readJson, writeJson, withProfileLock } from './mobile-state.mjs';
import { previewToken, readPreviewSession } from './v1-session.mjs';

export const FUNNEL_STEPS = ['login','upload_cv','choose_direction','view_jobs','open_job','view_cv','generate_cv','tracking'];
export const RETENTION_MS = 30 * 86400000;
export const MAX_EVENTS = 20000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-z][a-z0-9_-]{0,63}$/;
const EVENTS = ['page_enter','page_exit','page_heartbeat','click','scroll','funnel','ai_wait'];
const KINDS = ['analysis','search','evaluate','cv'];
const FIELDS = new Set(['id','sessionId','event','page','action','step','durationMs','scrollDepth','kind','status','timestamp']);
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
      event[key] = value[key];
    }
    if (value.step !== undefined) { if (!FUNNEL_STEPS.includes(value.step)) fail('Invalid funnel step.'); event.step=value.step; }
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
    if (!Number.isSafeInteger(timestamp) || timestamp < now-RETENTION_MS || timestamp > now+300000) fail('Invalid analytics timestamp.');
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
    const retained=store.events.filter(event=>event.timestamp>=now-RETENTION_MS);
    const identity=event=>(event.source==='server'?'server:':'client:')+event.id;
    const ids=new Set(retained.map(identity));
    const added=[];
    for(const event of incoming) if(!ids.has(identity(event))) { ids.add(identity(event)); added.push(event); }
    const all=[...retained,...added];
    const discarded=(store.discarded||0)+store.events.length-retained.length+Math.max(0,all.length-MAX_EVENTS);
    writeJson(file,{userId:store.userId,discarded,events:all.slice(-MAX_EVENTS)});
    return {accepted:added.length,duplicates:incoming.length-added.length};
  });
}
// Called only at the live backend task terminal persistence boundary. Never backfills history.
export async function recordServerAiTask(root,task,finishedAt=Date.now()) {
  try {
    const kind=task.kind==='deep_match'?'evaluate':task.kind==='cv_review'?'cv':task.kind;
    if(!KINDS.includes(kind)||!UUID.test(task.id)||!['completed','failed'].includes(task.status)) return {recorded:false};
    const createdAt=Date.parse(task.createdAt);
    if(!Number.isFinite(createdAt)||!Number.isFinite(finishedAt)||finishedAt<createdAt) return {recorded:false};
    const result=await persistAnalytics(root,task.profileId,[{
      id:task.id.toLowerCase(),event:'server_ai_task',source:'server',kind,status:task.status,
      durationMs:Math.round(finishedAt-createdAt),createdAt,finishedAt,timestamp:finishedAt,receivedAt:Date.now(),
    }],finishedAt);
    return {recorded:result.accepted>0};
  } catch { return {recorded:false}; } // Telemetry must never fail a business task.
}
export function readProfileAnalytics(root,profileId,now=Date.now()) {
  const store=readJson(path.join(directory(root,profileId),'events.json'),{userId:null,events:[],discarded:0});
  return {...store,events:store.events.filter(event=>event.timestamp>=now-RETENTION_MS)};
}
const percentile=(values,p)=>values.length ? [...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)] : null;
export function analyticsReport(stores,now=Date.now()) {
  const users=stores.filter(store=>store.events.length).map(store=>{
    const events=store.events.filter(e=>e.timestamp>=now-RETENTION_MS&&e.source!=='server').sort((a,b)=>a.timestamp-b.timestamp);
    let reached=0;
    for(const event of events) if(event.event==='funnel' && event.step===FUNNEL_STEPS[reached]) reached++;
    const sessions=new Map();
    for(const event of events) {
      if(!sessions.has(event.sessionId)) sessions.set(event.sessionId,[]);
      sessions.get(event.sessionId).push(event);
    }
    return {userId:store.userId,reached,discarded:store.discarded||0,events,
      sessions:[...sessions].map(([sessionId,journey])=>({sessionId,startedAt:journey[0].timestamp,lastSeenAt:journey.at(-1).timestamp,
        exitStep:[...journey].reverse().find(e=>e.step)?.step||null,
        lastPage:[...journey].reverse().find(e=>e.page)?.page||null,
        exitObserved:[...journey].reverse().find(e=>['page_enter','page_exit','page_heartbeat'].includes(e.event))?.event==='page_exit',journey}))};
  }).filter(user=>user.events.length);
  const all=users.flatMap(u=>u.events);
  const funnel=FUNNEL_STEPS.map((step,index)=>{
    const count=users.filter(u=>u.reached>index).length;
    const previous=index ? users.filter(u=>u.reached>=index).length : users.length;
    return {step,users:count,conversionFromPrevious:previous?count/previous:null,
      droppedAfter:users.filter(u=>u.reached===index+1 && index<FUNNEL_STEPS.length-1).length};
  });
  const pageIds=[...new Set(all.filter(e=>e.page).map(e=>e.page))];
  return {generatedAt:now,retentionDays:30,measurement:'client_observed_visible_wait_segments',
    funnelDefinition:'Ordered first-completion per pseudonymous user across sessions within retained data. Missing prior steps are not inferred.',
    exitDefinition:'Last observed page/step; page_exit is best-effort and backgrounding is not proof of permanent abandonment.',
    users:users.length,sessions:users.reduce((n,u)=>n+u.sessions.length,0),events:all.length,
    discardedEvents:users.reduce((n,u)=>n+u.discarded,0),funnel,
    serverAiTasks:Object.fromEntries(KINDS.map(kind=>{
      const tasks=stores.flatMap(store=>store.events).filter(e=>e.timestamp>=now-RETENTION_MS&&e.source==='server'&&e.event==='server_ai_task'&&e.kind===kind);
      return [kind,{tasks:tasks.length,completed:tasks.filter(e=>e.status==='completed').length,failed:tasks.filter(e=>e.status==='failed').length,
        p50Ms:percentile(tasks.map(e=>e.durationMs),.5),p90Ms:percentile(tasks.map(e=>e.durationMs),.9),
        measurement:'server_task_created_to_terminal_ms_including_queue_and_non_model_work'}];
    })),
    aiWaits:Object.fromEntries(KINDS.map(kind=>{
      const waits=all.filter(e=>e.event==='ai_wait'&&e.kind===kind);
      return [kind,{segments:waits.length,p50Ms:percentile(waits.map(e=>e.durationMs),.5),p90Ms:percentile(waits.map(e=>e.durationMs),.9),
        completed:waits.filter(e=>e.status==='completed').length,failed:waits.filter(e=>e.status==='failed').length,
        abandoned:waits.filter(e=>e.status==='abandoned').length,
        abandonedP50Ms:percentile(waits.filter(e=>e.status==='abandoned').map(e=>e.durationMs),.5),
        abandonedP90Ms:percentile(waits.filter(e=>e.status==='abandoned').map(e=>e.durationMs),.9),
        abandonedBuckets:[5000,15000,30000,60000,120000,Infinity].map((ceiling,i,bounds)=>({upToMs:Number.isFinite(ceiling)?ceiling:null,count:waits.filter(e=>e.status==='abandoned'&&e.durationMs<ceiling&&e.durationMs>=(i?bounds[i-1]:0)).length}))}];
    })),
    pages:pageIds.map(page=>({page,enters:all.filter(e=>e.page===page&&e.event==='page_enter').length,
      visibleDurationMs:all.filter(e=>e.page===page&&['page_exit','page_heartbeat'].includes(e.event)).reduce((n,e)=>n+e.durationMs,0),
      maxScrollDepth:all.filter(e=>e.page===page&&['scroll','page_heartbeat'].includes(e.event)).reduce((max,e)=>Math.max(max,e.scrollDepth||0),0)})),
    clicks:Object.entries(all.filter(e=>e.event==='click').reduce((counts,e)=>({...counts,[e.action]:(counts[e.action]||0)+1}),{})).map(([action,count])=>({action,count})),
    journeys:users.map(({events,reached,...user})=>({...user,completedOrderedSteps:reached})),
  };
}
export function readAllAnalytics(root,now=Date.now()) {
  const base=path.join(root,'.career-ops-web','analytics');
  if(!fs.existsSync(base)) return [];
  return fs.readdirSync(base,{withFileTypes:true}).filter(e=>e.isDirectory()&&/^[a-f0-9]{64}$/.test(e.name)).map(e=>{
    const store=readJson(path.join(base,e.name,'events.json'),{userId:null,events:[],discarded:0});
    return {...store,events:store.events.filter(event=>event.timestamp>=now-RETENTION_MS)};
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
        const retained=store.events.filter(event=>event.timestamp>=now-RETENTION_MS).slice(-MAX_EVENTS);
        if(retained.length!==store.events.length) writeJson(file,{...store,events:retained,discarded:(store.discarded||0)+store.events.length-retained.length});
      });
    }
    writeJson(marker,{at:now});
  });
}
