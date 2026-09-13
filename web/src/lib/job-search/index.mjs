import {searchJobicy} from './providers/jobicy.mjs';
import {searchAdzuna} from './providers/adzuna.mjs';
import {searchJooble} from './providers/jooble.mjs';
import {searchSmartRecruiters} from './providers/smartrecruiters.mjs';
import {offerInSearchArea} from '../search-area.mjs';
import {bilingualRoleQueries,bilingualRoleRelevance} from "./role-vocabulary.mjs";
import {candidateConstraints} from './candidate-constraints.mjs';
import { searchJSearch } from './providers/jsearch.mjs';
import { searchFranceTravail } from './providers/france-travail.mjs';
import { searchArbeitnow } from './providers/arbeitnow.mjs';
import { searchTrackedAts } from './providers/tracked-ats.mjs';
import { searchJobIndex } from './providers/job-index.mjs';

const DAY_MS = 86_400_000;
const SEARCH_WINDOW_DAYS = 21;
const STOPWORDS = new Set([
  'jobs','job','role','roles','poste','postes','offre','offres','emploi','emplois','open','opened','current','actuel','actuels','actuelle','actuelles',
  'find','trouver','recherche','chercher','search','according','based','selon','avec','pour','dans','from','with','the','and','des','les','une','un','de','du','et','en',
  'paris','france','remote','hybrid','teletravail','télétravail','cdi','cdd','stage','internship','current','cv','profil','profile','我的','岗位','寻找','当前','简历','根据','适合','开放','优先','官方','职位页','法国','巴黎','远程',
  // Generic seniority / role-head nouns are too weak to make a posting relevant by themselves.
  'senior','junior','experienced','lead','head','manager','management','engineer','engineering','analyst','researcher','developer','scientist','product',
]);

const TOKEN_EQUIVALENTS = new Map([
  ['risque','risk'], ['risques','risk'], ['marche','market'], ['marches','market'],
  ['recherche','research'], ['quantitatif','quantitative'], ['quantitative','quantitative'],
  ['obligataire','fixedincome'], ['obligataires','fixedincome'],
]);
const ALLOWED_SHORT_TOKENS = new Set(['ai','ml','llm','pm']);
const STRONG_DOMAIN_TOKENS = new Set(['quant','quantitative','portfolio','risk','market','fixed','fixedincome','income','investment','investing','asset','systematic','financial','finance','ai','ml','llm','machine','learning','finops','tbm','apttio']);
const MARKETING_TOKENS = new Set(['marketing','brand','crm','consumer','insights','loyalty','growth','omnichannel','ecommerce','e-commerce']);
const HIGH_SPECIFIC_DOMAIN_TOKENS = new Set(['quant','quantitative','fixedincome','systematic','ai','ml','llm','machine','learning','finops','tbm','apttio']);

