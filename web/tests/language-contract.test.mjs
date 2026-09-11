import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {uiLocale,requestUiLocale,applicationLanguage,documentLanguage,contradictsDocumentLanguage} from '../src/lib/language-contract.mjs';
import {candidateVersion,operationKey} from '../src/lib/mobile-state.mjs';
import {cvAnalysisPrompt} from '../src/lib/cv-analysis-prompt.mjs';
import {preservePresentationLanguage,cvBlocks} from '../src/lib/cv-global-plan.mjs';
import {displaySlots,setDisplaySlot,protectTranslation,restoreTranslation,translationKey,productText,reportForDisplay,alreadyLocalized,translationLooksLikeTarget} from '../src/lib/localization-core.mjs';
import {repairMojibake} from '../src/lib/text-repair.mjs';

const english='# TEST CANDIDATE\n\n## EDUCATION\n\nStudent seeking a first role in marketing.\n\n## EXPERIENCE\n\nSupported campaign reporting and prepared presentations for the marketing team.\n\n## SKILLS\n\nEnglish C1, French B1.\n';
const french='# PROFIL FICTIF\n\n## FORMATION\n\nÉtudiant à la recherche de sa première expérience pour les marchés financiers.\n\n## EXPÉRIENCE\n\nSuivi de la trésorerie et préparation des tableaux pour les équipes.\n';
function candidate(cv=english,config='language:\n  output: fr\ncv:\n  language: en\n') {return {id:'source-v1',sources:{cv:{text:cv,modifiedMs:1},config:{text:config,modifiedMs:1},notes:{text:'Synthetic only.',modifiedMs:1}}};}

