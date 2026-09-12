import '../scripts/register-source-loader.mjs';
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeJson} from '../src/lib/mobile-state.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'onward-original-cv-'));
const previousRoot=process.env.CAREER_OPS_ROOT;
process.env.CAREER_OPS_ROOT=root;
after(()=>{if(previousRoot===undefined)delete process.env.CAREER_OPS_ROOT;else process.env.CAREER_OPS_ROOT=previousRoot;fs.rmSync(root,{recursive:true,force:true});});

const profile={id:'fixture',name:'Fixture',shortName:'Fixture',cvMarkdown:'data/cv.md',config:'data/profile.yml',notes:'data/notes.md',candidatures:'data/candidatures.json'};
fs.mkdirSync(path.join(root,'data'),{recursive:true});
writeJson(path.join(root,'data/profiles.json'),{version:1,defaultProfileId:'fixture',profiles:[profile]});
fs.writeFileSync(path.join(root,profile.cvMarkdown),'Original extracted text','utf8');
fs.writeFileSync(path.join(root,profile.config),'candidate: {}\ncv:\n  language: en\n','utf8');
fs.writeFileSync(path.join(root,profile.notes),'','utf8');
writeJson(path.join(root,profile.candidatures),{version:1,jobs:[],updatedAt:new Date().toISOString()});

const history=await import('../src/lib/mobile-history.ts');

function recordUpload(version,filename,bytes,extension='.pdf') {
  const dir=path.join(history.historyDirectory('fixture'),'uploads',`cv-${randomUUID()}`);
  fs.mkdirSync(dir,{recursive:true});
  const source=path.join(dir,'source'+extension);
  fs.writeFileSync(source,bytes);
  const id=randomUUID(),now=new Date().toISOString();
  writeJson(path.join(history.historyDirectory('fixture'),'tasks',id+'.json'),{id,profileId:'fixture',kind:'ingest',status:'completed',createdAt:now,updatedAt:now,input:{filename},uploadSource:source,result:{imported:true,versionId:version.id,cvVersion:version.cvVersion,filename}});
  return source;
}

test('original CV resolves to the exact uploaded bytes and survives later processing',()=>{
  const uploaded=Buffer.from('%PDF-1.4\nEXACT ORIGINAL BYTES\n%%EOF');
  const v1=history.currentCandidateVersion('fixture');
  const source1=recordUpload(v1,'CV original 李若晴.pdf',uploaded);
  let original=history.originalUploadedCv('fixture');
  assert.equal(original.file,source1);
  assert.equal(original.filename,'CV original 李若晴.pdf');
  assert.equal(original.mime,'application/pdf');
  assert.deepEqual(fs.readFileSync(original.file),uploaded);

  fs.writeFileSync(path.join(root,profile.cvMarkdown),'Processed canonical text for matching and generation','utf8');
  const processed=history.currentCandidateVersion('fixture');
  assert.notEqual(processed.id,v1.id);
  original=history.originalUploadedCv('fixture',processed.id);
  assert.equal(original.file,source1,'processing the canonical CV must not replace the uploaded original');
  assert.deepEqual(fs.readFileSync(original.file),uploaded);
});

test('a later upload becomes the new original for later derived versions',()=>{
  fs.writeFileSync(path.join(root,profile.cvMarkdown),'Second uploaded extracted text','utf8');
  const uploadedVersion=history.currentCandidateVersion('fixture');
  const second=Buffer.from('%PDF-1.4\nSECOND ORIGINAL FILE\n%%EOF');
  const source2=recordUpload(uploadedVersion,'second.pdf',second);
  fs.writeFileSync(path.join(root,profile.notes),'processed notes after second upload','utf8');
  const derived=history.currentCandidateVersion('fixture');
  const original=history.originalUploadedCv('fixture',derived.id);
  assert.equal(original.file,source2);
  assert.deepEqual(fs.readFileSync(original.file),second);
});

test('non-PDF uploads keep their exact file type instead of being presented as PDF',()=>{
  fs.writeFileSync(path.join(root,profile.cvMarkdown),'DOCX extracted text','utf8');
  const version=history.currentCandidateVersion('fixture');
  const docx=Buffer.from('PK\u0003\u0004fixture-docx-bytes');
  const source=recordUpload(version,'resume.docx',docx,'.docx');
  const original=history.originalUploadedCv('fixture',version.id);
  assert.equal(original.file,source);
  assert.equal(original.extension,'.docx');
  assert.equal(original.mime,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.deepEqual(fs.readFileSync(original.file),docx);
});
