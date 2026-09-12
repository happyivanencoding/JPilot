import {NextResponse} from 'next/server';
import {workspaceRoot} from '@/lib/backend/workspace';
import {createPreviewSession,readPreviewSession,revokePreviewSession,previewToken,PREVIEW_COOKIE} from '@/lib/v1-session.mjs';
import {V1_GATE_COOKIE as GATE_COOKIE,issueGate,readGate,consumeGate,revokeGate,recordAuthAttempt,verifyGoogleCredential} from '@/lib/v1-auth.mjs';
import {requestUiLocale} from '@/lib/language-contract.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const enabled=()=>process.env.JOBPILOT_V1_PREVIEW==='1';
const gateToken=(req:Request)=>(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(GATE_COOKIE+'='))?.slice(GATE_COOKIE.length+1)||'';
const cookieOptions=(req:Request)=>({httpOnly:true,sameSite:'lax' as const,secure:new URL(req.url).protocol==='https:',path:'/'});
export async function GET(req:Request) {
  if(!enabled())return NextResponse.json({error:'Not found'},{status:404});
  const session=readPreviewSession(workspaceRoot(),previewToken(req.headers));
  const gate=readGate(workspaceRoot(),gateToken(req));
  return NextResponse.json({authenticated:!!session,profileId:session?.profileId||'',email:session?.email||'',
    loginMode:gate?.mode||'',...(gate?.mode==='google'?{googleClientId:process.env.JOBPILOT_GOOGLE_CLIENT_ID||'',nonce:gate.nonce}:{})},
    {headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request) {
  if(!enabled())return NextResponse.json({error:'Not found'},{status:404});
  const root=workspaceRoot(),oldToken=previewToken(req.headers),ticket=gateToken(req),locale=requestUiLocale(req);
  const say=(zh:string,fr:string,en:string)=>locale==='zh'?zh:locale==='fr'?fr:en;
  const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
  let body:any;try{const raw=await req.text();if(raw.length>20000)return fail('Request too large',413);body=JSON.parse(raw);}catch{return fail('Invalid request');}
  if(body.action==='logout') {
    revokePreviewSession(root,oldToken);revokeGate(root,ticket);
    const response=NextResponse.json({ok:true});
    for(const name of [PREVIEW_COOKIE,GATE_COOKIE,'career-ops-profile'])response.cookies.set(name,'',{...cookieOptions(req),maxAge:0});
    return response;
  }
  if(!['verifyCode','login','google'].includes(body.action))return fail('Unknown action.');
  const attempt=await recordAuthAttempt(root,`${body.action}:${req.headers.get('cf-connecting-ip')||'local'}`,{limit:30});
  if(!attempt.allowed)return fail(say('尝试次数过多，请稍后再试。','Trop de tentatives. Réessayez plus tard.','Too many attempts. Try again later.'),429);
  if(body.action==='verifyCode') {
    revokeGate(root,ticket);
    try {
      const gate=issueGate(root,body.code);
      const response=NextResponse.json({loginMode:gate.mode,...(gate.mode==='google'?{googleClientId:process.env.JOBPILOT_GOOGLE_CLIENT_ID||'',nonce:gate.nonce}:{})},{headers:{'Cache-Control':'no-store'}});
      response.cookies.set(GATE_COOKIE,gate.token,{...cookieOptions(req),maxAge:600});return response;
    }catch{return fail(say('测试码不正确。','Code de test incorrect.','Invalid test code.'),401);}
  }
  const gate=readGate(root,ticket);
  if(!gate)return fail(say('请先验证测试码。','Validez d’abord votre code de test.','Verify your test code first.'),403);
  try {
    let value:string,identity:any;
    if(body.action==='google'&&gate.mode==='google') {
      const google=await verifyGoogleCredential(body.credential,{clientId:process.env.JOBPILOT_GOOGLE_CLIENT_ID,nonce:gate.nonce});
      value=google.email;identity={mode:'google',sub:google.sub};
    }else if(body.action==='login'&&gate.mode==='admin') {
      value=String(body.id??body.email??'').normalize('NFKC').trim();
      if(!value||value.length>254||/[\u0000-\u001f]/.test(value))return fail(say('请输入非空测试 ID。','Saisissez un identifiant de test.','Enter a non-empty test ID.'));
      identity={mode:'admin'};
    }else return fail(say('请使用此测试码对应的登录方式。','Utilisez le mode de connexion prévu pour ce code.','Use the sign-in method for this code.'),403);
    if(!consumeGate(root,ticket))return fail(say('测试码验证已过期，请重试。','Validation expirée. Recommencez.','Code verification expired. Try again.'),403);
    const session=await createPreviewSession(root,value,identity);revokePreviewSession(root,oldToken);
    const response=NextResponse.json({authenticated:true,profileId:session.profileId,email:session.email,needsOnboarding:session.needsOnboarding},{headers:{'Cache-Control':'no-store'}});
    response.cookies.set(PREVIEW_COOKIE,session.token,{...cookieOptions(req),maxAge:30*86400});
    response.cookies.set('career-ops-profile',session.profileId,{...cookieOptions(req),maxAge:30*86400});
    response.cookies.set(GATE_COOKIE,'',{...cookieOptions(req),maxAge:0});return response;
  }catch{return fail(say('登录未完成，请重新验证测试码后重试。','Connexion non aboutie. Validez à nouveau votre code puis réessayez.','Sign-in failed. Verify your code again and retry.'),401);}
}
