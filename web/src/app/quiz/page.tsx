"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Sparkles } from "lucide-react";

const QUESTIONS = [
  { id: "direction", title: "你的求职方向清晰吗？", prompt: "如果今天出现 3 个不同岗位，你能快速判断哪个值得投入吗？", options: [["我有明确的目标岗位、行业和地点", 2], ["大致清楚，但经常被新机会带偏", 1], ["我还在广泛尝试，暂时没有标准", 0]] },
  { id: "evidence", title: "你的优势有证据吗？", prompt: "当别人问“你为什么适合”，你通常能做到什么程度？", options: [["能用具体项目、结果或作品说明", 2], ["能说出经历，但数字或结果不完整", 1], ["主要靠形容词描述自己", 0]] },
  { id: "targeting", title: "你的简历与岗位匹配吗？", prompt: "你会不会根据目标岗位调整简历的重点？", options: [["会，保留真实经历并突出岗位最相关的证据", 2], ["偶尔调整，但主要还是发同一份", 1], ["通常直接发送同一份简历", 0]] },
  { id: "market", title: "你了解目标市场吗？", prompt: "你对目标岗位的要求和薪资范围了解多少？", options: [["我有近期职位样本和明确的能力清单", 2], ["有一些印象，但没有系统整理", 1], ["主要凭感觉寻找", 0]] },
  { id: "communication", title: "你能讲清自己的价值吗？", prompt: "在 60 秒内介绍自己时，你能让对方记住重点吗？", options: [["能围绕目标岗位讲清主线和代表性成果", 2], ["内容真实，但表达比较散", 1], ["容易紧张或不知道从哪里开始", 0]] },
  { id: "momentum", title: "你的求职节奏稳定吗？", prompt: "过去两周，你是否持续完成了有效行动？", options: [["每周都有固定节奏，并会复盘结果", 2], ["有行动，但节奏容易被其他事情打断", 1], ["通常等到焦虑时才集中行动", 0]] }
] as const;

function resultFor(scores: Record<string, number>) {
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const score = Math.round(total / (QUESTIONS.length * 2) * 100);
  const dimensions = QUESTIONS.map(question => ({ id: question.id, label: question.title.replace("？", ""), value: scores[question.id] ?? 0 })).sort((a, b) => b.value - a.value);
  const strengths = dimensions.slice(0, 2).filter(item => item.value > 0);
  const gaps = [...dimensions].reverse().slice(0, 2);
  const level = score >= 75 ? { title: "你的求职基础已经很稳", text: "你已经具备清晰方向和可复用的求职方法，下一步重点是把证据呈现在最匹配的岗位上。" } : score >= 50 ? { title: "你有潜力，但还需要聚焦", text: "你的基础正在形成。把方向、证据和岗位匹配做得更具体，通常会比盲目增加投递数量更有效。" } : { title: "先把基础打牢，会更省力", text: "你并不是没有竞争力，只是优势还没有被清晰表达。先建立目标、证据和行动节奏，再扩大投递范围。" };
  return { total, score, dimensions, strengths, gaps, level };
}

export default function QuizPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const result = useMemo(() => step === QUESTIONS.length ? resultFor(answers) : null, [answers, step]);
  const question = QUESTIONS[step];
  const answer = question ? answers[question.id] : undefined;
  const choose = (value: number) => { if (!question) return; setAnswers(previous => ({ ...previous, [question.id]: value })); window.setTimeout(() => setStep(current => Math.min(QUESTIONS.length, current + 1)), 140); };
  return <main className="jp-quiz-shell"><header className="jp-quiz-header"><a href="/"><span className="jp-quiz-mark">J</span><strong>JobPilot</strong></a><span className="jp-quiz-time"><Clock3 size={16} />约 2 分钟</span></header>
    {result ? <section className="jp-quiz-result"><div className="jp-quiz-result-icon"><Sparkles size={28} /></div><p className="jp-quiz-eyebrow">你的快速评估结果</p><h1>{result.level.title}</h1><p className="jp-quiz-result-lead">{result.level.text}</p><div className="jp-quiz-score"><strong>{result.score}</strong><span>/ 100<br />职场竞争力信号</span></div><p className="jp-quiz-disclaimer">这是基于你刚才回答的快速自测，不是心理测评或录用概率预测；它用于帮你找到下一步，而不是给你贴标签。</p><div className="jp-quiz-result-grid"><section><h2>你的优势</h2>{result.strengths.map(item => <p key={item.id}><CheckCircle2 size={17} />{item.label}</p>)}</section><section><h2>优先补强</h2>{result.gaps.map(item => <p key={item.id}><span className="jp-quiz-gap-dot" />{item.label}</p>)}</section></div><div className="jp-quiz-cta"><p><strong>把这份结果变成具体行动</strong><br />下载 JobPilot，免费获得一次简历评估（价值 10 欧元）。</p><a href="/">下载 App <ArrowRight size={18} /></a><small>首次使用需要邀请码，预览邀请码：JPILOT10</small></div><button className="jp-quiz-restart" onClick={() => { setAnswers({}); setStep(0); }}>重新测一次</button></section> : <section className="jp-quiz-card"><div className="jp-quiz-progress"><span style={{ width: `${step / QUESTIONS.length * 100}%` }} /></div><div className="jp-quiz-count">{step + 1} / {QUESTIONS.length}</div><h1>{question.title}</h1><p className="jp-quiz-prompt">{question.prompt}</p><div className="jp-quiz-options">{question.options.map(([label, value]) => <button key={label} className={answer === value ? "selected" : ""} onClick={() => choose(value)}>{label}<ArrowRight size={18} /></button>)}</div><p className="jp-quiz-footnote">没有标准答案，按你目前的真实状态选择即可。</p></section>}
  </main>;
}
