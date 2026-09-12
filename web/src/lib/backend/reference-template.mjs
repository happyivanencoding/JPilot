// Single-column professional CV: semantic hierarchy, not one paragraph per
// extracted PDF line. Layout-only; each content block remains source text.
const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=text=>String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const kinds={contact:/^(contact|coordonnees|personal details)$/,profile:/^(professional summary|profil|profile|summary|about me|objective)$/,education:/^(formation|education|academic background|etudes)$/,experience:/^(experiences?( professionnelles?)?|professional experience|work experience|employment|experience professionnelle)$/,projects:/^(ai projects?.*|projets?.*|projects?.*|volunteering|activities|engagements.*)$/,skills:/^(competences|skills|expertise)$/,tools:/^(outils|tools|software|technical skills)$/,languages:/^(langues|languages)$/,interests:/^(interets|interests|hobbies)$/};
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
const clean=text=>String(text??'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'$1 ($2)').trim();
function tailoredSections(payload={}) {
 const sections=new Map();
 if(clean(payload.summary))sections.set('profile',{kind:'profile',title:'',blocks:[{kind:'text',text:clean(payload.summary)}]});
 if(Array.isArray(payload.experience)&&payload.experience.length)sections.set('experience',{kind:'experience',title:'',blocks:payload.experience.flatMap(item=>[
  {kind:'entry',text:[clean(item.company),clean(item.dates)].filter(Boolean).join(' — ')},
  ...([clean(item.role),clean(item.location)].filter(Boolean).length?[{kind:'text',text:[clean(item.role),clean(item.location)].filter(Boolean).join(' — ')}]:[]),
  ...(item.bullets||[]).map(text=>({kind:'bullet',text:clean(text)})),
 ])});
 if(Array.isArray(payload.projects)&&payload.projects.length)sections.set('projects',{kind:'projects',title:'',blocks:payload.projects.flatMap(item=>[
  {kind:'entry',text:clean(item.name)},
  ...(clean(item.description)?[{kind:'text',text:clean(item.description)}]:[]),
  ...(clean(item.tech)?[{kind:'text',text:clean(item.tech)}]:[]),
 ])});
 if(Array.isArray(payload.education)&&payload.education.length)sections.set('education',{kind:'education',title:'',blocks:payload.education.flatMap(item=>[
  {kind:'entry',text:[clean(item.title),clean(item.year)].filter(Boolean).join(' — ')},
  ...(clean(item.org)?[{kind:'text',text:clean(item.org)}]:[]),
  ...(clean(item.description)?[{kind:'text',text:clean(item.description)}]:[]),
 ])});
 if(Array.isArray(payload.skills)&&payload.skills.length)sections.set('skills',{kind:'skills',title:'',blocks:payload.skills.map(item=>({kind:'text',text:`${clean(item.category)||'Skills'}: ${(item.items||[]).map(clean).filter(Boolean).join(', ')}`}))});
 return sections;
}
function mergeTailoredLayout(layout,payload) {
 const generated=tailoredSections(payload),used=new Set(),sections=[];
 for(const section of layout.sections||[]) {
  const replacement=generated.get(section.kind);
  if(replacement&&!used.has(section.kind)){sections.push({...replacement,title:section.title||replacement.title,column:section.column});used.add(section.kind);}
  else if(!replacement || !['profile','experience','projects','education','skills'].includes(section.kind))sections.push(section);
 }
 for(const [kind,section] of generated)if(!used.has(kind))sections.push({...section,column:0});
 return {...layout,sections};
}
function renderColumnSection(section,labels) {
 const kind=section.kind in labels?section.kind:'other';
 const title=section.title||labels[kind]||labels.other;
 const compactKind=['skills','tools','languages','interests'].includes(kind);
 if(compactKind)return `<section><h2>${escape(title)}</h2><p>${(section.blocks||[]).map(b=>escape(b.text)).join(' · ')}</p></section>`;
 let body='',list=false;
 for(const block of section.blocks||[]){
  if(block.kind==='bullet'){if(!list){body+='<ul>';list=true;}body+=`<li>${escape(block.text)}</li>`;continue;}
  if(list){body+='</ul>';list=false;}
  body+=block.kind==='entry'?`<h3>${escape(block.text)}</h3>`:`<p${/\b(19|20)\d{2}\b/.test(block.text)&&block.text.length<90?' class="meta"':''}>${escape(block.text)}</p>`;
 }
 if(list)body+='</ul>';
 return `<section><h2>${escape(title)}</h2>${body}</section>`;
}
function contactKey(value) {
 const text=clean(value).toLowerCase();
 const email=text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0];
 if(email)return `email:${email}`;
 const digits=text.replace(/\D/g,'');if(digits.length>=9)return `phone:${digits}`;
 const url=text.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in\/|[a-z0-9.-]+\.[a-z]{2,}\/)[^\s·|]*/)?.[0];
 if(url)return `url:${url.replace(/^https?:\/\/(?:www\.)?/,'').replace(/\/$/,'')}`;
 return `text:${norm(text).replace(/\s+/g,' ')}`;
}
function contactPieces(value) {
 const text=clean(value);if(!text)return [];
 const pieces=text.split(/\s*[·|]\s*/).map(clean).filter(Boolean);
 return pieces.length>1?pieces:[text];
}
function professionalHtml(layout,language,compact=false) {
 const payload={language};
 const fr=payload.language==='fr';
 const labels=fr?{profile:'Profil',education:'Formation',experience:'Expérience professionnelle',projects:'Projets et engagements',skills:'Compétences',tools:'Outils',languages:'Langues',interests:'Centres d’intérêt',other:'Informations complémentaires'}:{profile:'Profile',education:'Education',experience:'Experience',projects:'Projects & activities',skills:'Skills',tools:'Tools',languages:'Languages',interests:'Interests',other:'Additional information'};
 const sections=(layout.sections||[]).filter(s=>s.blocks?.length);
 const groups=kind=>sections.filter(s=>s.kind===kind);
 const contacts=[];const seenContacts=new Set();
 for(const value of [...(Array.isArray(layout.contact)?layout.contact:[]),...groups('contact').flatMap(s=>s.blocks.map(b=>b.text))]){
  for(const text of contactPieces(value)){const key=contactKey(text);if(seenContacts.has(key))continue;seenContacts.add(key);contacts.push(text);}
 }
 let content=`<header><h1>${escape(layout.name)}</h1>${contacts.length?`<p class="contact">${contacts.map(escape).join(' · ')}</p>`:''}${layout.headline?`<p class="headline">${escape(layout.headline)}</p>`:''}</header>`;
 // Source columns describe extraction order only; every generated CV is A4 single-column.
 content+=`<main>${sections.filter(s=>s.kind!=='contact').map(s=>renderColumnSection(s,labels)).join('')}</main>`;
 if(layout.footer?.length)content+=`<footer>${layout.footer.map(escape).join(' · ')}</footer>`;
 return `<!doctype html><html lang="${fr?'fr':'en'}"><head><meta charset="utf-8"><title>${escape(layout.name)} — CV</title><style>
 @page{size:A4;margin:13mm 16mm}*{box-sizing:border-box}body{font:10pt/1.24 Arial,Helvetica,sans-serif;color:#111;margin:0;overflow-wrap:break-word}header{text-align:left;margin-bottom:10pt}h1{font-size:17pt;line-height:1.1;margin:0 0 6pt}.contact{font-size:8.5pt;line-height:1.35;margin:0}.headline{font-size:10pt;margin:5pt 0 0}h2{font:700 10.5pt/1.1 Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.15pt;border-bottom:.6pt solid #222;margin:11pt 0 4pt;padding-bottom:2pt;break-after:avoid}h3{font-size:10pt;margin:5pt 0 2pt;break-after:avoid}p{margin:2pt 0;orphans:2;widows:2}.meta{font-size:9pt;font-style:italic;margin:1pt 0 3pt}ul{padding-left:13pt;margin:3pt 0 5pt}li{margin:2pt 0;break-inside:avoid}footer{font-size:7pt;line-height:1.2;margin-top:10pt}strong{font-weight:700}body.compact{font-size:9pt;line-height:1.16}body.compact h1{font-size:16pt}body.compact h2{font-size:10pt;margin:7pt 0 3pt}body.compact h3{font-size:9pt;margin:3pt 0 1pt}body.compact p{margin:1pt 0}body.compact ul{margin:1pt 0 3pt}body.compact li{margin:1pt 0}
 </style></head><body${compact?' class="compact"':''}>${content}</body></html>`;
}
export function professionalReferenceHtml(payload) {
 return professionalHtml(payload.layoutSource || textCvLayout(payload.content),payload.language);
}
export function professionalTailoredHtml(payload) {
 const original=payload.layoutSource || textCvLayout(payload.content);
 return professionalHtml(mergeTailoredLayout(original,payload.tailoredPayload || {}),payload.language,!!payload.compact);
}
