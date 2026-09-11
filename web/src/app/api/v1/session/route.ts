import {NextResponse} from 'next/server';
import {workspaceRoot} from '@/lib/backend/workspace';
import {createPreviewSession, normalizePreviewEmail, readPreviewSession, revokePreviewSession, previewToken, PREVIEW_COOKIE} from '@/lib/v1-session.mjs';
import {requestUiLocale} from '@/lib/language-contract.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const enabled=()=>process.env.JOBPILOT_V1_PREVIEW==='1';
export async function GET(req:Request) {
  if(!enabled()) return NextResponse.json({error:'Not found'},{status:404});
  const session=readPreviewSession(workspaceRoot(),previewToken(req.headers));
  return NextResponse.json({authenticated:!!session,profileId:session?.profileId || '',email:session?.email || ''},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request) {
  if(!enabled()) return NextResponse.json({error:'Not found'},{status:404});
  const body=await req.json();
  const token=previewToken(req.headers);
  if(body.action==='logout') {
    revokePreviewSession(workspaceRoot(),token);
    const response=NextResponse.json({ok:true});
    response.cookies.set(PREVIEW_COOKIE,'',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0});
    response.cookies.set('career-ops-profile','',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0});
    return response;
  }
  if(body.action!=='login') return NextResponse.json({error:'Unknown action.'},{status:400});
  let email:string;
  try { email=normalizePreviewEmail(body.email); }
  catch {
    const locale=requestUiLocale(req);
    return NextResponse.json({error:locale==='zh'?'请输入有效的邮箱地址。':locale==='fr'?'Saisissez une adresse e-mail valide.':'Enter a valid email address.'},{status:400});
  }
  const session=await createPreviewSession(workspaceRoot(),email);
  revokePreviewSession(workspaceRoot(),token);
  const response=NextResponse.json(session,{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(PREVIEW_COOKIE,session.token,{httpOnly:true,sameSite:'lax',secure:new URL(req.url).protocol==='https:',path:'/',maxAge:30*86400});
  response.cookies.set('career-ops-profile',session.profileId,{httpOnly:true,sameSite:'lax',path:'/',maxAge:30*86400});
  return response;
}
