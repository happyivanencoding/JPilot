import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAnalysisResult} from '../src/lib/analysis-result.mjs';
import {finalAnswerFromRollout} from '../src/lib/ai-metrics.mjs';
import {cvBlocks,compileGlobalPlan} from '../src/lib/cv-global-plan.mjs';
test('complete syntax error is repaired locally; summary-only and cut-off output are rejected',()=>{
 const raw='{"markdown":"Analysis","globalPlan":{"targetBlocks":[],"allocations":[{"reason":"Keep",\"}],"expressionIssues":[],"actionIssues":[]}}';
 const r=parseAnalysisResult(raw);assert.equal(r.formatRepair,'local-json-syntax');assert(Array.isArray(r.actionIssues));
 assert.throws(()=>parseAnalysisResult('{"markdown":"Only a summary"}'),/plan global/);
 assert.throws(()=>parseAnalysisResult('{"markdown":"cut off'),/incomplète/);
});
test('only the exact task session final response is recovered, never commentary or another session',()=>{
 const rows=[{type:'session_meta',payload:{id:'one'}},{type:'response_item',payload:{type:'message',role:'assistant',phase:'commentary',content:[{type:'output_text',text:'planning'}]}},{type:'response_item',payload:{type:'message',role:'assistant',phase:'final_answer',content:[{type:'output_text',text:'COMPLETE'}]}}].map(JSON.stringify).join('\n');
 assert.equal(finalAnswerFromRollout(rows,'one'),'COMPLETE');assert.equal(finalAnswerFromRollout(rows,'two'),null);
});
test('global presentation cannot upgrade or hide an explicit French level',()=>{
 const cv='# TEST — FICTIONAL\n\nFrench: B1 · English: C1\n';
 const p={audience:'junior',signals:[{title:'Education'},{title:'Languages'}],targetBlocks:cvBlocks(cv).map(b=>({sourceIds:[b.id],action:'keep'}))};
 Object.assign(p.targetBlocks.at(-1),{action:'rewrite',text:'French: C1 · English: C1'});
 assert.throws(()=>compileGlobalPlan(p,cv),/niveau de langue/);
});
