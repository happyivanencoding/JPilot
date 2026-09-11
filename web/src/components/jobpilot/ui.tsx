"use client";
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { ArrowUpRight, ChevronRight, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {estimatedProgress} from "@/lib/v1-progress.mjs";
import { rows, usePilot, type Json } from "./pilot-context";
import { validScore, safeExternalUrl } from "./model.mjs";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`jp-card ${className}`}>{children}</section>; }
export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) { return <div className="jp-section-title"><h1>{children}</h1>{sub && <p>{sub}</p>}</div>; }
export function Hint({ children }: { children: ReactNode }) { return children ? <p className="jp-hint">{children}</p> : null; }
export function Pill({ children, warm = false }: { children: ReactNode; warm?: boolean }) { return <span className={`jp-pill${warm ? " warm" : ""}`}>{children}</span>; }
export function Button({ children, kind = "primary", className = "", disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "outline" | "text" }) {
  const { busy } = usePilot();
  return <button type="button" className={`jp-button ${kind} ${className}`} disabled={disabled || busy} {...props}>{children}</button>;
}
export function AiProgressButton({taskKind,jobId,offerUrl,children,kind="primary",className="",disabled,onClick,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{taskKind:string;jobId?:string;offerUrl?:string;kind?:"primary"|"outline"|"text"}) {
  const {data,tr,busy,error,notice}=usePilot();
  const [now,setNow]=useState(()=>Date.now()),[clickedAt,setClickedAt]=useState(0),[finishedAt,setFinishedAt]=useState(0);
  const observed=useRef(false);
  const candidate=taskKind==="search"?data.v1?.searchProgress:rows(data.tasks).filter(t=>t.kind===taskKind&&(!jobId||t.jobId===jobId)&&(!offerUrl||t.url===offerUrl)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
  const task=candidate&&(!clickedAt||Date.parse(candidate.createdAt)>=clickedAt-1500||!busy&&candidate.id===notice?.taskId)?candidate:null;
  const status=clickedAt&&error&&!busy?"failed":task?.status || (clickedAt?"queued":"");
  const active=["queued","running","reconciling"].includes(status),completed=status==="completed",failed=["failed","interrupted"].includes(status);
  useEffect(()=>{
    if(active){observed.current=true;setFinishedAt(0);}else if((completed||failed)&&(observed.current||clickedAt))setFinishedAt(old=>old||Date.now());
    if(!active&&!(completed&&observed.current))return;
    const timer=setInterval(()=>setNow(Date.now()),80);
    const stop=!active?setTimeout(()=>{clearInterval(timer);setNow(Date.now());},1600):undefined;
    return ()=>{clearInterval(timer);if(stop)clearTimeout(stop);};
  },[task?.id,task?.createdAt,status,clickedAt]);
  const visible=active||failed&&!!clickedAt||completed&&!!finishedAt&&now-finishedAt<1600;
  const start=clickedAt||Date.parse(task?.createdAt||"")||now;
  const elapsed=Math.max(0,((finishedAt||now)-start)/1000);
  const pct=Math.round(estimatedProgress(elapsed,visible?status:"",Number(task?.estimate?.targetSeconds||90))*100);
  const label=completed&&visible?<>{tr("已完成","Terminé","Completed")} 100%</>:failed&&visible?tr("未完成，请重试","Réessayez","Please retry"):active?<>{taskKind==="search"?task?.label||children:children} <span className="jp-ai-percent">≈{pct}%</span></>:children;
  return <button type="button" {...props} onClick={e=>{setClickedAt(Date.now());setNow(Date.now());setFinishedAt(0);onClick?.(e);}} className={`jp-button ${kind} jp-ai-button ${visible?"liquid":""}${failed&&visible?" failed":""} ${className}`} disabled={disabled||busy||active} aria-busy={active||undefined} style={{...props.style,"--jp-ai-progress":`${pct}%`} as CSSProperties}>
    {visible&&<span className="jp-ai-button-fill" aria-hidden="true"/>}<span className="jp-ai-button-label">{label}</span>
  </button>;
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
function remainingText(seconds: number, tr: (z: string, f: string, e?: string) => string) {
  if (seconds < 60) return tr(`预计剩余 ${seconds} 秒`, `Environ ${seconds} s restantes`, `About ${seconds} s remaining`);
  const minutes = Math.ceil(seconds / 60);
  return tr(`预计剩余约 ${minutes} 分钟`, `Environ ${minutes} min restantes`, `About ${minutes} min remaining`);
}
export function EstimatedProgress({ createdAt, estimate, large = false, status }: { createdAt?: string; estimate?: Json; large?: boolean; status?: string }) {
  const { tr } = usePilot();
  const target = Number(estimate?.targetSeconds || estimate?.maxSeconds || 0);
  const started = Date.parse(createdAt || "");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target || !Number.isFinite(started)) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [createdAt, started, target]);
  if (!target || !Number.isFinite(started)) return <Hint>{estimate?.label || tr("正在估算耗时", "Estimation en cours", "Estimating duration")}</Hint>;
  const elapsed = Math.max(0, (now - started) / 1000);
  const completed = status === "completed";
  const overdue = !completed && elapsed >= target;
  const remaining = Math.max(0, target - Math.floor(elapsed));
  // This ring visualizes elapsed time against an ETA, not model-reported progress.
  // The asymptotic curve slows near the end and stays below 100% until a real
  // terminal state arrives, then snaps to the final position.
  const progress = completed ? 1 : Math.min(.96, Math.max(.04, .96 * (1 - Math.exp(-3 * elapsed / target))));
  const center = completed ? "✓" : overdue ? "…" : remaining < 60 ? `${remaining}s` : `${Math.ceil(remaining / 60)}m`;
  const style = { "--jp-task-progress": `${progress * 360}deg` } as CSSProperties;
  const progressText = completed ? tr("已完成", "Terminé", "Completed") : overdue ? tr("已超过预计时间，仍在处理中", "Durée estimée dépassée · toujours en cours", "Estimated time exceeded · still processing") : remainingText(remaining, tr);
  return <div className={`jp-estimated-progress${large ? " large" : ""}`} role="status" aria-label={progressText}>
    <span className="jp-estimated-ring" style={style}><span>{center}</span></span>
    <span className="jp-estimated-copy"><strong>{progressText}</strong><small>{estimate?.label}</small></span>
  </div>;
}
export function Loading({ children }: { children?: ReactNode }) { const { tr } = usePilot(); return <div className="jp-loading" role="status"><Spinner /><Hint>{children || tr("正在读取你的档案…", "Chargement de votre profil…", "Loading your profile…")}</Hint></div>; }
export function Localization({ value, onRetry }: { value?: Json; onRetry?: () => void }) {
  const { tr, retryLocalization } = usePilot();
  if (!value?.pending) return null;
  return <aside className="jp-localization" data-testid="localization-status" aria-live="polite"><p>{value.message || tr("正在翻译已有结果，不会重新分析。", "Traduction du résultat enregistré, sans nouvelle analyse.", "Translating the saved result, without reanalysis.")}</p>{value.failed ? <Button kind="text" onClick={onRetry || retryLocalization}>{tr("重试显示翻译", "Réessayer la traduction", "Retry translation")}</Button> : <div className="jp-progress indeterminate" />}</aside>;
}
export function taskName(kind: string, tr: (z: string, f: string, e?: string) => string) {
  const names: Record<string, [string, string, string]> = { ingest: ["简历导入", "Import du CV", "CV import"], search: ["岗位搜索", "Recherche d’offres", "Offer search"], evaluate: ["岗位评估", "Évaluation du poste", "Job evaluation"], cv: ["定制简历", "CV adapté", "Tailored CV"], cv_review: ["重新评估简历草稿", "Réévaluation du CV adapté", "Reassess tailored CV"], rewrite: ["简历草稿", "Brouillon du CV", "CV draft"], report: ["岗位评估报告", "Rapport d’évaluation", "Evaluation report"], analysis: ["简历与能力", "CV et compétences", "CV and skills"], plan: ["面试准备", "Préparation de l’entretien", "Interview preparation"], practice: ["面试练习反馈", "Simulation d’entretien", "Interview practice"], compare: ["岗位对比", "Comparaison des offres", "Offer comparison"] };
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
