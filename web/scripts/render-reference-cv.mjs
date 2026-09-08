// Deterministic preview of the actual canonical Markdown (or proposed draft), never an AI approximation.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve(import.meta.dirname,'../../package.json'));
const { chromium } = require('playwright');
const [input,directory] = process.argv.slice(2);
if (!input || !directory) throw new Error('Usage: render-reference-cv.mjs input.json output-directory');
const payload=JSON.parse(fs.readFileSync(input,'utf8'));
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const inline=s=>escape(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'$1 ($2)');
let inList=false;
const blocks=[];
for(const line of String(payload.content).split(/\r?\n/)) {
  const bullet=line.match(/^\s*[-*]\s+(.+)$/);
  if(bullet) {if(!inList){blocks.push('<ul>');inList=true;}blocks.push('<li>'+inline(bullet[1])+'</li>');continue;}
  if(inList){blocks.push('</ul>');inList=false;}
  const heading=line.match(/^(#{1,4})\s+(.+)$/);
  if(heading){const n=heading[1].length;blocks.push(`<h${n}>${inline(heading[2])}</h${n}>`);}
  else if(/^\s*(---+|\|[\s:|\-]+\|)\s*$/.test(line)) continue;
  else if(line.trim()) blocks.push('<p>'+inline(line.replace(/^>\s*/,''))+'</p>');
}
if(inList)blocks.push('</ul>');
const html=`<!doctype html><html lang="${payload.language === 'en' ? 'en' : 'fr'}"><head><meta charset="utf-8"><style>
@page{size:A4;margin:14mm 15mm}*{box-sizing:border-box}body{font:10pt/1.28 Arial,sans-serif;color:#16212b;width:180mm;max-width:180mm;margin:0 auto;overflow-wrap:anywhere}h1{font:700 17pt/1.12 Georgia,serif;margin:0 0 8pt}h2{font-size:10.5pt;text-transform:uppercase;border-bottom:.6pt solid #334155;padding-bottom:3pt;margin:10pt 0 5pt;break-after:avoid}h3,h4{font-size:10pt;margin:7pt 0 3pt;break-after:avoid}p{margin:3pt 0;orphans:3;widows:3}ul{margin:3pt 0 5pt;padding-left:13pt}li{margin:2pt 0;break-inside:avoid}strong{font-weight:700}a{color:inherit;text-decoration:none}
</style></head><body>${blocks.join('\n')}</body></html>`;
fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'cv.html'),html);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:794,height:1123}});
 await page.route('**/*',route=>route.abort()); // No remote fonts, images, tracking or arbitrary embedded URLs.
 await page.setContent(html,{waitUntil:'load'});await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
 const layout=await page.evaluate(()=>{
   const elements=[...document.querySelectorAll('h1,h2,h3,h4,p,li')];
   const body=document.body.getBoundingClientRect();
   const rows=elements.map(element=>{
     const range=document.createRange();range.selectNodeContents(element);
     const positions=new Set([...range.getClientRects()].filter(r=>r.width>0).map(r=>Math.round(r.top)));
     return {tag:element.tagName,text:element.textContent.slice(0,120),lines:positions.size,y:Math.round(element.getBoundingClientRect().top-body.top),height:Math.round(element.getBoundingClientRect().height)};
   });
   const overflow=elements.some(e=>e.scrollWidth>e.clientWidth+2 || e.getBoundingClientRect().right>body.right+2);
   return {fontPt:10,lineHeight:1.28,marginMm:[14,15],lines:rows.reduce((n,r)=>n+r.lines,0),bullets:rows.filter(r=>r.tag==='LI').length,
     longBullets:rows.filter(r=>r.tag==='LI'&&r.lines>3).length,horizontalOverflow:overflow,
     occupiedHeightMm:Math.round(body.height*25.4/96),availableHeightMm:269,sections:rows.filter(r=>/^H[12]$/.test(r.tag)),
     firstSignals:rows.slice(0,7).map(r=>r.text),autoFontShrink:false};
 });
 const pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
 const pages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
 if(!pages)throw new Error('PDF page count could not be verified.');
 fs.writeFileSync(path.join(directory,'cv.pdf'),pdf);
 layout.acceptable=pages===1 && !layout.horizontalOverflow && layout.lines<=56 && layout.longBullets<=1;
 layout.issues=[...(pages>1?['Le contenu dépasse une page. Réduire ou sélectionner les informations.']:[]),...(layout.horizontalOverflow?['Débordement horizontal détecté.']:[]),...(layout.lines>56?['Trop de lignes : la hiérarchie visuelle est trop dense.']:[]),...(layout.longBullets>1?['Plusieurs puces dépassent trois lignes.']:[])];
 const meta={pages,format:'A4',renderer:'Chromium',layout,renderedAt:new Date().toISOString(),
  warnings:pages>1?[`Le CV maître contient ${pages} pages. Cette prévisualisation conserve les preuves ; elle n’atteste pas un CV de candidature d’une page.`]:[],
  layoutNote:'Rendu du contenu canonique. La mise en page originale d’un fichier Word/PDF importé n’est pas reconstruite.',atsCertified:false};
 fs.writeFileSync(path.join(directory,'render.json'),JSON.stringify(meta,null,2));console.log(JSON.stringify(meta));
}finally{await browser.close();}
