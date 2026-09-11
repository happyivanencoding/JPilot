const active = status => ['queued', 'running', 'reconciling'].includes(status);
const failed = status => ['failed', 'interrupted'].includes(status);
const text = (locale, zh, fr, en) => locale === 'zh' ? zh : locale === 'fr' ? fr : en;

export function cvFailure(error, phase, locale = 'en') {
  const raw = String(error || '');
  const credit = /no credits remaining|insufficient_quota|insufficient (?:balance|credit)|balance.*insufficient|credit.*exhaust|余额不足/i.test(raw);
  return {
    code: phase === 'read' ? 'cv-read-failed' : credit ? 'ai-credit-exhausted' : phase === 'translate' ? 'insight-translation-failed' : 'cv-analysis-failed',
    message: phase === 'read'
      ? text(locale, '这份文件暂时无法读取，请重新选择 PDF 或 Word。', 'Ce fichier ne peut pas être lu. Choisissez un autre PDF ou Word.', 'This file could not be read. Choose another PDF or Word file.')
      : credit
        ? text(locale, '简历已保存。分析服务额度暂时不足，恢复后可继续，无需重新上传。', 'Votre CV est enregistré. Le service d’analyse a épuisé son crédit. Reprenez une fois le service rétabli, sans renvoyer le CV.', 'Your CV is saved. The analysis service is out of credit. Continue once service is restored; no need to upload again.')
        : text(locale, '简历已保存，这一步暂未完成。可以直接继续，不用重新上传。', 'Votre CV est enregistré. Cette étape n’a pas abouti. Reprenez sans renvoyer le fichier.', 'Your CV is saved. This step did not finish. Continue without uploading it again.'),
  };
}

// The percentage is an estimate spanning extraction, analysis and translation.
// Only a display-ready analysis is complete; failures never turn into 100%.
export function cvProgress(snapshot, tasks, journey, readiness, locale = 'en') {
  const ingest = tasks.find(t => t.kind === 'ingest' && t.id === journey.ingestTaskId);
  const analysis = tasks.find(t => t.kind === 'analysis' && t.inputVersionId === snapshot.cvState?.versionId);
  if (!ingest && !analysis && !snapshot.cv) return null;
  const reading = active(ingest?.status);
  const phase = reading || failed(ingest?.status) ? 'read' : active(analysis?.status) || snapshot.v1.analysisState !== 'completed' ? 'analyze' : 'translate';
  const broken = failed(ingest?.status) || (!reading && failed(analysis?.status) && !readiness.ready) || readiness.translationFailed;
  const status = broken ? 'failed' : readiness.ready && !reading ? 'completed' : 'running';
  const source = phase === 'read' ? ingest : analysis;
  const createdAt = analysis?.input?.source === 'v1-retry' ? analysis.createdAt : ingest?.createdAt || analysis?.createdAt || snapshot.cvState?.changedAt;
  const labels = {
    read: ['正在读取简历', 'Lecture de votre CV', 'Reading your CV'],
    analyze: ['正在发现你的优势', 'Découverte de vos atouts', 'Finding your strengths'],
    translate: ['正在准备你的方向建议', 'Préparation de vos pistes', 'Preparing your directions'],
  };
  return {
    id: ingest?.id || analysis?.id || snapshot.cvState?.versionId,
    kind: 'cv-analysis', status, phase, createdAt, updatedAt: source?.updatedAt || createdAt,
    estimate: {targetSeconds: 55},
    label: status === 'completed' ? text(locale, '准备好了', 'Tout est prêt', 'Ready for you') : labels[phase][locale === 'zh' ? 0 : locale === 'fr' ? 1 : 2],
    failure: broken ? cvFailure(source?.error, phase, locale) : null,
  };
}
