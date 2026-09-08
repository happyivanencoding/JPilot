"use client";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { ArrowUpRight, ChevronRight, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { usePilot, type Json } from "./pilot-context";
import { validScore, safeExternalUrl } from "./model.mjs";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`jp-card ${className}`}>{children}</section>; }
export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) { return <div className="jp-section-title"><h1>{children}</h1>{sub && <p>{sub}</p>}</div>; }
export function Hint({ children }: { children: ReactNode }) { return children ? <p className="jp-hint">{children}</p> : null; }
export function Pill({ children, warm = false }: { children: ReactNode; warm?: boolean }) { return <span className={`jp-pill${warm ? " warm" : ""}`}>{children}</span>; }
export function Button({ children, kind = "primary", className = "", disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "outline" | "text" }) {
  const { busy } = usePilot();
  return <button type="button" className={`jp-button ${kind} ${className}`} disabled={disabled || busy} {...props}>{children}</button>;
}
export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) { return <button type="button" className="jp-icon-button" aria-label={label} title={label} {...props}>{children}</button>; }
export function Chip({ children, selected = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) { return <button type="button" className={`jp-chip ${selected ? "selected" : ""}`} aria-pressed={selected} {...props}>{children}</button>; }
export function Input({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { const id = useId(); return <label className="jp-field" htmlFor={id}><span>{label}</span><input id={id} aria-label={label} {...props} /></label>; }
export function TextArea({ label, rows = 3, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) { const id = useId(); return <label className="jp-field" htmlFor={id}><span>{label}</span><textarea id={id} aria-label={label} rows={rows} {...props} /></label>; }
export function Select({ label, value, onChange, children, disabled = false }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled?: boolean }) { const id = useId(); return <label className="jp-field" htmlFor={id}><span>{label}</span><select id={id} aria-label={label} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>{children}</select></label>; }
export function Check({ children, checked, onChange, disabled = false }: { children: ReactNode; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { return <label className="jp-check"><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span>{children}</span></label>; }
export function Score({ score }: { score: unknown }) { const { tr } = usePilot(); const value = validScore(score); return <div className="jp-score"><strong>{value == null ? "—" : value.toFixed(1)}</strong><small>{value == null ? tr("待评估", "À évaluer", "Unrated") : tr("匹配 / 5", "Match / 5", "Fit / 5")}</small></div>; }
export function External({ url, children }: { url: unknown; children: ReactNode }) { const safe = safeExternalUrl(url); return safe ? <a className="jp-external" href={safe} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={16} /></a> : null; }
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <Card><h3>{title}</h3><Hint>{children}</Hint></Card>; }
export function RowLink({ children, trailing, onClick, testId }: { children: ReactNode; trailing?: ReactNode; onClick: () => void; testId?: string }) { return <button className="jp-row-link" type="button" onClick={onClick} data-testid={testId}><span>{children}</span>{trailing}<ChevronRight size={18} /></button>; }
export function Tabs({ labels, selected, onChange, prefix = "tab" }: { labels: string[]; selected: number; onChange: (tab: number) => void; prefix?: string }) { return <div className="jp-tabs" role="tablist">{labels.map((label, i) => <button type="button" key={i} role="tab" aria-selected={selected === i} data-testid={`${prefix}-${i}`} onClick={() => onChange(i)}>{label}</button>)}</div>; }
export function Markdown({ text }: { text?: string }) { return text ? <div className="jp-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <External url={href}>{children}</External>, img: ({ alt }) => <span>{alt}</span>, table: ({ children }) => <div className="jp-table-scroll"><table>{children}</table></div> }}>{text}</ReactMarkdown></div> : null; }
export function Spinner({ small = false }: { small?: boolean }) { return <span className={`jp-spinner ${small ? "small" : ""}`} aria-hidden="true" />; }
export function Loading({ children }: { children?: ReactNode }) { const { tr } = usePilot(); return <div className="jp-loading" role="status"><Spinner /><Hint>{children || tr("正在读取你的档案…", "Chargement de votre profil…", "Loading your profile…")}</Hint></div>; }
export function Localization({ value, onRetry }: { value?: Json; onRetry?: () => void }) {
  const { tr, retryLocalization } = usePilot();
  if (!value?.pending) return null;
  return <aside className="jp-localization" data-testid="localization-status" aria-live="polite"><p>{value.message || tr("正在翻译已有结果，不会重新分析。", "Traduction du résultat enregistré, sans nouvelle analyse.", "Translating the saved result, without reanalysis.")}</p>{value.failed ? <Button kind="text" onClick={onRetry || retryLocalization}>{tr("重试显示翻译", "Réessayer la traduction", "Retry translation")}</Button> : <div className="jp-progress indeterminate" />}</aside>;
}
export function Metrics({ value }: { value?: Json }) {
  const { tr } = usePilot(); if (!value) return null;
  const parts: string[] = [];
  if (value.wallMs != null) { const s = Math.floor(value.wallMs / 1000); parts.push(s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`); }
  if (value.totalTokens != null) parts.push(`${Number(value.totalTokens).toLocaleString()} tokens`);
  else parts.push(tr("Token 未提供", "Tokens non disponibles", "Tokens unavailable"));
  if (value.estimatedCostUsd != null) parts.push(`${tr("API 等价估算", "Équiv. API estimé", "API equivalent estimate")} $${Number(value.estimatedCostUsd).toFixed(4)}`);
  return <Hint>{parts.join(" · ")}</Hint>;
}
export function taskName(kind: string, tr: (z: string, f: string, e?: string) => string) {
  const names: Record<string, [string, string, string]> = { ingest: ["简历导入", "Import du CV", "CV import"], search: ["岗位搜索", "Recherche d’offres", "Offer search"], evaluate: ["岗位评估", "Évaluation du poste", "Job evaluation"], cv: ["定制简历", "CV adapté", "Tailored CV"], rewrite: ["简历草稿", "Brouillon du CV", "CV draft"], report: ["岗位评估报告", "Rapport d’évaluation", "Evaluation report"], analysis: ["简历与能力", "CV et compétences", "CV and skills"], plan: ["面试准备", "Préparation de l’entretien", "Interview preparation"], practice: ["面试练习反馈", "Simulation d’entretien", "Interview practice"], compare: ["岗位对比", "Comparaison des offres", "Offer comparison"] };
  return tr(...(names[kind] || ["职业建议", "Conseil de carrière", "Career advice"]));
}
export function Sheet({ title, children, footer, full = false, onClose, testId }: { title?: ReactNode; children: ReactNode; footer?: ReactNode; full?: boolean; onClose?: () => void; testId?: string }) {
  const { close, tr, error, setError } = usePilot(); const dismiss = onClose || close;
  const dialog = useRef<HTMLDivElement>(null); const dismissRef = useRef(dismiss); dismissRef.current = dismiss;
  const id = useId(); const drag = useRef<number | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>(".jp-close")?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <div className={`jp-overlay ${full ? "full" : ""}`} onClick={e => { if (e.target === e.currentTarget) dismiss(); }}>
    <div className="jp-sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={dialog} data-testid={testId} onKeyDown={e => {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); dismissRef.current(); }
      if (e.key === "Tab") { const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]') || []).filter(el => el.getClientRects().length > 0); const first = items[0], last = items.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    }}>
      {!full && <div className="jp-grip-zone" onPointerDown={e => { drag.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerUp={e => { if (drag.current != null && e.clientY - drag.current > 70) dismiss(); drag.current = null; }}><span className="jp-grip" /></div>}
      <header className="jp-sheet-header"><h2 id={id}>{title || tr("JobPilot 详情", "Détails JobPilot", "JobPilot details")}</h2><button className="jp-icon-button jp-close" type="button" aria-label={tr("关闭", "Fermer", "Close")} data-testid="close-sheet" onClick={dismiss}><X size={22} /></button></header>
      {error && <div className="jp-error" role="alert"><p>{error}</p><IconButton label={tr("关闭提示", "Fermer le message", "Dismiss message")} onClick={() => setError(null)}><X size={18} /></IconButton></div>}
      {children}
      {footer && <footer className="jp-sheet-footer">{footer}</footer>}
    </div>
  </div>;
}