function clean(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalize(value) {
  return clean(value, 4000).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tokens(value) {
  return [...new Set(normalize(value).split(/[^\p{L}\p{N}+#.]+/u).map(x => x.trim()).filter(x => (x.length >= 3 || ALLOWED_SHORT_TOKENS.has(x)) && !STOPWORDS.has(x)).map(x => TOKEN_EQUIVALENTS.get(x) || x))];
}

function countryCode(country) {
  const c = normalize(country);
  const aliases = [
    ['fr',['france','fr']],['gb',['united kingdom','royaume uni','uk','gb']],['us',['united states','etats unis','usa','us']],
    ['de',['germany','allemagne','de']],['es',['spain','espagne','es']],['it',['italy','italie','it']],['be',['belgium','belgique','be']],
    ['lu',['luxembourg','lu']],['ch',['switzerland','suisse','ch']],['nl',['netherlands','pays bas','nl']],['ie',['ireland','irlande','ie']],
    ['pt',['portugal','pt']],['at',['austria','autriche','at']],['dk',['denmark','danemark','dk']],['se',['sweden','suede','se']],
    ['no',['norway','norvege','no']],['fi',['finland','finlande','fi']],['pl',['poland','pologne','pl']],['cz',['czechia','czech republic','tchequie','cz']],
    ['ro',['romania','roumanie','ro']],['hu',['hungary','hongrie','hu']],['gr',['greece','grece','gr']],['hr',['croatia','croatie','hr']],
    ['si',['slovenia','slovenie','si']],['sk',['slovakia','slovaquie','sk']],['ee',['estonia','estonie','ee']],['lv',['latvia','lettonie','lv']],
    ['lt',['lithuania','lituanie','lt']],['bg',['bulgaria','bulgarie','bg']],['cy',['cyprus','chypre','cy']],['mt',['malta','malte','mt']],
  ];
  return aliases.find(([,values])=>values.some(value=>c===value||(value.length>2&&c.includes(value))))?.[0] || '';
}
const EUROPE_COUNTRY_CODES = new Set(['fr','gb','de','es','it','be','lu','ch','nl','ie','pt','at','dk','se','no','fi','pl','cz','ro','hu','gr','hr','si','sk','ee','lv','lt','bg','cy','mt']);

function genericNaturalQuery(query) {
  return /selon mon cv|based on my cv|according to my cv|根据.{0,8}简历|适合我|mes objectifs|my goals/i.test(query);
}

function franceTravailQueries(query, roles, hasExplicitIntent, contractTypes = [], fallbackPolicy = '') {
  const semanticAliases = bilingualRoleQueries(query);
  const text = normalize(`${query} ${semanticAliases.join(' ')} ${hasExplicitIntent ? '' : roles.join(' ')}`);
  const variants = [];
  const add = value => {
    const item = clean(value, 120);
    if (item && !variants.some(existing => normalize(existing) === normalize(item))) variants.push(item);
  };

  // France Travail indexes French market vocabulary much more reliably than a
  // literal English multi-clause request. These are recall probes only: every
  // result still goes through the same deterministic Paris/contract/relevance
  // projection below, so broadening the request does not promote unrelated work.
  if (/quant|quantitative/.test(text)) add('quant');
  if (/\b(?:market|marche|risk|risque)\b/.test(text)) add('risque de marché');
  if (/(?:fixed\s*income|obligataire|bond)/.test(text)) add('obligataire');
  if (/(?:portfolio|investment|asset|finance|financial)/.test(text)) add('finance de marché');
  if (/quant|quantitative|quantitatif|量化/.test(text)) {
    add('analyste quantitatif');
    add('recherche quantitative');
  }
  const marketingIntent = /marketing|brand|crm|consumer|insight|growth|e.?commerce|product marketing/.test(text);
  if (marketingIntent) {
    const only = contractTypes.length === 1 ? contractTypes[0] : '';
    if (only === 'Stage') add('stage marketing');
    else if (only === 'Alternance') add('alternance marketing');
    else add('marketing');
    if (/crm/.test(text)) add(only === 'Stage' ? 'stage crm' : only === 'Alternance' ? 'alternance crm' : 'crm');
    add(only === 'Stage' ? 'stage communication' : only === 'Alternance' ? 'alternance communication' : 'chef de produit');
  }
  for (const variant of bilingualRoleQueries(query)) add(variant);
  if (hasExplicitIntent) {
    const explicitTokens = tokens(query).filter(token => token !== 'cdi').slice(0, 3);
    if (explicitTokens.length) add(explicitTokens.join(' '));
  }
  for (const role of roles) add(role);
  return variants.slice(0, 3);
}

export function buildProviderInput({ query, targetRoles = [], city = '', country = '', contractTypes = [], remote = false, seniority = '', languages = {}, relocation, strictContract = false, fallbackPolicy = 'closest', fallbackLimit = 6, flexibleEurope = false, availableFrom = '', searchArea=null, aiPlan=null }) {
  const roles = targetRoles.map(x => clean(x, 120)).filter(Boolean);
  const explicit = clean(query, 180);
  const hasExplicitIntent = Boolean(explicit) && !genericNaturalQuery(explicit);
  const fallbackMode = clean(fallbackPolicy, 40).toLowerCase();
  const explicitAliases = hasExplicitIntent && !aiPlan ? bilingualRoleQueries(explicit) : [];
  const intentRoles = hasExplicitIntent ? [...new Set([explicit,...explicitAliases])].filter(Boolean) : roles;
  const queries = [];
  if (hasExplicitIntent) {
    const localizedRole = /[\u3400-\u9fff]/u.test(explicit) && explicitAliases.length;
    const explicitCandidates = localizedRole ? explicitAliases : [explicit,...explicitAliases];
    const explicitLimit = localizedRole ? 3 : 2;
    for (const candidate of explicitCandidates) {
      if (candidate && !queries.some(q=>normalize(q)===normalize(candidate))) queries.push(candidate);
      if (queries.length >= explicitLimit) break;
    }
  }
  if (!hasExplicitIntent && fallbackMode === 'closest' && roles.some(role => /marketing|brand|crm|consumer insights|growth|e-commerce|product marketing/i.test(role))) {
    const only = contractTypes.length === 1 ? contractTypes[0] : '';
    const contractHint = only === 'Stage' ? 'internship' : only === 'Alternance' ? 'alternance apprenticeship' : only === 'CDD' ? 'fixed term' : 'junior';
    const candidates = [roles[0], `${contractHint} marketing`, `${contractHint} business`];
    for (const candidate of candidates) if (candidate && !queries.some(q => normalize(q) === normalize(candidate))) queries.push(candidate);
  } else if (!hasExplicitIntent) {
    for (const role of roles) if (!queries.some(q => normalize(q) === normalize(role))) queries.push(role);
    for (const variant of bilingualRoleQueries(roles[0] || explicit)) if (!queries.some(q=>normalize(q)===normalize(variant))) queries.push(variant);
  }
  if (!queries.length && explicit) queries.push(explicit);
  const contractQueries=(candidates, french=false)=>{
    if(!strictContract || !contractTypes.length || !candidates.length)return candidates.slice(0,3);
    const aliases=bilingualRoleQueries(hasExplicitIntent ? explicit : roles[0] || explicit);
    const labels={Stage:french?'stage':'internship',Alternance:'alternance',CDI:'CDI',CDD:'CDD'};
    const selected=contractTypes.filter(type=>labels[type]);
    const preferred=french ? [aliases.at(-1),...candidates,...aliases] : [...candidates,...aliases];
    const bases=[...new Set(preferred.filter(Boolean).map(value=>clean(value,120)))];
    const result=[];
    if(selected.length===1) {
      for(const base of bases.slice(0,3))result.push(`${base} ${labels[selected[0]]}`);
    } else {
      for(const type of selected)result.push(`${bases[0]} ${labels[type]}`);
      for(const base of bases.slice(1)) { if(result.length>=3)break;result.push(`${base} ${labels[selected[0]]}`); }
    }
    return [...new Set(result)].slice(0,3);
  };
  return {
    query: clean(query, 2000),
    queries: aiPlan ? aiPlan.queries : contractQueries(queries),
    franceTravailQueries: aiPlan ? aiPlan.franceTravailQueries : contractQueries(franceTravailQueries(explicit, hasExplicitIntent ? [] : roles, hasExplicitIntent, contractTypes, fallbackMode),true),
    hasExplicitIntent,
    targetRoles: intentRoles,
    city: clean(city, 100), country: clean(country, 100), countryCode: countryCode(country),
    contractTypes: contractTypes.map(x => clean(x, 40)).filter(Boolean),
    seniority, languages, relocation, strictContract,searchArea,
    fallbackPolicy: fallbackMode,
    fallbackLimit: Math.max(1, Math.min(12, Number(fallbackLimit || 6))),
    flexibleEurope: Boolean(flexibleEurope),
    availableFrom,
    remoteRequested: Boolean(remote) || /remote|télétravail|teletravail|远程/i.test(query),
    remoteOnly: /only remote|100% remote|full.?remote|uniquement.*télétravail|只要远程/i.test(query),
  };
}

function normalizedUrl(value) {
  try {
    const url = new URL(String(value));
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(?:gh_src|source|src|ref)$/i.test(key)) url.searchParams.delete(key);
    return url.href.replace(/\/$/, '').toLowerCase();
  } catch { return ''; }
}

function textIdentityKey(offer) {
  const company = normalize(offer.company).replace(/\b(?:careers?|jobs?|linkedin)\b/g, '').replace(/[^a-z0-9\p{L}]+/gu, ' ').trim();
  const title = normalize(offer.title).replace(/\b(?:h\/f|f\/h|m\/f\/d|h\/f\/x|all genders?)\b/g, '').replace(/[^a-z0-9\p{L}]+/gu, ' ').trim();
  const location = normalize(offer.location).replace(/\b\d{5}\b/g, '').replace(/[^a-z0-9\p{L}]+/gu, ' ').trim();
  return `${company}|${title}|${location}`;
}

function ageDays(postedAt, now) {
  const time = Date.parse(String(postedAt || ''));
  if (!Number.isFinite(time) || time > now + DAY_MS) return null;
  return Math.max(0, Math.floor((now - time) / DAY_MS));
}

function dataQuality(offer) {
  let score = 30; // title/company/url are already required by normalization.
  if (clean(offer.location)) score += 15;
  if (offer.postedAt && Number.isFinite(Date.parse(String(offer.postedAt)))) score += 25;
  if (offer.contractType && offer.contractType !== 'unknown') score += 15;
  if (offer.direct) score += 10;
  if (clean(offer.description)) score += 5;
  return Math.min(100, score);
}

function freshnessScore(days) {
  if (days === null) return 20;
  if (days <= 1) return 100;
  if (days <= 3) return 90;
  if (days <= 7) return 78;
  if (days <= 14) return 60;
  if (days <= 30) return 40;
  return 10;
}

function contractSignals(value) {
  const text = normalize(value);
  const types = [];
  if (/\b(?:alternance|alternant|alternante|apprentissage|apprentice|ausbildung)\b/.test(text)) types.push('Alternance');
  if (/\b(?:intern|internship|stage|stagiaire|praktik\w*)\b/.test(text)) types.push('Stage');
  if (/\bcdd\b|fixed[- ]term/.test(text)) types.push('CDD');
  if (/\bcdi\b|permanent contract/.test(text)) types.push('CDI');
  if (/\b(?:freelance|freelancer|independant)\b/.test(text)) types.push('Freelance');
  return [...new Set(types)];
}

function inferredContractOptions(offer) {
  const declared = clean(offer?.contractType, 120);
  const declaredTypes = declared && declared !== 'unknown' ? contractSignals(declared) : [];
  const titleTypes = contractSignals(offer?.title || '');
  const description = normalize(String(offer?.description || '').slice(0,5000));
  if (declaredTypes.length) return [...new Set([...declaredTypes, ...titleTypes])];
  if (titleTypes.length) return titleTypes;
  const explicit = [];
  if (/contrat.{0,24}(?:alternance|apprentissage)|poste.{0,16}alternance/.test(description)) explicit.push('Alternance');
  if (/convention.{0,16}stage|stage.{0,16}\d+\s*mois|\binternship\b/.test(description)) explicit.push('Stage');
  if (/\bcdd\b|contrat.{0,28}duree determinee|fixed[- ]term contract/.test(description)) explicit.push('CDD');
  if (/\bcdi\b|contrat.{0,28}duree indeterminee|permanent contract/.test(description)) explicit.push('CDI');
  return [...new Set(explicit)];
}

function inferredContractType(offer, requested = []) {
  const options = inferredContractOptions(offer);
  if (!options.length) return 'unknown';
  const requestedMatch = requested.find(type => options.includes(type));
  return requestedMatch || (options.length === 1 ? options[0] : options.join(' / '));
}

function locationCountryHint(offer) {
  const location=String(offer?.location||'').trim();
  const visible=normalize(`${location} ${offer?.title||''}`);
  const states='al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy';
  if(new RegExp(`(?:^|,\\s*)(${states})$`,'i').test(location)||/\b(?:usa|united states)\b/.test(visible)) return 'us';
  return '';
}

function locationConstraint(offer, input) {
  const location = normalize(offer.location);
  const remote = offer.remote === true || /\bremote\b|télétravail|teletravail|homeoffice/.test(location);
  const offerCountryCode=locationCountryHint(offer)||countryCode(offer.country);
  if (!input.city && !input.country && !input.remoteOnly) return {fit:'target-or-unknown',penalty:0,forceClosest:false,notes:[]};
  if (input.countryCode && offerCountryCode && input.countryCode !== offerCountryCode) {
    if (EUROPE_COUNTRY_CODES.has(input.countryCode) && EUROPE_COUNTRY_CODES.has(offerCountryCode)) return {fit:'europe-other',penalty:remote?5:9,forceClosest:false,notes:['Autre pays européen : mobilité et conditions administratives à confirmer.']};
    return {fit:'outside-europe',penalty:20,forceClosest:true,notes:['Hors Europe : conservé comme option de repli ; mobilité à confirmer.']};
  }
  if (!location) return {fit:'unknown',penalty:6,forceClosest:false,notes:['Localisation non confirmée : vérifier avant de candidater.']};
  if (input.remoteOnly && !remote) return {fit:'outside-target',penalty:24,forceClosest:true,notes:['Le poste ne semble pas être 100% télétravail ; conservé comme option de repli.']};
  if (input.city) {
    const city = normalize(input.city);
    const inCity = location.includes(city) || (city === 'paris' && /ile.de.france|hauts.de.seine|la defense|puteaux|montrouge|boulogne|neuilly|cergy|levallois|saint.ouen|saint.denis|issy|courbevoie|velizy|rueil|pantin|suresnes|guyancourt/.test(location));
    if (inCity) return {fit:'target',penalty:0,forceClosest:false,notes:[]};
    if (input.remoteRequested && remote) return {fit:'remote-compatible',penalty:3,forceClosest:false,notes:['Hors ville cible mais télétravail indiqué ; localisation exacte à confirmer.']};
    return {fit:'same-country',penalty:6,forceClosest:false,notes:[`Hors ${input.city}, mais dans le pays cible : mobilité à considérer.`]};
  }
  if (input.country && location.includes(normalize(input.country))) return {fit:'target',penalty:0,forceClosest:false,notes:[]};
  if (input.remoteRequested && remote) return {fit:'remote-compatible',penalty:4,forceClosest:false,notes:[]};
  return {fit:'outside-target',penalty:18,forceClosest:true,notes:[`Localisation hors cible ${input.country || ''} : à vérifier.`]};
}

function searchRelevance(offer, input) {
  const title = normalize(offer.title);
  const body = normalize(offer.description).slice(0, 5000);
  const phrases = input.targetRoles.map(normalize).filter(Boolean);
  const bilingual=bilingualRoleRelevance(input.hasExplicitIntent?input.query:input.targetRoles.join(' '),offer.title);
  if(bilingual)return bilingual;
  // A concrete search such as "fixed income quant" must not be diluted by every
  // long-term profile direction (e.g. an AI Product Engineer target). Profile
  // targets are the fallback only when the user used the generic "based on my CV" search.
  const intentTokens = tokens(input.hasExplicitIntent ? input.query : `${input.targetRoles.join(' ')} ${input.query}`);
  const titleTokenSet = new Set(tokens(title));
  const bodyTokenSet = new Set(tokens(body));
  const titleHits = intentTokens.filter(token => titleTokenSet.has(token));
  const bodyHits = intentTokens.filter(token => bodyTokenSet.has(token));
  const phraseHit = phrases.some(phrase => phrase.length >= 5 && title.includes(phrase));
  // A job title must carry at least one domain signal. Description-only overlap is
  // far too noisy (an Account Manager can mention "risk" and "portfolio" in prose).
  const frenchMarketing=input.targetRoles.some(p=>/marketing|brand|crm|consumer insights/i.test(p)) && /(?:assistant.{0,10})?chef(?:fe)?\s+de\s+produit\b|charge.{0,12}(marketing|crm)|etudes.{0,12}consommateur/.test(title);
  if(frenchMarketing) return 78;
  if (!phraseHit && titleHits.length === 0) return 0;
  const marketingIntent=phrases.some(p=>/marketing|brand|crm|consumer insights|growth|e-commerce/.test(p));
  const marketingHit=marketingIntent && [...titleTokenSet].some(t=>MARKETING_TOKENS.has(t));
  if (!phraseHit && marketingHit) return Math.min(100,55+Math.min(30,titleHits.length*10));
  if (!phraseHit) {
    const titleDomain = [...new Set(titleHits.filter(token => STRONG_DOMAIN_TOKENS.has(token)))];
    const bodyDomain = [...new Set(bodyHits.filter(token => STRONG_DOMAIN_TOKENS.has(token)))];
    if (!titleDomain.length) return 0;
    const evidence = new Set([...titleDomain, ...bodyDomain]);
    const specific = titleDomain.some(token => HIGH_SPECIFIC_DOMAIN_TOKENS.has(token));
    const coherentPair =
      (titleDomain.includes('risk') && titleDomain.includes('market')) ||
      (evidence.has('portfolio') && ['quant','quantitative','investment','investing','asset','fixedincome','systematic'].some(token => evidence.has(token))) ||
      ((evidence.has('finance') || evidence.has('financial')) && ['market','quant','quantitative','fixedincome','investment'].some(token => evidence.has(token))) ||
      (evidence.has('investment') && ['quant','quantitative','fixedincome','systematic','portfolio'].some(token => evidence.has(token)));
    // "Risk Consultant" or "Portfolio Solutions" on its own is not evidence
    // for a market-risk / quantitative-investing search. Broad title words need
    // either a highly specific title signal or coherent supporting context.
    if (!specific && !coherentPair) return 0;
  }
  let score = phraseHit ? 70 : 0;
  score += Math.min(60, titleHits.length * 18);
  score += Math.min(10, bodyHits.length);
  const location = normalize(offer.location);
  if (input.city && location.includes(normalize(input.city))) score += 12;
  else if (input.remoteRequested && (offer.remote === true || /remote|télétravail|teletravail|homeoffice/.test(location))) score += 8;
  return Math.min(100, score);
}

function adjacentSearchRelevance(offer, input) {
  const title = normalize(offer.title);
  const titleTokens = new Set(tokens(title));
  const bodyTokens = new Set(tokens(normalize(offer.description).slice(0, 4000)));
  const intent = new Set(tokens(input.hasExplicitIntent ? input.query : `${input.targetRoles.join(' ')} ${input.query}`));
  const marketingIntent=input.targetRoles.some(p=>/marketing|brand|crm|consumer insights|growth|e-commerce/i.test(p));
  if(marketingIntent && /communication|trade marketing|market research|etudes consommateur/.test(title)) return 42;
  if(marketingIntent && /consultant.{0,30}(digital|data)|digital.{0,20}consultant/.test(title)
    && /\bcrm\b|marketing relationnel|marketing automation|growth marketing|data marketing/.test(normalize(offer.description || offer.why || ''))) return 42;
  const financeIntent = ['quant','quantitative','fixedincome','portfolio','risk','market','investment','investing','asset','systematic','finance','financial'].some(token => intent.has(token));
  if (!financeIntent) return 0;
  if (/account executive|customer success|sales|marketing|business development|recruit|software engineer|devops|site reliability|cybersecurity|product manager|compliance|financial crime/i.test(title)) return 0;
  const adjacentSignals = ['portfolio','investment','investing','asset','risk','finance','financial','trading','treasury','credit','model','modelling','pricing'];
  const titleSignals = adjacentSignals.filter(token => titleTokens.has(token));
  if (!titleSignals.length) return 0;
  const supporting = ['quant','quantitative','fixedincome','portfolio','investment','investing','asset','market','finance','financial','trading','treasury','credit','pricing','model','modelling']
    .filter(token => bodyTokens.has(token) || titleTokens.has(token));
  if (titleSignals.length === 1 && titleSignals[0] === 'risk' && supporting.length === 0) return 0;
  let score = 24 + Math.min(18, titleSignals.length * 6) + Math.min(12, supporting.length * 2);
  const location = normalize(offer.location);
  if (input.city && location.includes(normalize(input.city))) score += 8;
  return Math.min(58, score);
}

function closestSearchRelevance(offer, input) {
  if (input.fallbackPolicy !== 'closest' || input.hasExplicitIntent) return 0;
  const title = normalize(offer.title);
  const body = normalize(offer.description).slice(0, 3000);
  const intent = new Set(tokens(input.hasExplicitIntent ? input.query : `${input.targetRoles.join(' ')} ${input.query}`));
  const titleTokens = new Set(tokens(title));
  const bodyTokens = new Set(tokens(body));
  const titleHits = [...intent].filter(token => titleTokens.has(token)).length;
  const bodyHits = [...intent].filter(token => bodyTokens.has(token)).length;
  let score = 10 + titleHits * 12 + Math.min(10, bodyHits * 2);
  const marketingIntent = input.targetRoles.some(p => /marketing|brand|crm|consumer insights|growth|e-commerce/i.test(p));
  if (marketingIntent) {
    if (/marketing|brand|crm|communication|digital|e.?commerce|content|social media|category|merchandising|consumer|insight/.test(title)) score += 28;
    else if (/commercial|sales|account|customer|client|business|partnership|retail|project|operations|consultant|data analyst|financial analyst|events?|coordinator/.test(title)) score += 18;
    else if (/administr|finance|hr|human resources|ressources humaines|procurement|achat|supply|support|hospitality|customer service|service client/.test(title)) score += 10;
  }
  const junior = /junior|assistant|associate|graduate|entry|charg[eé]|coordinateur|coordinator|analyst|consultant|debutant/.test(title);
  if (junior) score += 8;
  const location = normalize(offer.location);
  if (input.city && location.includes(normalize(input.city))) score += 8;
  return Math.min(55, score);
}

function why(offer) {
  const pieces = [];
  if (offer.relevanceTier === 'closest') pieces.push('meilleure option disponible hors cible principale');
  else if (offer.relevanceTier === 'adjacent') pieces.push('opportunité adjacente à la cible principale');
  else if (offer.searchRelevance >= 70) pieces.push('intitulé très proche de la recherche');
  else if (offer.searchRelevance >= 40) pieces.push('intitulé ou contenu lié à la recherche');
  if (offer.ageDays !== null) pieces.push(offer.ageDays === 0 ? 'publiée aujourd’hui' : `publiée il y a ${offer.ageDays} j`);
  else pieces.push('date de publication non fournie');
  if (offer.direct) pieces.push('lien de candidature direct');
  return `Annonce repérée · ${pieces.join(' · ')}. Compatibilité candidat non évaluée.`;
}

function providerError(id, label, started, error) {
  return { id, label, status: 'error', latencyMs: Date.now() - started, rawCount: 0, apiCalls: 0, estimatedCostUsd: 0, offers: [], error: error instanceof Error ? error.message : String(error) };
}

async function safely(id, label, fn) {
  const started = Date.now();
  try { return await fn(); }
  catch (error) { return providerError(id, label, started, error); }
}

export function summarizeSearchQuality(offers, providerRuns, { rawCount, dedupedCount, knownRemoved, locationRemoved, relevanceRemoved, now = Date.now() }) {
  const dated = offers.filter(x => x.ageDays !== null);
  const fresh7 = dated.filter(x => x.ageDays <= 7).length;
  const fresh3 = dated.filter(x => x.ageDays <= 3).length;
  const direct = offers.filter(x => x.direct).length;
  const knownContract = offers.filter(x => x.contractType && x.contractType !== 'unknown').length;
  const strong = offers.filter(x => x.relevanceTier === 'strong').length;
  const adjacent = offers.filter(x => x.relevanceTier === 'adjacent').length;
  const closest = offers.filter(x => x.relevanceTier === 'closest').length;
  const avg = key => offers.length ? Math.round(offers.reduce((sum, x) => sum + Number(x[key] || 0), 0) / offers.length) : null;
  return {
    wallMs: null,
    rawCount,
    dedupedCount,
    knownRemoved,
    locationRemoved,
    relevanceRemoved,
    returnedCount: offers.length,
    strongCount: strong,
    adjacentCount: adjacent,
    closestCount: closest,
    duplicateRate: rawCount ? Math.round((rawCount - dedupedCount) / rawCount * 100) : 0,
    datedRate: offers.length ? Math.round(dated.length / offers.length * 100) : 0,
    fresh3dRate: dated.length ? Math.round(fresh3 / dated.length * 100) : null,
    fresh7dRate: dated.length ? Math.round(fresh7 / dated.length * 100) : null,
    directRate: offers.length ? Math.round(direct / offers.length * 100) : 0,
    contractKnownRate: offers.length ? Math.round(knownContract / offers.length * 100) : 0,
    averageSearchRelevance: avg('searchRelevance'),
    averageDataQuality: avg('dataQuality'),
    estimatedApiCostUsd: providerRuns.reduce((sum, run) => sum + (Number(run.estimatedCostUsd) || 0), 0),
    providers: providerRuns.map(({ offers: _offers, ...run }) => run),
    measuredAt: new Date(now).toISOString(),
  };
}

export async function searchStructuredOffers(request, options = {}) {
  const started = Date.now();
  const input = buildProviderInput(request);
  if (!input.queries.length) throw new Error('Aucun intitulé de poste exploitable pour la recherche structurée.');
  const indexRun = await safely('job-index', 'Onward Job Index', () => searchJobIndex(input, {limit:options.indexLimit ?? 100,...options.jobIndex}));
  const maxIndexAgeMs = Math.max(60_000, Number(options.maxIndexAgeMs ?? 12 * 60 * 60 * 1000));
  const indexFresh = indexRun.syncAgeMs != null && indexRun.syncAgeMs <= maxIndexAgeMs;
  const indexMinimumRaw = Math.max(1, Number(options.indexMinimumRaw ?? 24));
  const indexSufficient = ['ok','partial'].includes(indexRun.status) && indexFresh && indexRun.rawCount >= indexMinimumRaw;
  const liveRuns = indexSufficient && options.forceLiveProviders !== true ? [] : await Promise.all([
    safely('tracked-ats', 'ATS directs', () => searchTrackedAts(input, options.trackedAts)),
    safely('france-travail', 'France Travail', () => searchFranceTravail(input, options.franceTravail)),
    safely('jsearch', 'JSearch', () => searchJSearch(input, options.jsearch)),
    safely('smartrecruiters', 'SmartRecruiters', () => searchSmartRecruiters(input, {enabled:options.additionalSources===true,...options.smartrecruiters})),
    safely('jobicy', 'Jobicy', () => searchJobicy(input, {enabled:false,...options.jobicy})),
    safely('adzuna', 'Adzuna', () => searchAdzuna(input, options.adzuna)),
    safely('jooble', 'Jooble', () => searchJooble(input, options.jooble)),
    safely('arbeitnow-dev', 'Arbeitnow (dev)', () => searchArbeitnow(input, { ...options.arbeitnow, enabled: options.includeDevelopmentSource === true })),
  ]);
  const runs = [indexRun, ...liveRuns];
  const raw=runs.flatMap(run=>run.offers || []);
  const semanticRelevance=options.classifyOffers ? await options.classifyOffers(raw.filter(offer=>{
    const contract=inferredContractType(offer,input.contractTypes);
    if(input.searchArea&&!offerInSearchArea(offer,input.searchArea))return false;
    if(input.contractTypes.length&&contract!=='unknown'&&!input.contractTypes.includes(contract))return false;
    if(input.strictContract&&input.contractTypes.length&&contract==='unknown'&&!input.contractTypes.includes('CDI'))return false;
    return true;
  })) : null;
  return rankSearchResults(request,raw,runs,{...options,semanticRelevance,started});
}

export function rankSearchResults(request, raw, runs = [], options = {}) {
  const started=options.started ?? Date.now();
  const input=buildProviderInput(request);
  const productionRuns=runs.filter(run=>run.id!=='arbeitnow-dev' && run.id!=='tracked-ats');
  const known = new Set((request.knownUrls || []).map(normalizedUrl).filter(Boolean));
  const unique = [];
  const seenUrls = new Set();
  const seenText = new Set();
  let knownRemoved = 0;
  for (const offer of raw) {
    const urlKey = normalizedUrl(offer.url);
    const textKey = textIdentityKey(offer);
    if ((urlKey && seenUrls.has(urlKey)) || (textKey && seenText.has(textKey))) continue;
    if (urlKey) seenUrls.add(urlKey);
    if (textKey) seenText.add(textKey);
    if (known.has(urlKey)) { knownRemoved++; continue; }
    unique.push(offer);
  }
  const dedupedCount = unique.length;
  let locationRemoved = 0, locationDemoted=0, relevanceRemoved = 0, contractRemoved = 0, seniorityRemoved=0, seniorityDemoted=0, roleDemoted=0, languageDemoted=0, contractUnknownRemoved=0, contractUnknownRetained=0;
  const now = options.now ?? Date.now();
  const enriched = unique.flatMap(offer => {
    const contractOptions = inferredContractOptions(offer);
    const contractType = inferredContractType(offer,input.contractTypes);
    const contractUnknown = input.contractTypes.length > 0 && contractType === 'unknown';
    const constraints=candidateConstraints(offer,input);
    if(constraints.exclude){if(constraints.reason==='seniority')seniorityRemoved++;else relevanceRemoved++;return [];}
    if(constraints.seniorityFit==='above-target') seniorityDemoted++;
    if(constraints.roleFit==='outside-primary') roleDemoted++;
    if(constraints.languageFit==='french-development-needed') languageDemoted++;
    if (input.contractTypes.length && contractType !== 'unknown' && !input.contractTypes.includes(contractType)) { contractRemoved++; return []; }
    const retainUnknownCdi = contractUnknown && input.strictContract && input.contractTypes.includes('CDI');
    if (contractUnknown && input.strictContract && !retainUnknownCdi) { contractUnknownRemoved++; return []; }
    const semantic=options.semanticRelevance?.get(offer.url);
    let relevance = options.semanticRelevance ? (semantic?.tier==='strong'?78:semantic?.tier==='adjacent'?48:0) : searchRelevance(offer, input);
    let relevanceTier = options.semanticRelevance ? (semantic?.tier || 'none') : relevance >= (options.minimumRelevance ?? 18) ? 'strong' : 'none';
    if (relevanceTier === 'none' && !options.semanticRelevance) {
      relevance = adjacentSearchRelevance(offer, input);
      relevanceTier = relevance >= (options.minimumAdjacentRelevance ?? 28) ? 'adjacent' : 'none';
    }
    if (relevanceTier === 'none' && !options.semanticRelevance) {
      relevance = closestSearchRelevance(offer, input);
      relevanceTier = relevance >= (options.minimumClosestRelevance ?? 10) ? 'closest' : 'none';
    }
    if (relevanceTier === 'none') { relevanceRemoved++; return []; }
    if(constraints.penalty) {
      relevance=Math.max(18,relevance-constraints.penalty);
      if(constraints.forceClosest) relevanceTier='closest';
      else if(relevanceTier==='strong') relevanceTier='adjacent';
    }
    if(input.searchArea && !offerInSearchArea(offer,input.searchArea)){locationRemoved++;return [];}
    const location=locationConstraint(offer,input);
    if(location.penalty){relevance=Math.max(18,relevance-location.penalty);locationDemoted++;}
    if(location.forceClosest) relevanceTier='closest';
    const days = ageDays(offer.postedAt || offer.postedHint, now);
    const searchNotes = [...constraints.notes,...location.notes];
    if (contractOptions.length > 1) searchNotes.push(`Contrats proposés par la source : ${contractOptions.join(' / ')}.`);
    if (contractUnknown) {
      searchNotes.push(`Type de contrat à confirmer : ${input.contractTypes.join(' / ')} non prouvé par la source.`);
      if (input.strictContract) {
        relevance = Math.max(20, relevance - 12);
        if(relevanceTier!=='closest') relevanceTier = 'adjacent';
        contractUnknownRetained++;
      }
    }
    const normalized = {
      ...offer,
      languageFit:constraints.languageFit,seniorityFit:constraints.seniorityFit,roleFit:constraints.roleFit,locationFit:location.fit,searchNotes,
      contractType,
      contractOptions,
      ageDays: days,
      searchRelevance: relevance,
      relevanceTier,
      ...(semantic ? {relevanceReason:semantic.reason} : {}),
      dataQuality: dataQuality(offer),
      freshnessScore: freshnessScore(days),
      verification: 'unconfirmed',
    };
    normalized.rankScore = Math.round(normalized.searchRelevance * 0.67 + normalized.dataQuality * 0.18 + normalized.freshnessScore * 0.15 + (constraints.bonus || 0));
    normalized.why = why(normalized) + ' ' + searchNotes.join(' ');
    return [normalized];
  }).sort((a,b) => b.rankScore - a.rankScore || (a.ageDays ?? 9999) - (b.ageDays ?? 9999));
  const maximumAgeDays = Math.max(7, Number(options.maximumAgeDays ?? SEARCH_WINDOW_DAYS));
  const currentEnough = enriched.filter(offer => offer.ageDays === null || offer.ageDays <= maximumAgeDays);
  const staleRemoved = enriched.length - currentEnough.length;
  currentEnough.sort((a,b) => (a.relevanceTier === b.relevanceTier ? 0 : a.relevanceTier === 'strong' ? -1 : 1) || b.rankScore - a.rankScore || (a.ageDays ?? 9999) - (b.ageDays ?? 9999));
  const adjacentLimit = Math.max(0, Math.min(12, Number(options.adjacentLimit ?? 6)));
  const primary = currentEnough.filter(offer => offer.relevanceTier !== 'closest');
  const fallbackLimit = Math.max(1, Math.min(12, Number(options.fallbackLimit ?? input.fallbackLimit ?? 6)));
  const visiblePool = primary.length ? primary : currentEnough.filter(offer => offer.relevanceTier === 'closest').slice(0,fallbackLimit);
  let adjacentUsed = 0;
  const ranked = visiblePool.filter(offer => offer.relevanceTier !== 'adjacent' || adjacentUsed++ < adjacentLimit);
  const offers = ranked.slice(0, Math.max(1, Math.min(50, Number(options.limit || 24))));
  const metrics = summarizeSearchQuality(offers, runs, {
    rawCount: raw.length, dedupedCount, knownRemoved, locationRemoved, relevanceRemoved, now,
  });
  metrics.contractRemoved = contractRemoved;
  metrics.seniorityRemoved=seniorityRemoved;metrics.seniorityDemoted=seniorityDemoted;metrics.roleDemoted=roleDemoted;metrics.languageDemoted=languageDemoted;metrics.locationDemoted=locationDemoted;metrics.contractUnknownRemoved=contractUnknownRemoved;metrics.contractUnknownRetained=contractUnknownRetained;
  metrics.staleRemoved = staleRemoved;
  metrics.maximumAgeDays = maximumAgeDays;
  metrics.wallMs = Date.now() - started;
  return {
    offers,
    input,
    metrics,
    providerRuns: runs,
    productionProviderConfigured: productionRuns.some(run => !['unconfigured', 'disabled'].includes(run.status)),
    productionProviderSucceeded: productionRuns.some(run => ['ok', 'partial'].includes(run.status)),
  };
}
