import {pinyin} from 'pinyin-pro';

const HAN=/\p{Script=Han}/u;
const LATIN=/\p{Script=Latin}/u;
const cap=value=>value?value[0].toLocaleUpperCase()+value.slice(1).toLocaleLowerCase():'';

function latinCandidate(value){
  const parts=String(value||'').split(/[^\p{Script=Latin}'’-]+/u).map(x=>x.trim()).filter(Boolean);
  return parts.length>=2?parts.join(' '):'';
}

export function candidateNameForMaterial(value,language='fr'){
  const raw=String(value||'').replace(/\s+/g,' ').trim();
  if(!raw||!HAN.test(raw)||!['fr','en'].includes(String(language)))return raw;
  const existing=latinCandidate(raw);
  if(existing&&LATIN.test(existing))return existing;
  const chars=[...raw].filter(ch=>HAN.test(ch)).join('');
  if(!chars)return raw;
  const syllables=pinyin(chars,{toneType:'none',type:'array'}).map(x=>String(x||'').replace(/[^a-z]/gi,'').toLocaleLowerCase()).filter(Boolean);
  if(!syllables.length)return raw;
  if(syllables.length===1)return cap(syllables[0]);
  return `${cap(syllables[0])} ${cap(syllables.slice(1).join(''))}`;
}
