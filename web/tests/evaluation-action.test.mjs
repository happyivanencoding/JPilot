import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluationAction,evaluationSummary,retirePendingEvaluation} from '../src/lib/evaluation-action.mjs';
test('a completed Skip report retires pending-evaluation defaults and exposes its actual next action',()=>{
 const report={final_decision:'Skip',next_action:'Prioriser un programme compatible avec l’année de diplôme.'};
 const patch=retirePendingEvaluation({recommendation:'Évaluation officielle nécessaire',followup:{nextAction:'Évaluer la compatibilité avant de candidater',dueDate:'2026-10-01',note:'Keep this note'}},report);
 assert.equal(patch.recommendation,'À écarter selon l’évaluation');
 assert.equal(patch.followup.nextAction,report.next_action);
 assert.equal(patch.followup.note,'Keep this note');assert.equal(patch.followup.dueDate,'2026-10-01');
 assert.notEqual(evaluationAction({final_decision:'Do not apply'}).recommendation,'Candidater');
 assert.equal(evaluationSummary('Calendar conflict; profile: fictional; posted: 2026-09-08'),'Calendar conflict');
});
test('report refresh never replaces a manually chosen decision or follow-up action',()=>{
 const job={recommendation:'Demander une dérogation écrite',followup:{nextAction:'Recontacter mon interlocuteur vendredi',dueDate:'2026-09-11',note:'Personal note'}};
 assert.deepEqual(retirePendingEvaluation(job,{final_decision:'Skip',next_action:'New automatic advice'}),{});
});
