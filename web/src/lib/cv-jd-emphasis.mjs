const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const STOP=new Set(['stage','internship','intern','cdi','cdd','junior','senior','h f','hf','team','work','role','poste','job','mission','missions','experience','experiences','skills','competences','company','entreprise','candidate','candidat']);
const text=value=>String(value??'').trim().replace(/\s+/g,' ');
function collect(value,out){
 if(typeof value==='string'){const v=text(value);if(v)out.push(v);return;}
 if(Array.isArray(value)){for(const item of value)collect(item,out);return;}
 if(value&&typeof value==='object'){for(const item of Object.values(value))collect(item,out);}
}
export function jdEmphasisKeywords(job,payload,limit=10){
 const signals=[];
 collect(job?.v1Match?.deepMatch?.tools,signals);
 collect((job?.v1Match?.deepMatch?.requirements||[]).map(x=>x?.title),signals);
 collect(job?.v1Match?.deepMatch?.responsibilities,signals);
 collect(job?.cv?.keywords,signals);
 const body=normalize(JSON.stringify({...payload,change_notes:undefined}));
 const seen=new Set(),ranked=[];
 for(const raw of signals){
  for(const phrase of [raw,...raw.split(/[·|,;/()–—:-]/).map(text)]){
   const value=text(phrase),key=normalize(value);
   if(!key||key.length<3||key.length>64||STOP.has(key)||seen.has(key)||!body.includes(key))continue;
   seen.add(key);ranked.push(value);
  }
 }
 return ranked.sort((a,b)=>b.length-a.length).slice(0,limit);
}
