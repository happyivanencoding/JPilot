import {load} from 'cheerio';
const clean=(v,n=500)=>String(v??'').trim().replace(/\s+/g,' ').slice(0,n);

export async function searchJooble(input,options={}) {
  const base={id:'jooble',label:'Jooble',status:'unconfigured',latencyMs:0,rawCount:0,apiCalls:0,estimatedCostUsd:0,offers:[]};
  const apiKey=options.apiKey||process.env.JOBPILOT_JOOBLE_API_KEY;
  if(!apiKey)return base;
  if(input.countryCode&&input.countryCode!=='fr')return {...base,status:'disabled'};
  const queries=(input.franceTravailQueries?.length?input.franceTravailQueries:input.queries).slice(0,2),started=Date.now();
  const fetchImpl=options.fetchImpl||fetch;
  const results=await Promise.allSettled(queries.map(async keywords=>{
    let response;try{response=await fetchImpl(`https://fr.jooble.org/api/${encodeURIComponent(apiKey)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keywords,location:input.city||'France',page:'1'}),signal:AbortSignal.timeout(12_000),
    });}catch{throw new Error('Jooble request failed');}
    if(!response.ok)throw new Error(`Jooble HTTP ${response.status}`);
    let data;try{data=await response.json();}catch{throw new Error('Invalid Jooble response');}
    if(!Array.isArray(data.jobs))throw new Error('Invalid Jooble response');
    return data.jobs.slice(0,50);
  }));
  const successful=results.filter(r=>r.status==='fulfilled'),failures=results.filter(r=>r.status==='rejected').map(r=>r.reason.message);
  if(!successful.length)throw new Error(failures[0]||'Jooble request failed');
  const offers=successful.flatMap(r=>r.value).flatMap(job=>{
    const url=clean(job.link,2000),title=clean(job.title,300),company=clean(job.company,300);
    if(!/^https?:\/\//i.test(url)||!title||!company)return [];
    const titleContract=/\b(?:alternan\w*|apprenti\w*|apprenticeship)\b/i.test(title)?'Alternance':/\b(?:stage|stagiaire|internship|intern)\b/i.test(title)?'Stage':null;
    return [{url,title,company,location:clean(job.location,300),country:'France',
      description:clean(load(String(job.snippet||'')).text(),12000),
      contractType:titleContract || (/^(stage|internship)$/i.test(job.type)?'Stage':/^(cdi|permanent)$/i.test(job.type)?'CDI':'unknown'),
      postedAt:job.updated&&Number.isFinite(Date.parse(job.updated))?new Date(job.updated).toISOString():null,
      source:'jooble',sourceLabel:clean(job.source?`Jooble · ${job.source}`:'Jooble',160),direct:false,
      providerJobId:clean(job.id,100),verification:'unconfirmed'}];
  });
  return {...base,status:failures.length?'partial':'ok',offers,rawCount:offers.length,apiCalls:queries.length,latencyMs:Date.now()-started,failures};
}
