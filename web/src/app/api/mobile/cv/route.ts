import fs from "node:fs";
import { activeProfileId } from "@/lib/profile-request";
import { renderCvPreview } from "@/lib/mobile-history";
import {localizeDisplay} from "@/lib/display-localization";
import {requestUiLocale,publicError} from "@/lib/language-contract.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=90;
export async function GET(req:Request) {
  try {
    const url=new URL(req.url);
    const profileId=await activeProfileId(url.searchParams.get("profileId"));
    const rendered=await renderCvPreview(profileId,url.searchParams.get("draftId") || undefined,url.searchParams.get("versionId") || undefined);
    if(url.searchParams.get("format")==="meta") return Response.json(await localizeDisplay(profileId,requestUiLocale(req),{...rendered,pdf:undefined},"meta",{retry:url.searchParams.get("retryLocalization")==="1"}),{headers:{"Cache-Control":"no-store"}});
    return new Response(new Uint8Array(fs.readFileSync(rendered.pdf)),{headers:{"Content-Type":"application/pdf","Content-Disposition":"inline; filename=JobPilot-CV.pdf","Cache-Control":"no-store","X-CV-Pages":String(rendered.pages)}});
  } catch(error) {return Response.json({error:publicError(error,requestUiLocale(req))},{status:400});}
}
