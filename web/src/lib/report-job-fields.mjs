// Report prose can be Chinese, French or English. Section letters and machine
// keys remain stable; no user-facing label is a business-language authority.
export function reportTableValue(markdown, ...labels) {
  for (const label of labels) {
    const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const value=markdown.match(new RegExp(`^\\|\\s*${escaped}\\s*\\|\\s*([^|]+)\\|`,'im'))?.[1]?.trim();
    if(value)return value;
  }
  return '';
}
export function blockBMatches(markdown) {
  const body=markdown.match(/(?:^|\n)##\s+B[)）.．][^\n]*\n([\s\S]*?)(?=\n##\s+[A-Z][)）.．]|\n##\s+(?:Risk Summary|风险总结)|$)/i)?.[1] || '';
  const rows=body.split(/\r?\n/).filter(line=>/^\|.+\|$/.test(line)).map(line=>line.split('|').slice(1,-1).map(cell=>cell.trim()));
  const separator=rows.findIndex(cells=>cells.every(cell=>/^:?-{3,}:?$/.test(cell)));
  return (separator>=0?rows.slice(separator+1):rows).filter(cells=>cells.length>=3 && !/exigence|requirement|岗位要求|职位要求|---/i.test(cells[0])).slice(0,8).map(cells=>{
    const raw=cells[2] || '';
    const fit=/écart|gap|absent|no match|not match|unmatched|not met|not satisfied|missing|差距|缺口|缺失|不足|不匹配|不符合|未满足|未证明|未覆盖/i.test(raw) ? 'Écart'
      : /partiel|partial|部分|有限/i.test(raw) ? 'Partiel'
      : /fort|strong|match|satisfied|符合|匹配|满足|充分|✅/i.test(raw) ? 'Fort' : 'À confirmer';
    return {requirement:cells[0],evidence:cells[1],fit,action:fit==='Fort'?'Préparer un exemple concret et chiffré si possible.':'Préparer une réponse honnête et montrer l’expérience adjacente transférable.'};
  });
}
