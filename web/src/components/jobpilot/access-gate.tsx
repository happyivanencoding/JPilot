"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

type Stage = "checking" | "invite" | "auth" | "register";

const INVITE_KEY = "jobpilot:invite:v1";
const AUTH_KEY = "jobpilot:auth:v1";

export function AccessGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("checking");
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("fresh") === "1") {
        [INVITE_KEY, AUTH_KEY, "jobpilot:onboarding:v1", "jobpilot:privacy-notice:v1"].forEach(key => localStorage.removeItem(key));
        url.searchParams.delete("fresh");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
      }
      setStage(localStorage.getItem(INVITE_KEY) === "verified" ? localStorage.getItem(AUTH_KEY) === "signed-in" ? "checking" : "auth" : "invite");
    } catch { setStage("invite"); }
  }, []);
  if (stage === "checking") return <>{children}</>;
  return <AccessScreen stage={stage} onStage={setStage}>{children}</AccessScreen>;
}

function AccessScreen({ stage, onStage, children }: { stage: Stage; onStage: (stage: Stage) => void; children: ReactNode }) {
  const [invite, setInvite] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const signIn = () => { localStorage.setItem(AUTH_KEY, "signed-in"); onStage("checking"); };
  const validateInvite = async () => {
    setWorking(true); setMessage("");
    try {
      const response = await fetch("/api/access/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: invite.trim() }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "邀请码无效");
      localStorage.setItem(INVITE_KEY, "verified"); onStage("auth");
    } catch (error) { setMessage(error instanceof Error ? error.message : "邀请码无效，请重新输入"); }
    finally { setWorking(false); }
  };
  const register = () => {
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) return setMessage("请输入有效的邮箱地址");
    if (password.length < 8) return setMessage("密码至少需要 8 位");
    if (password !== confirm) return setMessage("两次输入的密码不一致");
    if (!terms) return setMessage("请先同意使用条款和隐私政策");
    signIn();
  };
  if (stage === "checking") return <>{children}</>;
  return <main className="jp-access-shell"><section className="jp-access-card" aria-live="polite">
    <div className="jp-access-brand"><img src="/jobpilot.svg" alt="" width="42" height="42" /><span>JobPilot</span></div>
    {stage === "invite" ? <>
      <span className="jp-access-eyebrow">PRIVATE BETA</span><h1>先从一份邀请码开始</h1><p className="jp-access-lead">JobPilot 正在邀请一小批求职者体验。输入邀请码后，即可创建自己的安全工作台。</p>
      <label className="jp-access-field"><span>邀请码</span><input autoFocus value={invite} onChange={e => setInvite(e.target.value.toUpperCase())} placeholder="例如 JPILOT10" onKeyDown={e => { if (e.key === "Enter") void validateInvite(); }} /></label>
      {message && <p className="jp-access-error" role="alert">{message}</p>}<button className="jp-access-primary" disabled={!invite.trim() || working} onClick={() => void validateInvite()}>{working ? "验证中…" : "验证并继续"}<ArrowRight size={18} /></button><p className="jp-access-note"><LockKeyhole size={15} />邀请码只用于控制首批体验资格，不会公开展示。</p>
    </> : <>
      <span className="jp-access-eyebrow">WELCOME TO JOBPILOT</span><h1>{stage === "register" ? "创建你的账号" : "登录你的工作台"}</h1><p className="jp-access-lead">邀请码已验证。接下来登录或注册，即可保存你的岗位、简历和求职进展。</p>
      {stage === "register" ? <>
        <label className="jp-access-field"><span>邮箱地址</span><input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label><label className="jp-access-field"><span>密码</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 8 位" /></label><label className="jp-access-field"><span>确认密码</span><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="再次输入密码" /></label><label className="jp-access-terms"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} /><span>我同意使用条款和隐私政策，并确认已阅读数据处理说明。</span></label>
        {message && <p className="jp-access-error" role="alert">{message}</p>}<button className="jp-access-primary" onClick={register}>创建账号<ArrowRight size={18} /></button><button className="jp-access-link" onClick={() => { setMessage(""); onStage("auth"); }}>已有账号？返回登录</button>
      </> : <>
        <button className="jp-google-button" onClick={signIn}><span className="jp-google-mark">G</span>使用 Google 继续</button><div className="jp-access-divider"><span>或使用邮箱</span></div><label className="jp-access-field"><span>邮箱地址</span><input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label><label className="jp-access-field"><span>密码</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="你的密码" /></label>
        {message && <p className="jp-access-error" role="alert">{message}</p>}<button className="jp-access-primary" onClick={signIn}>登录<ArrowRight size={18} /></button><button className="jp-access-link" onClick={() => { setMessage(""); onStage("register"); }}>还没有账号？免费注册</button>
      </>}
      <div className="jp-access-assurance"><ShieldCheck size={18} /><span>你的简历按账号隔离保存，并通过加密连接传输。</span></div>
    </>}
  </section><aside className="jp-access-side"><div className="jp-access-side-icon"><Check size={22} /></div><h2>从发现机会，到拿到下一步</h2><p>JobPilot 把机会、简历、投递和准备放在一个安静的工作台里。</p><ul><li><Check size={16} />只看最相关的岗位</li><li><Check size={16} />围绕真实 JD 准备面试</li><li><Check size={16} />每一步都有清晰的下一动作</li></ul><div className="jp-access-side-footer"><Mail size={16} />需要邀请码？请联系邀请你的团队。</div></aside></main>;
}
