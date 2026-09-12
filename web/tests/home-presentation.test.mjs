import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {candidateNameForMaterial} from '../src/lib/candidate-display-name.mjs';

test('candidate greeting name follows CV material language without changing stored identity',()=>{
  assert.equal(candidateNameForMaterial('李若晴','fr'),'Li Ruoqing');
  assert.equal(candidateNameForMaterial('李若晴','en'),'Li Ruoqing');
  assert.equal(candidateNameForMaterial('李若晴','zh'),'李若晴');
  assert.equal(candidateNameForMaterial('李若晴 (Li Ruoqing)','fr'),'Li Ruoqing');
  assert.equal(candidateNameForMaterial('Hugo Pelletier','fr'),'Hugo Pelletier');
});

test('Home shows first-principles strength bullets and reveals evidence only in a dismissible popover',()=>{
  const catalog=fs.readFileSync(new URL('../src/components/jobpilot/catalog.tsx',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../src/components/jobpilot/onward.css',import.meta.url),'utf8');
  assert.match(catalog,/Votre parcours fait déjà ressortir ces forces essentielles/);
  assert.match(catalog,/className="onward-home-strengths"/);
  assert.match(catalog,/data-testid=\{`home-strength-\$\{i\}`\}/);
  assert.match(catalog,/data-testid="home-strength-popover"/);
  assert.match(catalog,/createPortal\(/);
  assert.match(catalog,/className="onward-strength-popover-close"/);
  assert.match(catalog,/className="onward-strength-popover-scroll"/);
  assert.match(catalog,/strengthExamples\(activeStrength,tr\)\.map/);
  assert.match(catalog,/onClick=\{\(\)=>setActiveStrength\(null\)\}/);
  assert.match(catalog,/onClick=\{event=>event\.stopPropagation\(\)\}/);
  assert.match(css,/\.onward-strength-popover\{[^}]*max-height:min\(76dvh,620px\)[^}]*overflow:hidden/);
  assert.match(css,/\.onward-strength-popover-scroll\{[^}]*overflow:auto/);
  assert.doesNotMatch(catalog,/<EditorialIdentity/);
  assert.doesNotMatch(catalog,/detail=\{lead\?\.evidence/);
});

test('Home can show several next improvements and Opportunities has no redundant experience subtitle',()=>{
  const catalog=fs.readFileSync(new URL('../src/components/jobpilot/catalog.tsx',import.meta.url),'utf8');
  assert.match(catalog,/growths=rows\(data\.analysis\?\.growthAreas\)\.slice\(0,3\)/);
  assert.match(catalog,/growths\.map\(\(growth,i\)=>/);
  assert.doesNotMatch(catalog,/根据你的经历挑选的岗位|Des postes choisis à partir de votre parcours|Roles selected from your experience/);
});

test('Home direction separators leave breathing room around the heading',()=>{
  const css=fs.readFileSync(new URL('../src/components/jobpilot/onward.css',import.meta.url),'utf8');
  assert.match(css,/\.onward-home-growth\{[^}]*margin-bottom:20px/);
  assert.match(css,/\.onward-home-section\.direction-section>\.jp-row\{padding:0 0 8px\}/);
  assert.match(css,/\.onward-home-section\.direction-section \.jp-direction-grid\{margin-top:8px\}/);
});

test('future orientation strength titles request durable first-principles capabilities',()=>{
  const prompt=fs.readFileSync(new URL('../src/lib/v1-journey.mjs',import.meta.url),'utf8');
  assert.match(prompt,/first-principles capabilities or durable working strengths/);
  assert.match(prompt,/collect every clearly relevant CV example up to four distinct examples/);
  assert.match(prompt,/Give 3 strengths, 2-3 improvements/);
});
