import { workspaceRoot } from "@/lib/backend/workspace";
import { authenticatedAnalyticsProfile, recordAnalytics, readProfileAnalytics, analyticsReport } from "@/lib/product-analytics.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "no-store" };
function errorResponse(error: unknown) {
  const status = Number((error as {status?: number})?.status) || 500;
  return Response.json({error: status === 500 ? "Analytics unavailable." : (error as Error).message},
    {status,headers:responseHeaders});
}
export async function POST(req: Request) {
  try {
    const root=workspaceRoot();
    const profileId=authenticatedAnalyticsProfile(root,req.headers);
    if (Number(req.headers.get("content-length") || 0)>32768)
      return Response.json({error:"Analytics batch too large."},{status:413,headers:responseHeaders});
    // Bound the stream even if the request omits Content-Length.
    const reader=req.body?.getReader();
    if(!reader) return Response.json({error:"Analytics body required."},{status:400,headers:responseHeaders});
    const chunks:Uint8Array[]=[]; let size=0;
    for(;;) {
      const {done,value}=await reader.read(); if(done) break;
      size+=value.byteLength;
      if(size>32768) { await reader.cancel(); return Response.json({error:"Analytics batch too large."},{status:413,headers:responseHeaders}); }
      chunks.push(value);
    }
    let body;
    try { body=JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return Response.json({error:"Invalid analytics JSON."},{status:400,headers:responseHeaders}); }
    return Response.json(await recordAnalytics(root,profileId,body),{headers:responseHeaders});
  } catch(error) { return errorResponse(error); }
}
export async function GET(req: Request) {
  try {
    const root=workspaceRoot();
    const profileId=authenticatedAnalyticsProfile(root,req.headers);
    return Response.json(analyticsReport([readProfileAnalytics(root,profileId)]),{headers:responseHeaders});
  } catch(error) { return errorResponse(error); }
}
