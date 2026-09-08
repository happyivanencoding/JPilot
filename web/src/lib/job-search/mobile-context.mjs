function list(value) {
  return Array.isArray(value) ? value.map(x => String(x || '').trim()).filter(Boolean) : [];
}

function splitCandidateLocation(value) {
  const parts = String(value || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!parts.length) return { city: '', country: '' };
  return { city: parts[0] || '', country: parts.at(-1) || '' };
}

export function searchRequestFromConfig(query, config = {}, knownUrls = []) {
  const target = config?.target_roles || {};
  const candidateLocation = splitCandidateLocation(config?.candidate?.location);
  const configuredLocation = typeof target.location === 'string' ? splitCandidateLocation(target.location) : {};
  const city = String(config?.location?.city || configuredLocation.city || candidateLocation.city || '').trim();
  const country = String(config?.location?.country || configuredLocation.country || candidateLocation.country || '').trim();
  const primary = list(target.primary);
  const archetypes = Array.isArray(target.archetypes) ? target.archetypes.filter(x => typeof x === 'string').map(x => x.trim()).filter(Boolean) : [];
  const objectArchetypes = Array.isArray(target.archetypes) ? target.archetypes.map(x => x && typeof x === 'object' ? x.name : '').filter(Boolean) : [];
  const roles = [...new Set([...primary, ...archetypes, ...objectArchetypes])].slice(0, 12);
  const remoteRaw = String(target.remote || '').toLowerCase();
  return {
    query: String(query || '').trim(),
    targetRoles: roles,
    city,
    country,
    contractTypes: list(target.contract_types),
    remote: /remote|hybrid|télétravail|teletravail/.test(remoteRaw) || /remote|télétravail|teletravail|远程/i.test(String(query || '')),
    seniority: String(target.seniority || target.archetypes?.[0]?.level || ''),
    languages: {french:String(config.languages?.french || ''),english:String(config.languages?.english || '')},
    relocation: config.location?.relocation,
    strictContract: target.contract_policy === 'confirmed_only',
    fallbackPolicy: String(target.fallback_policy || 'closest'),
    fallbackLimit: Number(target.fallback_limit || 6),
    flexibleEurope: String(target.geography_policy || '').toLowerCase() !== 'country_only',
    availableFrom: String(config.availability?.earliest || ''),
    knownUrls,
  };
}
