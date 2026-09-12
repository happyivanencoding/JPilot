import path from 'node:path';
import notice from '../../shared/cv-privacy.json' with {type:'json'};
import {readJson,writeJson,withProfileLock} from './mobile-state.mjs';
export const CV_PRIVACY_VERSION=notice.version;
export const cvPrivacyNotice=notice;
const file=directory=>path.join(directory,'cv-privacy.json');
export const privacyRecord=directory=>readJson(file(directory)) || null;
export function assertCvConsent(directory) {
 const record=privacyRecord(directory);
 if(record?.withdrawnAt) throw new Error('Consent withdrawn. New CV uploads and AI tasks are stopped.');
 if(record?.version!==CV_PRIVACY_VERSION || !record?.acceptedAt)throw new Error('Please read and accept the CV information notice before uploading.');
 return record;
}
export function assertNotWithdrawn(directory) {
 if(privacyRecord(directory)?.withdrawnAt)throw new Error('Consent withdrawn. New CV uploads and AI tasks are stopped.');
}
export async function recordCvChoice(directory,{action,version,acknowledged,locale}) {
 return withProfileLock(directory,()=>{
  const previous=privacyRecord(directory) || {};
  if(action==='accept') {
   if(version!==CV_PRIVACY_VERSION || acknowledged!==true)throw new Error('Please read and accept the current CV information notice.');
   if(previous.withdrawnAt)throw new Error('Your withdrawal/deletion request is pending. Contact your test organizer.');
   const saved={...previous,version:CV_PRIVACY_VERSION,acceptedAt:new Date().toISOString(),locale:['zh','fr','en'].includes(locale)?locale:'en',acknowledged:true};
   writeJson(file(directory),saved);return saved;
  }
  if(action==='withdraw') {
   const now=new Date().toISOString();
   const saved={...previous,withdrawnAt:previous.withdrawnAt||now,deletionRequestedAt:previous.deletionRequestedAt||now,deletionStatus:'pending'};
   writeJson(file(directory),saved);return saved;
  }
  throw new Error('Unknown privacy action');
 });
}
export function privacyRecipients(env=process.env) {
 const host=value=>{try{return new URL(value).hostname;}catch{return 'unconfigured';}};
 const openai=host(env.JOBPILOT_OPENAI_CHAT_URL || 'https://api.openai.com/v1/chat/completions');
 return {analysis:openai,translation:openai};
}
