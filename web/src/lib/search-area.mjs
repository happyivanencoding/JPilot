export function normalizeSearchArea(value) {
 if(!value || !['city','france'].includes(value.scope))throw new Error('Choose a city or all of France.');
 const city=String(value.city||'').trim().replace(/\s+/g,' ').slice(0,80);
 if(value.scope==='city'&&!city)throw new Error('Enter a city.');
 return {scope:value.scope,city:value.scope==='city'?city:''};
}
const plain=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
/** An explicit area is a boundary, not a ranking penalty or a relocation invitation. */
export function offerInSearchArea(offer,area) {
 if(!area)return true;
 const location=plain(offer.location),country=plain(offer.country);
 const french=['fr','france','fra'].includes(country)||/\bfrance\b/.test(location)||offer.source==='France Travail'||offer.provider==='france-travail';
 if(country&&!['fr','france','fra','unknown'].includes(country))return false;
 if(area.scope==='france')return french;
 const city=plain(area.city);
 // Word boundaries prevent Paris from matching unrelated words. A missing city
 // is not silently accepted as nearby, even when the offer has a strong score.
 return area.scope==='city' && !!city && (` ${location} `).includes(` ${city} `) && french;
}
export function systemUiLanguage(tag='') {
 const language=String(tag).toLowerCase().split(/[-_]/)[0];
 return language==='fr'?'fr':language==='zh'?'zh':'en';
}
