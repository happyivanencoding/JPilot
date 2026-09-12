"use client";
import {useEffect,useRef,useState} from 'react';
import {usePilot} from './pilot-context';
import {Button,Hint} from './ui';

export function V1SignIn(){
  const {tr,locale}=usePilot();
  const [code,setCode]=useState(''),[id,setId]=useState(''),[gate,setGate]=useState<any>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const googleRoot=useRef<HTMLDivElement>(null);
  const post=async(body:Record<string,unknown>)=>{
    const response=await fetch('/api/v1/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept-Language':locale},body:JSON.stringify(body)});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Sign-in failed');return data;
  };
  const finish=async(body:Record<string,unknown>)=>{
    setBusy(true);setError('');
    try{
      await post(body);
      void fetch('/api/analytics',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({events:[{id:crypto.randomUUID(),sessionId:crypto.randomUUID(),timestamp:Date.now(),event:'funnel',page:'onboarding_email',step:'login'}]})}).catch(()=>{});
      window.location.replace('/');
    }
    catch(e){setError((e as Error).message);setGate(null);setBusy(false);}
  };
  useEffect(()=>{let alive=true;void fetch('/api/v1/session',{cache:'no-store',credentials:'same-origin'}).then(r=>r.json()).then(v=>{if(alive&&v.loginMode)setGate(v);}).catch(()=>{});return()=>{alive=false;};},[]);
  useEffect(()=>{
    if(gate?.loginMode!=='google'||!gate.googleClientId)return;
    let alive=true;
    const init=()=>{
      const google=(window as any).google;
      if(!alive||!googleRoot.current||!google?.accounts?.id)return;
      google.accounts.id.initialize({client_id:gate.googleClientId,nonce:gate.nonce,auto_select:false,use_fedcm_for_prompt:true,
        callback:(value:{credential:string})=>{if(alive)void finish({action:'google',credential:value.credential});}});
      googleRoot.current.replaceChildren();
      google.accounts.id.renderButton(googleRoot.current,{theme:'outline',size:'large',shape:'pill',text:'signin_with',width:280,locale});
    };
    let script=document.querySelector<HTMLScriptElement>('script[data-onward-google]');
    if(!script){script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.dataset.onwardGoogle='true';document.head.appendChild(script);}
    const failed=()=>{if(alive)setError(tr('Google 登录暂时无法加载，请刷新重试。','La connexion Google ne peut pas se charger. Actualisez la page.','Google sign-in could not load. Refresh to retry.'));};
    script.addEventListener('load',init);script.addEventListener('error',failed);init();
    return()=>{alive=false;script?.removeEventListener('load',init);script?.removeEventListener('error',failed);};
  },[gate,locale]);
  const verify=async()=>{setBusy(true);setError('');try{setGate(await post({action:'verifyCode',code}));setCode('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  return <section data-testid="v1-sign-in">
    {!gate?<><h1>{tr('欢迎参加 Onward 测试','Bienvenue au test Onward','Welcome to Onward testing')}</h1><Hint>{tr('输入收到的测试码，开始登录。','Saisissez votre code de test pour vous connecter.','Enter your test code to sign in.')}</Hint>
      <form onSubmit={e=>{e.preventDefault();if(code.trim()&&!busy)void verify();}}><label className="jp-field"><span>{tr('测试码','Code de test','Test code')}</span><input data-testid="preview-test-code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={128} value={code} onChange={e=>setCode(e.target.value)}/></label><Button type="submit" data-testid="preview-verify-code" disabled={busy||!code.trim()}>{tr('继续','Continuer','Continue')}</Button></form></>:
      gate.loginMode==='google'?<><h1>{tr('使用 Google 登录','Connectez-vous avec Google','Sign in with Google')}</h1><Hint>{tr('使用你的 Google 账号，保存并找回自己的空间。','Votre compte Google vous permet de retrouver votre espace.','Use your Google account to save and return to your space.')}</Hint>{gate.googleClientId?<div ref={googleRoot} data-testid="preview-google" style={{margin:'28px 0',pointerEvents:busy?'none':undefined}}/>:<p role="alert">{tr('Google 登录暂未配置。','La connexion Google n’est pas encore configurée.','Google sign-in is not configured yet.')}</p>}</>:
      <><h1>{tr('管理员测试登录','Connexion de test administrateur','Administrator test sign-in')}</h1><Hint>{tr('输入邮箱或任意测试 ID；相同 ID 可回到同一个测试空间。','Saisissez un e-mail ou un identifiant libre pour retrouver le même espace de test.','Enter an email or any test ID to return to the same test space.')}</Hint><form onSubmit={e=>{e.preventDefault();if(id.trim()&&!busy)void finish({action:'login',id});}}><label className="jp-field"><span>{tr('测试 ID','Identifiant de test','Test ID')}</span><input data-testid="preview-email" type="text" autoComplete="off" autoCapitalize="none" maxLength={254} value={id} onChange={e=>setId(e.target.value)}/></label><Button type="submit" data-testid="preview-login" disabled={busy||!id.trim()}>{tr('继续','Continuer','Continue')}</Button></form></>}
    {error&&<p role="alert">{error}</p>}
    {gate&&<Button kind="text" disabled={busy} onClick={()=>{setGate(null);setError('');}}>{tr('更换测试码','Changer de code','Use another code')}</Button>}
  </section>;
}
