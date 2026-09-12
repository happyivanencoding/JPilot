import fs from "node:fs";
import {timingSafeEqual} from "node:crypto";
import {workspaceRoot} from "@/lib/backend/workspace";
import {analyticsReport,readAllAnalytics} from "@/lib/product-analytics.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const responseHeaders={"Cache-Control":"no-store"};

function configuredSecret() {
  const direct=process.env.JOBPILOT_ANALYTICS_INTERNAL_SECRET?.trim();
  if(direct)return direct;
  const file=process.env.JOBPILOT_ANALYTICS_INTERNAL_SECRET_FILE?.trim();
  if(!file)return "";
  try{return fs.readFileSync(file,"utf8").trim();}catch{return "";}
}
function authorized(req:Request) {
  const secret=configuredSecret(),header=req.headers.get("authorization")||"";
  if(!secret||!header.startsWith("Bearer "))return false;
  const supplied=header.slice(7).trim(),a=Buffer.from(secret),b=Buffer.from(supplied);
  return a.length===b.length&&timingSafeEqual(a,b);
}
export async function GET(req:Request) {
  if(!authorized(req))return Response.json({error:"Not authorized."},{status:401,headers:responseHeaders});
  return Response.json({dashboardVersion:"v1",...analyticsReport(readAllAnalytics(workspaceRoot()))},{headers:responseHeaders});
}
