import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { searchJobIndex } from '../../src/lib/job-search/providers/job-index.mjs';
import { searchStructuredOffers } from '../../src/lib/job-search/index.mjs';

function fixtureDb() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'onward-index-'));
  const file=path.join(dir,'jobs.sqlite');
  const db=new DatabaseSync(file);
  db.exec(`
    create table jobs(id text primary key,title text not null,company text,location text,city text,region text,country text,published_at text,updated_at text,contract_types text,employment_raw text,work_time text,remote integer,is_paris integer,is_ile_de_france integer,is_stage integer,is_alternance integer,is_cdi integer,is_cdd integer,is_interim integer,industry_group text,industry_label text,department text,role_category text,url text not null,apply_url text,canonical_url text,description text,providers text,active integer);
    create table index_meta(key text primary key,value text not null);
    create virtual table jobs_fts using fts5(title,company,location,description,content='jobs',content_rowid='rowid');
    create trigger jobs_ai after insert on jobs begin insert into jobs_fts(rowid,title,company,location,description) values(new.rowid,new.title,new.company,new.location,new.description); end;
  `);
  const insert=db.prepare(`insert into jobs values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const now=new Date().toISOString();
  for(let i=0;i<30;i++) insert.run(`s${i}`,`Stage Quantitative Risk Analyst ${i}`,'Example Bank','Paris, France','Paris','Île-de-France','France',now,now,JSON.stringify(i===0?['Stage','Alternance']:['Stage']),'Stage','Full time',0,1,1,1,i===0?1:0,0,0,0,'Finance & insurance','Banking','Risk','Quant',`https://example.test/${i}`,`https://example.test/${i}`,`https://example.test/${i}`,`Python market risk quantitative finance ${i}`,JSON.stringify(['finance-official']),1);
  db.prepare('insert into index_meta values(?,?)').run('synced_at',now);
  db.prepare('insert into index_meta values(?,?)').run('active_jobs','30');
  db.close();
  return {dir,file};
}

test('job index preserves non-exclusive Stage + Alternance labels and searches locally', () => {
  const {dir,file}=fixtureDb();
  try {
    const result=searchJobIndex({query:'quant risk',queries:['quant risk'],targetRoles:['Quantitative Risk Analyst'],city:'Paris',country:'France',contractTypes:['Stage','Alternance']},{dbPath:file,limit:40});
    assert.equal(result.status,'ok');
    assert.equal(result.apiCalls,0);
    assert.equal(result.rawCount,30);
    assert.deepEqual(result.offers[0].contractTypes.includes('Stage'),true);
    assert.ok(result.offers.some(x=>x.contractTypes.includes('Stage')&&x.contractTypes.includes('Alternance')));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('structured search uses fresh sufficient index without invoking live providers', async () => {
  const {dir,file}=fixtureDb();
  try {
    const result=await searchStructuredOffers({query:'quant risk',targetRoles:['Quantitative Risk Analyst'],city:'Paris',country:'France',contractTypes:['Stage'],knownUrls:[]},{jobIndex:{dbPath:file},indexLimit:40,indexMinimumRaw:24,limit:12});
    assert.deepEqual(result.providerRuns.map(x=>x.id),['job-index']);
    assert.equal(result.providerRuns[0].apiCalls,0);
    assert.ok(result.offers.length>0);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
