const suspicious=/[ÃÂ]|â(?:€|€™|€œ|€œ|€“|€”|€¦)|ï»¿/g;

function badness(text) {
  return (String(text).match(suspicious) || []).length + (String(text).match(/�/g) || []).length * 4;
}

/** Repair the common UTF-8-bytes-decoded-as-Latin-1 failure from job providers.
 * The conversion is accepted only when it strictly reduces mojibake markers, so
 * legitimate names containing non-ASCII characters are left untouched. */
export function repairMojibake(value) {
  const text=String(value ?? '');
  if(!/[ÃÂâï]/.test(text))return text;
  const chars=[...text];
  if(chars.some(ch=>(ch.codePointAt(0) || 0)>255))return text;
  try {
    const decoded=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(chars,ch=>ch.codePointAt(0) || 0));
    return badness(decoded)<badness(text) ? decoded : text;
  } catch { return text; }
}

export function repairOfferText(offer={}) {
  return {...offer,
    company:repairMojibake(offer.company),
    title:repairMojibake(offer.title),
    role:repairMojibake(offer.role),
    location:repairMojibake(offer.location),
  };
}
