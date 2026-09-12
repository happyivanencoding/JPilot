"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Minus, Plus, Share2 } from "lucide-react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import { texts, usePilot, type Json } from "./pilot-context";
import { pendingDisplay } from "./model.mjs";
import { Button, Hint, IconButton, Loading, Localization, Pill, Sheet, Tabs } from "./ui";

function PdfPage({ pdf, index, width }: { pdf: PDFDocumentProxy; index: number; width: number }) {
  const { tr } = usePilot();
  const box = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(index === 1), [ratio, setRatio] = useState(210 / 297), [rendered, setRendered] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), { rootMargin: "300px" });
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !canvas.current) return;
    let disposed = false, render: RenderTask | undefined;
    const target = canvas.current;
    setRendered(false); setFailed(false);
    void (async () => {
      try {
        const page = await pdf.getPage(index);
        if (disposed) return;
        const dimensions = page.getViewport({ scale: 1 });
        setRatio(dimensions.width / dimensions.height);
        const pixelWidth = Math.min(2000, width * Math.min(devicePixelRatio || 1, 2));
        const viewport = page.getViewport({ scale: pixelWidth / dimensions.width });
        target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height);
        render = page.render({ canvas: target, viewport });
        await render.promise;
        if (!disposed) setRendered(true);
      } catch (e) { if (!disposed && (e as Error)?.name !== "RenderingCancelledException") setFailed(true); }
    })();
    return () => { disposed = true; render?.cancel(); target.width = 0; target.height = 0; };
  }, [pdf, index, width, visible]);
  return <div ref={box} className="jp-pdf-page" style={{ width, aspectRatio: String(ratio), position: "relative" }} data-rendered={rendered} data-page={index}>
    <canvas ref={canvas} aria-label={tr(`PDF 第 ${index} 页`, `PDF · page ${index}`, `PDF · page ${index}`)} />
    {visible && !rendered && <div style={{ position: "absolute", inset: 0, color: "#1c3037" }}><Loading>{failed ? tr("此页无法显示，请下载原始 PDF 查看。", "Cette page ne peut pas être affichée. Téléchargez le PDF original.", "Unable to display this page. Download the original PDF.") : tr("正在读取实际 PDF", "Chargement du PDF réel", "Loading the actual PDF")}</Loading></div>}
  </div>;
}
export function PdfPreview() {
  const { data, route, tr, product, request, documentBytes, fail, act, close, busy } = usePilot();
  const job = data.jobs?.find((j: Json) => j.id === route.job);
  const draft = route.draft || "";
  const tailoredDraft = Boolean(job && draft && job.cvDraft?.id === draft);
  const masterDraft = Boolean(draft && !route.job);
  const [compareMode,setCompareMode]=useState("");
  const [meta, setMeta] = useState<Json | null>(null), [pdf, setPdf] = useState<PDFDocumentProxy | null>(null), [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [tab, setTab] = useState(masterDraft ? 1 : 0), [zoom, setZoom] = useState(1), [width, setWidth] = useState(340), [failed, setFailed] = useState(false);
  const scroll = useRef<HTMLDivElement>(null), zoomRef = useRef(zoom); zoomRef.current = zoom;
  const basePath = masterDraft ? `/api/mobile/cv?draftId=${encodeURIComponent(draft)}` : "/api/mobile/cv?original=1";
  const baselineVersionId=String(tailoredDraft?job?.cvDraft?.baseVersionId||"":job?.cv?.inputVersionId||"");
  const originalComparePath=baselineVersionId?`/api/mobile/cv?original=1&versionId=${encodeURIComponent(baselineVersionId)}`:"";
  const loadMeta = useCallback(async (retry = false) => {
    if (route.job) {
      if(compareMode==="baseline"&&originalComparePath) {
        try { setMeta(await request(`${originalComparePath}&format=meta`)); }
        catch (e) { if ((e as Error)?.name !== "AbortError") { setFailed(true); fail(e); } }
      } else setMeta(tailoredDraft ? { title: job?.company, pages: job?.cvDraft?.pages, tailoredDraft: job?.cvDraft } : { title: job?.company, pages: job?.cv?.pages });
      return;
    }
    try { setMeta(await request(`${basePath}${basePath.includes("?") ? "&" : "?"}format=meta${retry ? "&retryLocalization=1" : ""}`)); }
    catch (e) { if ((e as Error)?.name !== "AbortError") { setFailed(true); fail(e); } }
  }, [request, basePath, route.job, compareMode, originalComparePath, tailoredDraft, job?.company, job?.cv?.pages, job?.cvDraft, fail]);
  useEffect(() => { setFailed(false); void loadMeta(); }, [loadMeta]);
  useEffect(() => { if (!pendingDisplay(meta)) return; const timer = setTimeout(() => void loadMeta(), 2500); return () => clearTimeout(timer); }, [meta, loadMeta]);
  const cleanSource = route.job ? compareMode==="baseline"&&originalComparePath ? meta?.exactOriginal!==undefined ? originalComparePath : "" : `/api/candidatures/cv?id=${encodeURIComponent(route.job)}${tailoredDraft ? `&draftId=${encodeURIComponent(draft)}` : ""}` : !meta ? "" : masterDraft && tab === 0 ? `/api/mobile/cv?versionId=${encodeURIComponent(meta.draft?.baseVersionId || "")}` : basePath;
  const source=cleanSource+(route.job && compareMode && compareMode!=="baseline" ? `&compare=${compareMode}` : "");
  const exactOriginal=meta?.exactOriginal===true&&!masterDraft;
  const originalMime=exactOriginal?String(meta?.original?.mime||""):"";
  const nonPdfOriginal=Boolean(exactOriginal&&originalMime&&originalMime!=="application/pdf");
  useEffect(() => {
    if (!source) return;
    let disposed = false, loadingTask: PDFDocumentLoadingTask | undefined;
    setPdf(null); setBytes(null); setFailed(false);
    void (async () => {
      try {
        const buffer=await documentBytes(source);
        if (disposed) return;
        setBytes(buffer);
        if(nonPdfOriginal)return;
        if (String.fromCharCode(...buffer.slice(0, 5)) !== "%PDF-") throw new Error(tr("服务器未返回 PDF。", "Le serveur n’a pas renvoyé de PDF.", "The server did not return a PDF."));
        const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
        if(disposed)return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/jobpilot-pdf/pdf.worker.min.mjs";
        // Transfer a copy into the worker. Keep the exact source bytes for download/share.
        loadingTask = pdfjs.getDocument({ data: buffer.slice(), cMapUrl: "/jobpilot-pdf/cmaps/", cMapPacked: true, standardFontDataUrl: "/jobpilot-pdf/standard_fonts/", wasmUrl: "/jobpilot-pdf/wasm/" });
        const document = await loadingTask.promise;
        if (disposed) { await loadingTask.destroy(); return; }
        setPdf(document);
      } catch (e) { if (!disposed && (e as Error)?.name !== "AbortError") { setFailed(true); fail(e); } }
    })();
    return () => { disposed = true; void loadingTask?.destroy(); };
  }, [source, documentBytes, fail, tr, nonPdfOriginal]);
  useEffect(() => {
    const element = scroll.current; if (!element) return;
    const resize = new ResizeObserver(() => setWidth(Math.max(200, element.clientWidth - 24)));
    resize.observe(element);
    let initial: { distance: number; scale: number } | null = null;
    const distance = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const start = (e: TouchEvent) => { if (e.touches.length === 2) initial = { distance: distance(e), scale: zoomRef.current }; };
    const move = (e: TouchEvent) => { if (initial && e.touches.length === 2) { e.preventDefault(); setZoom(Math.min(3, Math.max(1, initial.scale * distance(e) / initial.distance))); } };
    const end = () => { initial = null; };
    element.addEventListener("touchstart", start, { passive: true }); element.addEventListener("touchmove", move, { passive: false }); element.addEventListener("touchend", end);
    return () => { resize.disconnect(); element.removeEventListener("touchstart", start); element.removeEventListener("touchmove", move); element.removeEventListener("touchend", end); };
  }, []);
  const fileName=exactOriginal?String(meta?.original?.filename||"Onward-CV"):"Onward-CV.pdf";
  const fileMime=exactOriginal?(originalMime||"application/octet-stream"):"application/pdf";
  const file = useMemo(() => bytes ? new File([bytes.slice().buffer], fileName, { type: fileMime }) : null, [bytes,fileName,fileMime]);
  const download = () => { if (!file) return; const url = URL.createObjectURL(file); const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); };
  const canShare = Boolean(file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] }));
  const pending = meta?.draft?.status === "pending", allowed = !meta?.draft?.globalPlan || meta?.layout?.acceptable;
  const tailored = tailoredDraft ? job?.cvDraft : null;
  const tailoredAssessment=tailored?.assessment || {};
  const compareControls=route.job ? <div className="jp-chips" data-testid="role-cv-compare"><Button kind={!compareMode?"primary":"outline"} data-testid="compare-role-cv" onClick={()=>{setCompareMode("");setZoom(1);}}>{tr("岗位版简历","CV ciblé","Role CV")}</Button><Button kind={compareMode==="baseline"?"primary":"outline"} onClick={()=>{setCompareMode("baseline");setZoom(1);}}>{tr("原简历","CV original","Original CV")}</Button></div> : null;
  const tailoredFooter=tailoredDraft ? <>{!job?.v1Match&&<><div className="jp-cv-score-delta"><div><span>{tr("当前主简历", "CV actuel", "Current master CV")}</span><strong>{tailoredAssessment.baselineScore ?? "—"}</strong></div><span className="jp-cv-score-arrow">→</span><div><span>{tr("这个草稿", "Ce brouillon", "This draft")}</span><strong>{tailoredAssessment.draftScore ?? "—"}</strong></div>{tailoredAssessment.delta != null && <Pill warm={tailoredAssessment.delta < 0}>{tailoredAssessment.delta >= 0 ? "+" : ""}{tailoredAssessment.delta}</Pill>}</div><Hint>ATS {tailored?.atsScore ?? "—"}/100 · {tailored?.atsPass ? tr("通过", "validé", "pass") : tr("有风险待检查", "alertes à vérifier", "risks to review")}</Hint></>}{tailored?.status === "pending" ? <><Button data-testid="accept-tailored-draft-preview" disabled={busy || !pdf} onClick={async()=>{if(await act({action:"decideTailoredCvDraft",draftId:draft,decision:"accept"}))close();}}>{tr("保留这个版本", "Conserver cette version", "Keep this version")}</Button><Button kind="outline" onClick={async()=>{if(await act({action:"decideTailoredCvDraft",draftId:draft,decision:"reject"}))close();}}>{tr("不要这个版本", "Refuser cette version", "Reject this version")}</Button></> : <Hint>{tr("这份草稿已经处理。", "Ce brouillon a déjà été traité.", "This draft has already been reviewed.")}</Hint>}</> : undefined;
  return <Sheet full title={tailoredDraft ? tr("检查岗位专属简历草稿", "Vérifier le brouillon adapté au poste", "Review tailored CV draft") : masterDraft ? tr("检查简历草稿", "Vérifier le brouillon", "Review draft") : tr("原始简历", "CV original", "Original CV")} testId="pdf-preview" footer={route.job ? <>{compareControls}{tailoredFooter}</> : (masterDraft ? <>
    {meta?.layout && <Hint>{tr(`${meta.pages} 页 · ${meta.layout.lines} 行 · ${meta.layout.bullets} 条描述 · ${meta.layout.fontPt} 磅`, `${meta.pages} page(s) · ${meta.layout.lines} lignes · ${meta.layout.bullets} puces · ${meta.layout.fontPt} pt`, `${meta.pages} page(s) · ${meta.layout.lines} lines · ${meta.layout.bullets} bullets · ${meta.layout.fontPt} pt`)}</Hint>}
    {!allowed && <Hint>{texts(meta?.layout?.issues).join(" ")}</Hint>}<Hint>{tr("请检查真实经历、页数、换行和内容。", "Vérifiez les faits, les sauts de page et la lisibilité.", "Check facts, page breaks and readability.")}</Hint>
    {pending ? <><Button data-testid="accept-draft" disabled={!allowed || busy || !pdf} onClick={async () => { if (await act({ action: "decideCvDraft", draftId: draft, decision: "accept" })) close(); }}>{tr("接受并保存", "Accepter et enregistrer", "Accept and save")}</Button><Button kind="outline" data-testid="reject-draft" onClick={async () => { if (await act({ action: "decideCvDraft", draftId: draft, decision: "reject" })) close(); }}>{tr("拒绝，保留原版", "Refuser · garder l’original", "Reject · keep original")}</Button></> : meta && <Hint>{tr("已处理的历史草稿", "Brouillon historique déjà traité", "Historical draft already reviewed")}</Hint>}
  </> : exactOriginal ? <Hint>{tr("这里显示的是你当时上传的原始文件，未经重新排版或改写。", "Ce fichier est exactement celui que vous avez importé, sans remise en page ni réécriture.", "This is the exact file you uploaded, without reformatting or rewriting.")}</Hint> : meta?.exactOriginal===false ? <Hint>{tr("这份历史简历没有保留原始上传文件，当前只能显示系统保存的内容预览。", "Le fichier importé d’origine n’est plus disponible pour cette version historique ; seul l’aperçu enregistré peut être affiché.", "The original upload is unavailable for this historic version; only the saved-content preview can be shown.")}</Hint> : meta?.layoutNote ? <Hint>{product(meta.layoutNote)}</Hint> : undefined)}>
    {masterDraft && <Tabs labels={[tr("当前版本", "Version actuelle", "Current version"), tr("修改后的草稿", "Brouillon proposé", "Proposed draft")]} selected={tab} onChange={i => { setTab(i); setZoom(1); if (scroll.current) scroll.current.scrollTop = 0; }} prefix="cv-preview-tab" />}
    <Localization value={meta?.localization} onRetry={() => void loadMeta(true)} />{texts(meta?.warnings).map((warning, i) => <div key={i} style={{ padding: "4px 16px", color: "var(--jp-error)", fontSize: 12 }}>{product(warning)}</div>)}
    <div className="jp-pdf-controls"><IconButton label={tr("缩小", "Réduire", "Zoom out")} disabled={nonPdfOriginal||zoom <= 1} onClick={() => setZoom(Math.max(1, zoom - .25))}><Minus size={18} /></IconButton><span>{nonPdfOriginal?fileName:`${Math.round(zoom * 100)}% · ${pdf?.numPages ?? "—"} ${tr("页", "pages", "pages")}`}</span><IconButton label={tr("放大", "Agrandir", "Zoom in")} disabled={nonPdfOriginal||zoom >= 3} onClick={() => setZoom(Math.min(3, zoom + .25))}><Plus size={18} /></IconButton><IconButton label={exactOriginal?tr("下载原文件","Télécharger le fichier original","Download original file"):tr("下载 PDF", "Télécharger le PDF", "Download PDF")} disabled={!file||Boolean(compareMode&&!exactOriginal)} onClick={download}><Download size={20} /></IconButton>{canShare && (!compareMode||exactOriginal) && <IconButton label={exactOriginal?tr("分享原文件","Partager le fichier original","Share original file"):tr("分享 PDF", "Partager le PDF", "Share PDF")} onClick={() => { if (file) void navigator.share({ files: [file] }).catch(e => { if (e.name !== "AbortError") fail(e); }); }}><Share2 size={20} /></IconButton>}</div>
    <div className="jp-pdf-scroll" ref={scroll} style={{ touchAction: "pan-x pan-y" }}>
      {nonPdfOriginal&&bytes ? <div style={{padding:24}}><strong>{fileName}</strong><Hint>{tr("这是你上传的原始文件。为了保持文件完全不变，网页不会把它转换成 PDF；请下载或分享原文件查看。", "C’est le fichier original importé. Pour le conserver à l’identique, Onward ne le convertit pas en PDF ; téléchargez-le ou partagez-le pour l’ouvrir.", "This is the exact file you uploaded. To keep it unchanged, Onward does not convert it to PDF; download or share the original file to open it.")}</Hint></div> : !pdf ? <Loading>{failed ? tr("无法读取 PDF。请关闭后重试。", "Impossible de lire le PDF. Fermez puis réessayez.", "Unable to read the PDF. Close and try again.") : tr("正在读取实际 PDF", "Chargement du PDF réel", "Loading the actual PDF")}</Loading> : <div className="jp-pdf-pages" style={{ width: width * zoom }}>{Array.from({ length: pdf.numPages }, (_, i) => <PdfPage key={`${source}:${i}`} pdf={pdf} index={i + 1} width={width * zoom} />)}</div>}
    </div>
  </Sheet>;
}