test('UI locale comes only from the client, never the CV or legacy language.output',()=>{
  assert.equal(requestUiLocale(new Request('https://example.invalid',{headers:{'X-JobPilot-Locale':'zh-CN'}}),'fr'),'zh');
  assert.equal(uiLocale('en-GB'),'en');
  assert.equal(uiLocale('de-DE'),'en');
  assert.equal(uiLocale(''),'en');
  assert.equal(applicationLanguage({language:{output:'zh'},cv:{language:'en'}},french),'en');
  assert.equal(applicationLanguage({language:{output:'en'}},french),'fr');
  assert.equal(documentLanguage(candidate()),'en');
  assert.equal(documentLanguage(candidate(french,'language:\n  output: zh\n')),'fr');
});
test('provider mojibake is repaired without changing correct Unicode names',()=>{
  assert.equal(repairMojibake('VINCI Energies SÃ©nÃ©gal'),'VINCI Energies Sénégal');
  assert.equal(repairMojibake('VINCI Energies Sénégal'),'VINCI Energies Sénégal');
});
test('short English CV-assessment gaps are not mistaken for French display text',()=>{
  const englishGap='No documented residential-building audit exposure.';
  const frenchGap='Aucune expérience documentée en audit de bâtiments résidentiels.';
  assert.equal(alreadyLocalized(englishGap,'fr','fr'),false);
  assert.equal(translationLooksLikeTarget(englishGap,'fr'),false);
  assert.equal(alreadyLocalized(frenchGap,'fr','fr'),true);
  assert.equal(translationLooksLikeTarget(frenchGap,'fr'),true);
});
test('Chinese analysis explicitly requires English CV fragments and preserves original evidence',()=>{
  const prompt=cvAnalysisPrompt({candidate:candidate(),language:'zh'});
  assert.match(prompt,/USER-FACING EXPLANATION LANGUAGE: Simplified Chinese/);
  assert.match(prompt,/APPLICATION DOCUMENT LANGUAGE: English/);
  assert.match(prompt,/expressionIssues.after/);
  assert.match(prompt,/Ignore language.output/);
  // The authority is JSON-encoded in the prompt; escaped newlines are expected.
  const encoded = prompt.split('AUTORITÉ CANDIDAT — seules les données de sources.cv/config/notes peuvent établir un fait personnel :\n')[1].split('\n\nCONTINUITÉ')[0];
  assert.equal(JSON.parse(encoded).sources.cv.text, english);
});
test('default material preference does not create a Candidate or CV version',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jobpilot-language-'));
  try {const source=candidate();const a=candidateVersion(dir,source.sources);source.sources.config.text=source.sources.config.text.replace('language: en','language: fr');const b=candidateVersion(dir,source.sources);assert.equal(a.id,b.id);assert.equal(a.cvVersion,b.cvVersion);}
  finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('business operations ignore UI locale; generated materials distinguish material language',()=>{
  const version={id:'v1'},jobs=[{id:'j',url:'https://example.invalid/job',score:2.6}];
  assert.equal(operationKey('analysis',{language:'zh'},version,jobs),operationKey('analysis',{language:'fr'},version,jobs));
  assert.equal(operationKey('evaluate',{url:jobs[0].url,uiLocale:'zh'},version,jobs),operationKey('evaluate',{url:jobs[0].url,uiLocale:'fr'},version,jobs));
  assert.notEqual(operationKey('cv',{jobId:'j',applicationLanguage:'en'},version,jobs),operationKey('cv',{jobId:'j',applicationLanguage:'fr'},version,jobs));
});
test('mixed-language rewrite cannot be accepted merely by declaring cvLanguage=en',()=>{
  const c=candidate(),blocks=cvBlocks(english);const b=blocks.find(x=>x.text.includes('Supported'));
  const original={expressionIssues:[{before:b.text,after:'为营销团队完成分析。'}],globalPlan:{cvLanguage:'en',targetBlocks:blocks.map(x=>({sourceIds:[x.id],action:x.id===b.id?'rewrite':'keep',...(x.id===b.id?{text:'Préparation des tableaux et suivi des équipes dans les campagnes.'}:{})}))}};
  const saved=JSON.stringify(original);const safe=preservePresentationLanguage(original,c,'zh');
  assert.equal(safe.globalPlan.sourceWordingOnly,true);
  assert.equal(safe.expressionIssues[0].after,b.text);
  assert.equal(JSON.stringify(original),saved);
  assert.equal(contradictsDocumentLanguage('中文改写','en'),true);
});
test('localization slots cannot reach scores, enums, source CV/JD, rewrites or user notes',()=>{
  const source={id:'j',score:2.6,status:'À candidater',role:'Sales Intern',jd:'Description du poste',summary:'Le français B1 est une limite.',strengths:['Formation pertinente.'],cv:{file:'cv.pdf',language:'en',changes:['Expression plus claire.']},followup:{note:'Ma note privée',nextAction:'Mon choix',nextActionSource:'user'},replies:[{text:'Réponse originale'}]};
  const display=structuredClone(source);for(const slot of displaySlots(source,'job'))setDisplaySlot(display,slot.path,'中文解释');
  assert.equal(display.score,2.6);assert.equal(display.status,source.status);assert.equal(display.role,source.role);assert.equal(display.jd,source.jd);assert.deepEqual(display.followup,source.followup);assert.deepEqual(display.replies,source.replies);assert.equal(display.cv.language,'en');assert.equal(source.summary,'Le français B1 est une limite.');
  const a={markdown:'Analyse',expressionIssues:[{title:'Forces',before:english,after:english,detail:'Description'}],globalLayout:{changes:[{before:english,after:english,reason:'Plus clair'}]},globalPlan:{targetBlocks:[{text:english}]}};
  assert.ok(displaySlots(a,'analysis').every(s=>!s.path.includes('before')&&!s.path.includes('after')&&!s.path.includes('targetBlocks')));
});
test('translation roundtrip requires all exact numeric, URL, CEFR and source quote tokens',()=>{
  const text='Score 2.6/5, French B1, June 2027; `source evidence` https://example.invalid/role\n> Description du poste';
  const packed=protectTranslation(text);assert.equal(restoreTranslation(packed.text,packed.protectedValues),text);
  assert.throws(()=>restoreTranslation(packed.text.replace('⟦P0⟧','3.8'),packed.protectedValues));
  assert.throws(()=>restoreTranslation(packed.text+'⟦P0⟧',packed.protectedValues));
  assert.equal(translationKey(text),translationKey(text));assert.notEqual(translationKey(text),translationKey(text+' Updated.'));
});
test('internal status and machine-summary metadata are presentation-only',()=>{
  assert.equal(productText('À candidater','zh'),'待投递');assert.equal(productText('CDI','zh'),'长期合同（CDI）');assert.equal(productText('Maison Asteria','zh'),'Maison Asteria');
  assert.equal(reportForDisplay('# Rapport\nAnalyse.\n## Machine Summary\nscore: 2.6'),'# Rapport\nAnalyse.');
});
