import fs from "node:fs";
import { activeProfileId } from "@/lib/profile-request";
import { originalUploadedCv, renderCvPreview } from "@/lib/mobile-history";
import {localizeDisplay} from "@/lib/display-localization";
import {requestUiLocale,publicError} from "@/lib/language-contract.mjs";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=90;
export async function GET(req:Request) {
  try {
    const url=new URL(req.url);
    const profileId=await activeProfileId(url.searchParams.get("profileId"));
    const draftId=url.searchParams.get("draftId") || undefined,versionId=url.searchParams.get("versionId") || undefined;
    const wantsOriginal=url.searchParams.get("original")==="1"&&!draftId;
    if(wantsOriginal) {
      const source=originalUploadedCv(profileId,versionId);
      if(source) {
        if(url.searchParams.get("format")==="meta") return Response.json({exactOriginal:true,original:{filename:source.filename,mime:source.mime,extension:source.extension},versionId:source.requestedVersionId},{headers:{"Cache-Control":"no-store"}});
        const mode=url.searchParams.get("download")==="1"?"attachment":"inline";
        return new Response(new Uint8Array(fs.readFileSync(source.file)),{headers:{"Content-Type":source.mime,"Content-Disposition":`${mode}; filename*=UTF-8''${encodeURIComponent(source.filename)}`,"Cache-Control":"no-store","X-CV-Original":"exact"}});
      }
    }
    const rendered=await renderCvPreview(profileId,draftId,versionId);
    if(url.searchParams.get("format")==="meta") return Response.json(await localizeDisplay(profileId,requestUiLocale(req),{...rendered,pdf:undefined,...(wantsOriginal?{exactOriginal:false}: {})},"meta",{retry:url.searchParams.get("retryLocalization")==="1"}),{headers:{"Cache-Control":"no-store"}});
    return new Response(new Uint8Array(fs.readFileSync(rendered.pdf)),{headers:{"Content-Type":"application/pdf",...(url.searchParams.get("download")==="1"?{"Content-Disposition":"attachment; filename=Onward-CV.pdf"}:{}),"Cache-Control":"no-store","X-CV-Pages":String(rendered.pages),...(wantsOriginal?{"X-CV-Original":"rendered-fallback"}: {})}});
  } catch(error) {return Response.json({error:publicError(error,requestUiLocale(req))},{status:400});}
}
