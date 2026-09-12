import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const workspaceRoot=()=>process.env.CAREER_OPS_ROOT?.trim()||path.resolve(process.cwd(),'..');
const clean=(value,max=4000)=>String(value??'').trim().slice(0,max);
function db(){
 const dir=path.join(workspaceRoot(),'.career-ops-web');fs.mkdirSync(dir,{recursive:true});
 const database=new DatabaseSync(path.join(dir,'v1-feedback.sqlite'));
 database.exec(`CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, kind TEXT NOT NULL,
  useful TEXT NOT NULL, distrust TEXT NOT NULL, next_step TEXT NOT NULL,
  reopen TEXT NOT NULL, alternative TEXT NOT NULL, willingness_to_pay TEXT NOT NULL,
  note TEXT NOT NULL, created_at TEXT NOT NULL
 )`);
 return database;
}
export function saveV1Feedback(profileId,input={}){
 const kind=['feedback','complaint','survey'].includes(input.kind)?input.kind:'feedback';
 const row={id:randomUUID(),profileId:clean(profileId,200),kind,useful:clean(input.useful),distrust:clean(input.distrust),nextStep:clean(input.nextStep),reopen:clean(input.reopen,200),alternative:clean(input.alternative),willingnessToPay:clean(input.willingnessToPay,500),note:clean(input.note),createdAt:new Date().toISOString()};
 const database=db();try{database.prepare('INSERT INTO feedback(id,profile_id,kind,useful,distrust,next_step,reopen,alternative,willingness_to_pay,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(row.id,row.profileId,row.kind,row.useful,row.distrust,row.nextStep,row.reopen,row.alternative,row.willingnessToPay,row.note,row.createdAt);}finally{database.close();}
 return row;
}
