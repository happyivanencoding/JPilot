// Targeting constraints only. Nationality, name and university never enter ranking.
const plain=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function candidateConstraints(offer,input) {
  const title=plain(offer.title),body=plain(`${offer.description||''} ${offer.why||''}`),text=title+' '+body;
  const explicitIntent=input?.hasExplicitIntent===true;
  const junior=/junior|graduate|entry|first|premier/i.test(input.seniority||'');
  const marketing=/marketing|brand|crm|consumer insights|growth|e-commerce|loyalty/i.test((input.targetRoles||[]).join(' '));
  const experienceYears=[
    ...text.matchAll(/(?:experience|expérience).{0,45}\b([2-9])\s*(?:[-–àa]\s*\d+)?\+?\s*(?:years?|ans?)\b/g),
    ...text.matchAll(/\b([2-9])\s*(?:[-–àa]\s*\d+)?\+?\s*(?:years?|ans?)\s*(?:minimum\s*)?(?:of\s+|d['’]\s*)?(?:experience|expérience)\b/g),
  ].map(m=>Number(m[1]));
  const juniorTitle=/\b(junior|assistant|associate|graduate|entry|debutant|charge|coordinateur|coordinator)\b/.test(title);
  const seniorTitle=/\b(senior|head|director|directeur|directrice|lead|vp|principal)\b/.test(title)
    || (!juniorTitle && /\b(manager|responsable|confirme|experimente)\b/.test(title));
  const notes=[];
  let penalty=0,bonus=0,forceClosest=false;
  let seniorityFit='target-or-unknown',roleFit='target-or-unknown';
  if(junior&&(seniorTitle||experienceYears.length)) {
    seniorityFit='above-target';
    // When the user explicitly asks for an occupation, experience/seniority is a
    // fit gap to explain, not a reason to hide a genuinely relevant posting.
    // System-led recommendations may still demote unrealistic senior roles.
    if(!explicitIntent){forceClosest=true;penalty+=35;}
    notes.push('Séniorité probablement au-dessus de la cible junior : expérience confirmée à vérifier avant de candidater.');
  }
  if(marketing&&/\b(sales|commercial|business development|account executive|sdr|bdr)\b/.test(title)&&!/marketing/.test(title)) {
    roleFit='outside-primary';
    if(!explicitIntent){forceClosest=true;penalty+=18;}
    notes.push('Poste commercial hors cible marketing principale, conservé comme option de repli.');
  }
  const limitedFrench=/^(A[12]|B1)$/i.test(input.languages?.french||'');
  const frenchRequired=/(?:fluent|native|bilingual|professional|excellent|perfect|courant|bilingue|maternel|maitrise|professionnel).{0,28}(?:french|francais)|(?:french|francais).{0,28}(?:fluent|native|bilingual|professional|courant|bilingue|maternel|excellent|c1|c2)/.test(text);
  const frenchNotRequired=/(?:french|francais).{0,25}(?:not required|not essential|optional|non requis|facultatif)/.test(text);
  const localWriting=/copywriter|redacteur|redaction|relations presse|public relations|communication editoriale/.test(title);
  const englishExplicit=/english.{0,30}(?:working language|primary language|speaking team)|working language.{0,20}english|international.{0,30}(?:team|markets)|global.{0,20}(?:team|brand)|cross.country|langue de travail.{0,20}anglais/.test(text);
  const languageRisk=limitedFrench&&!frenchNotRequired&&(frenchRequired||localWriting);
  if(languageRisk){if(!explicitIntent)penalty+=30;notes.push('Français professionnel demandé ou rédaction locale : niveau actuel probablement inférieur à l’exigence.');}
  else if(englishExplicit){bonus+=7;notes.push('Contexte international / anglais documenté ; exigences de français à confirmer si absentes.');}
  else if(limitedFrench)notes.push('Langue de travail non confirmée : vérifier le niveau de français exigé.');
  if(input.availableFrom && Date.parse(input.availableFrom)>Date.now())notes.push(`Disponibilité candidat à partir du ${input.availableFrom} : date d’entrée à confirmer, recherche de marché en amont.`);
  return {exclude:false,forceClosest,penalty,bonus,seniorityFit,roleFit,
    languageFit:languageRisk?'french-development-needed':englishExplicit?'international-evidence':'unknown',notes};
}
