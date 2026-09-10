"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Offer = { company?: string; title?: string; location?: string; description?: string; why?: string; url?: string; sourceLabel?: string };

export default function JobSourcePage() {
  const [offer, setOffer] = useState<Offer | null>(null);
  useEffect(() => { const key = new URLSearchParams(window.location.search).get("key"); if (!key) return; try { const value = JSON.parse(window.localStorage.getItem(key) || "null"); if (value && typeof value === "object") setOffer(value); } catch { /* Show the fallback state. */ } }, []);
  return <main className="jp-source-shell"><header className="jp-source-header"><a href="/">← 返回 JobPilot</a><span>原始职位信息</span></header><article className="jp-source-document">
    {!offer ? <><h1>原始职位信息</h1><p>这条岗位摘要来自机会页。请从机会页重新打开原信息，或直接访问职位来源。</p></> : <><p className="jp-company">{offer.company}</p><h1>{offer.title}</h1><p className="jp-source-meta">{[offer.location, offer.sourceLabel].filter(Boolean).join(" · ")}</p><hr /><h2>职位原文</h2>{offer.description ? <div className="jp-source-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{offer.description}</ReactMarkdown></div> : <p>该来源没有返回可展示的完整 JD，请打开职位来源查看。</p>}{offer.why && <><hr /><h2>JobPilot 摘要说明</h2><p>{offer.why}</p></>}{offer.url && <a className="jp-source-link" href={offer.url} target="_blank" rel="noopener noreferrer">打开职位来源 ↗</a>}</>}
  </article></main>;
}
