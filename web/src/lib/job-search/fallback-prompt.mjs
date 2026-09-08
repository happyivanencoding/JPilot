import {explanationDirective} from '../language-contract.mjs';
function clean(value, max = 4000) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

/** @param {{query: string, targetRoles?: string[], city?: string, country?: string, contractTypes?: string[], knownUrls?: string[], seniority?:string, languages?:any, relocation?:boolean, strictContract?:boolean, availableFrom?:string,uiLocale?:string}} request */
export function buildSearchFallbackPrompt({ query, targetRoles = [], city = '', country = '', contractTypes = [], knownUrls = [], seniority = '', languages = {}, relocation, strictContract=false, availableFrom='', uiLocale='fr' }) {
  const brief = {
    targetRoles: targetRoles.map(x => clean(x, 160)).filter(Boolean).slice(0, 10),
    location: [clean(city, 100), clean(country, 100)].filter(Boolean).join(', '),
    contractTypes: contractTypes.map(x => clean(x, 60)).filter(Boolean),
    seniority,languages,relocation,strictContract,availableFrom,
  };
  const known = knownUrls.filter(Boolean).slice(0, 120);
  return `${explanationDirective(uiLocale)} The offer.why field is an explanation in the UI language; retain the source job title, company and original JD excerpts.\nTu es le moteur de secours de découverte d'offres de JobPilot. Cette tâche est une recherche web courte en lecture seule, pas une évaluation du candidat.

BUT
- Trouver des offres ACTUELLEMENT ouvertes correspondant à la demande et au bref de ciblage ci-dessous.
- Faire au maximum 2 recherches web ciblées. Ouvrir au plus 4 pages finales pour vérifier les candidats les plus prometteurs. Arrêter dès que 3 à 6 offres crédibles sont trouvées.
- Privilégier les pages carrière employeur et les ATS directs. Ne pas remplir la liste avec des postes hors cible.
- Ne lire aucun CV, fichier candidat, rapport ou mémoire locale : le bref ci-dessous contient tout le contexte autorisé pour cette recherche.
- Aucun score de compatibilité. Aucune invention de compétence. Une offre reste non confirmée jusqu'à son évaluation formelle.
- Respecter la séniorité et les langues documentées. Pour junior, exclure senior et 3–5 ans requis. Un français B1 diminue les postes de rédaction/clients français mais ne doit pas exclure les équipes internationales. Si strictContract, retenir seulement les contrats explicitement CDI. Si relocation=false, rester dans Paris/Île-de-France même en hybrid. Ne pas inventer une disponibilité immédiate quand availableFrom est futur.
- Respecter les contrats demandés lorsqu'ils sont vérifiables. Ne pas déduire CDI de « full-time ».

SORTIE
Pour chaque offre retenue, une ligne unique hors bloc de code :
<<offer:{"url":"https://…","title":"…","company":"…","location":"…","source":"ai-fallback","why":"…","postedHint":"date ISO ou chaîne vide","description":"exigences réelles de langue, expérience, contrat et début, avec citation courte de la page","direct":true,"ats":"…","contractType":"Stage|Alternance|CDI|CDD|unknown","verification":"unconfirmed"}>>
JSON valide sur une seule ligne. URL du poste concret, pas une page générique.

BRIEF DE CIBLAGE
${JSON.stringify(brief)}

DEMANDE
${clean(query, 2000)}

URL DÉJÀ CONNUES — ne pas reproposer
${known.length ? known.join('\n') : '(aucune)'}
`;
}
