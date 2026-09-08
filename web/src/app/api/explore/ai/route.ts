import fs from "node:fs";
import * as yaml from "js-yaml";
import { activeProfileId } from "@/lib/profile-request";
import { profileFile } from "@/lib/profile-context";
import { searchRequestFromConfig } from "@/lib/job-search/mobile-context.mjs";
import { searchStructuredOffers, rankSearchResults } from "@/lib/job-search/index.mjs";
import { readCandidatureStore } from "@/lib/mobile-engine";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=90;

export async function POST(req:Request){
  let body:{query?:string};try{body=await req.json();}catch{return Response.json({error:"JSON invalide."},{status:400});}
  const query=String(body.query||"").trim();if(!query)return Response.json({error:"La recherche est vide."},{status:400});
  const profileId=await activeProfileId();
  let config:any={};try{config=yaml.load(fs.readFileSync(profileFile(profileId,"config"),"utf8"))||{};}catch{}
  const known=readCandidatureStore(profileId).jobs.map(j=>String(j.url||"")).filter(Boolean);
  const request=searchRequestFromConfig(query,config,known);
  const structured=await searchStructuredOffers(request,{trackedAts:{enabled:false},includeDevelopmentSource:false,limit:24});
  const ranked=rankSearchResults(request,(structured.providerRuns||[]).flatMap((r:any)=>r.offers||[]),structured.providerRuns||[],{limit:24});
  const lines=ranked.offers.map((o:any)=>`<<offer:${JSON.stringify({url:o.url,title:o.title,company:o.company,location:o.location,source:o.source,why:o.why,postedHint:o.postedAt||o.postedHint||"",description:o.description||"",direct:o.direct===true,ats:o.ats||"",contractType:o.contractType||"unknown",verification:"unconfirmed"})}>>`);
  return new Response(lines.join("\n")+(lines.length?"\n":""),{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store","X-JobPilot-Search":"structured-no-acp"}});
}
