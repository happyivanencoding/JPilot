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
  assert.match(catalog,/Votre parcours fait déjà ressortir ces forces essentielles/);
  assert.match(catalog,/className="onward-home-strengths"/);
  assert.match(catalog,/data-testid=\{`home-strength-\$\{i\}`\}/);
  assert.match(catalog,/data-testid="home-strength-popover"/);
  assert.match(catalog,/onClick=\{\(\)=>setActiveStrength\(null\)\}/);
  assert.match(catalog,/onClick=\{event=>event\.stopPropagation\(\)\}/);
  assert.doesNotMatch(catalog,/<EditorialIdentity/);
  assert.doesNotMatch(catalog,/detail=\{lead\?\.evidence/);
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
  assert.match(prompt,/Put the concrete CV example only in evidence/);
});
