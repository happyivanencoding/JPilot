import test from 'node:test';
import assert from 'node:assert/strict';
import { agentDockToolResult } from '../../src/lib/agentdock-result.mjs';
import { dashboardFor, hasRecordedFitScore } from '../../src/lib/mobile-domain.mjs';

test('an unscored saved offer is not a completed evaluation', () => {
  assert.equal(hasRecordedFitScore({score:null}),false);
  assert.equal(hasRecordedFitScore({}),false);
  assert.equal(hasRecordedFitScore({score:NaN}),false);
  assert.equal(hasRecordedFitScore({score:4.2}),true);
  assert.equal(hasRecordedFitScore({score:0}),true);
});

test('AgentDock preserves successful structured and text results', () => {
  assert.deepEqual(agentDockToolResult({structuredContent:{run_id:'one'}}),{run_id:'one'});
  assert.deepEqual(agentDockToolResult({content:[{type:'text',text:'{"run_id":"two"}'}]}),{run_id:'two'});
});
test('tool-level quota errors retain their actual cause', () => {
  assert.throws(() => agentDockToolResult({isError:true,content:[{type:'text',text:'{"error":"ACP concurrent prompt limit reached"}'}]}),/concurrent prompt limit/);
  assert.throws(() => agentDockToolResult({structuredContent:{error:{message:'Session is not ready'},code:'NOT_READY'}}),/NOT_READY.*Session is not ready/);
});
test('unstructured tool failures are not successful empty objects', () => {
  assert.throws(() => agentDockToolResult({isError:true,content:[{type:'text',text:'Agent offline'}]}),/Agent offline/);
  assert.throws(() => agentDockToolResult(null),/empty tool response/);
});
test('automatic acknowledgments do not inflate the employer response rate', () => {
  const d=dashboardFor([{status:'Candidature envoyée',replies:[{kind:'Accusé auto',text:'Received'}]}]);
  assert.equal(d.sent,1); assert.equal(d.replied,0); assert.equal(d.responseRate,0);
});
test('archiving preserves previously applied stage and past real replies', () => {
  const d=dashboardFor([{status:'Archivée',statusHistory:[{from:'Candidature envoyée',status:'Réponse reçue'},{from:'Réponse reçue',status:'Archivée'}]}]);
  assert.equal(d.sent,1); assert.equal(d.replied,1);
});
