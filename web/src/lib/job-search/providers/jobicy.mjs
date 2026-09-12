import {load} from 'cheerio';

const ENDPOINT='https://jobicy.com/api/v2/remote-jobs?count=200';
const TTL=60*60*1000;
const clean=(v,n=500)=>String(v??'').trim().replace(/\s+/g,' ').slice(0,n);
const cache=new Map();

export async function searchJobicy(input,options={}) {
  const base={id:'jobicy',label:'Jobicy',status:'disabled',latencyMs:0,rawCount:0,apiCalls:0,estimatedCostUsd:0,offers:[]};
  if(options.enabled!==true)return base;
  const fetchImpl=options.fetchImpl||fetch,now=options.now??Date.now(),started=Date.now();
  let entry=cache.get(fetchImpl),cached=!!entry&&now<entry.expiresAt;
  if(!cached) {
    entry={expiresAt:now+TTL,promise:(async()=>{
      const response=await fetchImpl(ENDPOINT,{signal:AbortSignal.timeout(10_000)});
      if(!response.ok)throw new Error(`Jobicy HTTP ${response.status}`);
      const data=await response.json();
      if(!Array.isArray(data.jobs))throw new Error('Invalid Jobicy response');
      return data.jobs.slice(0,200);
    })()};
    cache.set(fetchImpl,entry);
  }
  // Cache failures too: simultaneous searches must not hammer an unavailable feed.
  const jobs=await entry.promise;
  const offers=jobs.flatMap(job=>{
    const url=clean(job.url,2000),title=clean(job.jobTitle,300),company=clean(job.companyName,300);
    if(!/^https:\/\/jobicy\.com\//i.test(url)||!title||!company)return [];
    const description=clean(load(String(job.jobDescription||job.jobExcerpt||'')).text(),12000);
    const types=Array.isArray(job.jobType)?job.jobType:[];
    const country=/^(france|fr)$/i.test(clean(job.jobGeo))?'France':'';
    return [{url,title,company,description,location:clean(job.jobGeo,300),country,
      contractType:types.includes('internship')?'Stage':'unknown',remote:true,
      postedAt:job.pubDate&&Number.isFinite(Date.parse(job.pubDate))?new Date(job.pubDate).toISOString():null,
      providerJobId:clean(job.id,100),source:'jobicy',sourceLabel:'Jobicy',requiresAttribution:true,
      direct:false,verification:'unconfirmed'}];
  });
  return {...base,status:'ok',offers,rawCount:offers.length,apiCalls:cached?0:1,cached,latencyMs:Date.now()-started};
}
