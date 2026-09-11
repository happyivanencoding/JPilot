"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {usePilot,type Json} from './pilot-context';
import {Button,Hint} from './ui';

type NoticeLocale='en'|'fr'|'zh';
const languages=[['en','English'],['fr','Français'],['zh','中文']] as const;

export function CvPrivacyDialog({onClose,onAccepted}:{onClose:()=>void;onAccepted?:()=>void}) {
 const p=usePilot();
 // The notice always opens in English, independently of the app/insights language.
 const [locale,setLocale]=useState<NoticeLocale>('en');
 const tr=(zh:string,fr:string,en:string)=>locale==='zh'?zh:locale==='fr'?fr:en;
 const [data,setData]=useState<Json|null>(null),[error,setError]=useState(''),[ack,setAck]=useState(false),[working,setWorking]=useState(false),[confirm,setConfirm]=useState(false);
 const body=useRef<HTMLDivElement>(null);
 useEffect(()=>{body.current?.scrollTo({top:0});},[locale]);
 useEffect(()=>{let live=true;void p.request('/api/v1/privacy').then(x=>{if(live)setData(x);}).catch(e=>{if(live)setError(String(e.message));});return()=>{live=false;};},[p.profileId]);
 const submit=async(action:string)=>{
  setWorking(true);setError('');
  try {
   const result=await p.request('/api/v1/privacy',{method:'POST',body:JSON.stringify({action,version:data?.notice?.version,acknowledged:ack,noticeLocale:locale})});
   setData(old=>({...old,record:result.record}));
   if(action==='accept'){onClose();onAccepted?.();}
  } catch(e){setError(e instanceof Error?e.message:String(e));}finally{setWorking(false);}
 };
 return createPortal(<div className="jp-privacy-overlay"><section role="dialog" aria-modal="true" aria-labelledby="cv-privacy-title" className="jp-privacy-document" data-testid="cv-privacy-dialog" lang={locale}>
  <h2 id="cv-privacy-title">{data?.notice?.title[locale]||tr('测试阶段简历信息使用说明','Notice relative aux CV — phase de test','CV information notice — testing phase')}</h2>
  <Hint>Onward · V1 · {data?.notice?.version||'…'}</Hint>
  <div className="jp-segmented" role="tablist" aria-label="Notice language">
   {languages.map(([code,label])=><button key={code} id={`privacy-language-${code}`} type="button" role="tab" aria-selected={locale===code} aria-controls="privacy-language-panel" data-testid={`privacy-language-${code}`} className={locale===code?'selected':''} disabled={working} onClick={()=>setLocale(code)}>{label}</button>)}
  </div>
  <div ref={body} className="jp-privacy-body" id="privacy-language-panel" role="tabpanel" aria-labelledby={`privacy-language-${locale}`}>
   {data?.notice?.sections.map((s:Json,i:number)=><section key={i}><h3>{i+1}. {s.title[locale]}</h3><p>{s.body[locale]}</p></section>)}
   {data?.recipients&&<Hint>{tr('AI 分析接口：','Interface IA : ','AI analysis endpoint: ')}{data.recipients.analysis}<br/>{tr('翻译接口：','Traduction : ','Translation endpoint: ')}{data.recipients.translation}</Hint>}
  </div>
  {error&&<p className="jp-error" role="alert">{error}</p>}
  {data?.record?.withdrawnAt?<Hint>{tr('撤回及删除申请已登记，等待管理员处理；新上传和 AI 任务已停止。','Retrait et suppression enregistrés, en attente de traitement. Nouveaux envois et tâches IA bloqués.','Withdrawal and deletion request recorded, pending administrator action. New uploads and AI tasks are blocked.')}</Hint>:onAccepted?<>
   <label className="jp-privacy-ack"><input type="checkbox" data-testid="privacy-ack" checked={ack} disabled={!data||working} onChange={e=>setAck(e.target.checked)}/><span>{data?.notice?.ack[locale]}</span></label>
   <Button disabled={!ack||!data||working} data-testid="privacy-accept" onClick={()=>void submit('accept')}>{tr('同意并选择简历','Accepter et choisir le CV','Accept and choose CV')}</Button>
  </>:data&&(data.record?.acceptedAt||String(p.data.cv||'').trim())?<>
   {confirm?<><Hint>{tr('新上传和 AI 任务将停止。删除请求将由管理员处理，不会立即删除。','Les nouveaux envois et tâches IA seront bloqués. La suppression nécessite un traitement par l’administrateur.','New uploads and AI tasks will stop. Deletion requires administrator action and is not immediate.')}</Hint><Button disabled={working} data-testid="privacy-withdraw-confirm" onClick={()=>void submit('withdraw')}>{tr('确认撤回','Confirmer','Confirm withdrawal')}</Button><Button kind="text" onClick={()=>setConfirm(false)}>{tr('取消','Annuler','Cancel')}</Button></>:<Button kind="text" onClick={()=>setConfirm(true)}>{data.record?.acceptedAt?tr('撤回同意并请求删除资料','Retirer l’accord et demander la suppression','Withdraw consent and request deletion'):tr('请求删除我的资料','Demander la suppression de mes données','Request deletion of my data')}</Button>}
  </>:null}
  <Button kind="text" disabled={working} onClick={onClose}>{tr('关闭','Fermer','Close')}</Button>
 </section></div>,document.body);
}
