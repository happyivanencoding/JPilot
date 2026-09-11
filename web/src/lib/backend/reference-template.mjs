// Single-column professional CV: semantic hierarchy, not one paragraph per
// extracted PDF line. Layout-only; each content block remains source text.
const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=text=>String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const kinds={contact:/^(contact|coordonnees|personal details)$/,profile:/^(profil|profile|summary|about me|objective)$/,education:/^(formation|education|academic background|etudes)$/,experience:/^(experiences?( professionnelles?)?|professional experience|work experience|employment|experience professionnelle)$/,projects:/^(projets?.*|projects?.*|volunteering|activities|engagements.*)$/,skills:/^(competences|skills|expertise)$/,tools:/^(outils|tools|software|technical skills)$/,languages:/^(langues|languages)$/,interests:/^(interets|interests|hobbies)$/};
export function textCvLayout(text){
 const sections=[];let name='',headline='',section=null;
 for(const original of String(text).split(/\r?\n/)){
  const line=original.trim();if(!line||/^---+$/.test(line))continue;
  const value=line.replace(/^#{1,4}\s+/,'').replace(/^\*\*|\*\*$/g,'');
  const kind=Object.entries(kinds).find(([,pattern])=>pattern.test(norm(value)))?.[0];
  if(kind || /^##\s/.test(line)){section={kind:kind||'other',title:value,blocks:[]};sections.push(section);continue;}
  if(!name){name=value;continue;}
  if(!section){section={kind:/@|linkedin|https|\+\d/.test(value)?'contact':'profile',title:'',blocks:[]};sections.push(section);}
  const bullet=/^[-*•]\s/.test(value);
  const heading=/^#{3,4}\s|^\*\*/.test(line);
  section.blocks.push({kind:bullet?'bullet':heading?'entry':'text',text:bullet?value.replace(/^[-*•]\s+/,''):value});
 }
 return {name,headline,sections,footer:[]};
}
export function professionalReferenceHtml(payload) {
 const layout=payload.layoutSource || textCvLayout(payload.content);
 const fr=payload.language==='fr';
 const labels=fr?{profile:'Profil',education:'Formation',experience:'Expérience professionnelle',projects:'Projets et engagements',skills:'Compétences',tools:'Outils',languages:'Langues',interests:'Centres d’intérêt',other:'Informations complémentaires'}:{profile:'Profile',education:'Education',experience:'Experience',projects:'Projects & activities',skills:'Skills',tools:'Tools',languages:'Languages',interests:'Interests',other:'Additional information'};
 const sections=(layout.sections||[]).filter(s=>s.blocks?.length);
 const groups=kind=>sections.filter(s=>s.kind===kind);
 const contacts=groups('contact').flatMap(s=>s.blocks.map(b=>b.text));
 let content=`<header><h1>${escape(layout.name)}</h1>${contacts.length?`<p class="contact">${contacts.map(escape).join(' · ')}</p>`:''}${layout.headline?`<p class="headline">${escape(layout.headline)}</p>`:''}</header>`;
 for(const kind of ['profile','education','experience','projects','other']) {
  const selected=sections.filter(s=>s.kind===kind||kind==='other'&&!Object.keys(labels).includes(s.kind)&&s.kind!=='contact');
  if(!selected.length)continue;
  let body='';for(const section of selected){
   let list=false;
   for(const block of section.blocks){
    if(block.kind==='bullet'){if(!list){body+='<ul>';list=true;}body+=`<li>${escape(block.text)}</li>`;continue;}
    if(list){body+='</ul>';list=false;}
    body+=block.kind==='entry'?`<h3>${escape(block.text)}</h3>`:`<p${/\b(19|20)\d{2}\b/.test(block.text)&&block.text.length<90?' class="meta"':''}>${escape(block.text)}</p>`;
   }
   if(list)body+='</ul>';
  }
  content+=`<section><h2>${labels[kind]}</h2>${body}</section>`;
 }
 const compact=['skills','tools','languages','interests'].filter(k=>groups(k).length);
 if(compact.length){content+=`<section><h2>${fr?'Compétences et informations complémentaires':'Skills & additional information'}</h2>`;for(const key of compact){content+=`<p><strong>${labels[key]}:</strong> ${groups(key).flatMap(s=>s.blocks.map(b=>b.text)).map(escape).join(' · ')}</p>`;}content+='</section>';}
 if(layout.footer?.length)content+=`<footer>${layout.footer.map(escape).join(' · ')}</footer>`;
 return `<!doctype html><html lang="${fr?'fr':'en'}"><head><meta charset="utf-8"><title>${escape(layout.name)} — CV</title><style>
 @page{size:A4;margin:13mm 16mm}*{box-sizing:border-box}body{font:10pt/1.24 Georgia,"Times New Roman",serif;color:#19262e;margin:0;width:178mm;overflow-wrap:break-word}header{text-align:center;margin-bottom:8pt}h1{font-size:21pt;line-height:1.1;margin:0 0 5pt;color:#162f40}.contact{font:8.5pt/1.35 Arial,sans-serif;margin:0}.headline{font-size:9.5pt;margin:6pt 0 0}h2{font:700 10pt/1.1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.5pt;color:#162f40;border-bottom:.65pt solid #426070;margin:9pt 0 5pt;padding-bottom:3pt;break-after:avoid}h3{font-size:10pt;margin:6pt 0 2pt;break-after:avoid}p{margin:2pt 0;orphans:2;widows:2}.meta{font-size:9pt;font-style:italic;margin:1pt 0 3pt}ul{padding-left:13pt;margin:3pt 0 5pt}li{margin:2pt 0;break-inside:avoid}footer{font:6.5pt/1.2 Arial,sans-serif;color:#687781;margin-top:10pt}strong{font-weight:700}
 </style></head><body>${content}</body></html>`;
}
