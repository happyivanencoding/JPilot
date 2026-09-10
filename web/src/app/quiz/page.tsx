"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Compass, Download, Sparkles, Target, Users } from "lucide-react";

type Answer = string | string[];

type Option = {
  id: string;
  label: string;
  detail: string;
  axisValue?: string;
  score?: number;
  signals?: readonly string[];
  nextStep?: string;
};

type Question = {
  id: string;
  kind: "single" | "multi";
  eyebrow: string;
  title: string;
  prompt: string;
  maxSelections?: number;
  options: readonly Option[];
};

const QUESTIONS: readonly Question[] = [
  {
    id: "industries",
    kind: "multi",
    eyebrow: "兴趣方向",
    title: "哪些行业主题会让你愿意长期投入？",
    prompt: "最多选择 3 个。这里没有“更有前景”的标准答案，我们只是想了解你真正愿意靠近的领域。",
    maxSelections: 3,
    options: [
      { id: "technology", label: "科技与软件", detail: "AI、SaaS、开发工具" },
      { id: "finance", label: "金融与专业服务", detail: "银行、投资、咨询、保险" },
      { id: "consumer", label: "消费与生活方式", detail: "零售、品牌、旅行、媒体" },
      { id: "health", label: "医疗与健康", detail: "医疗、生命科学、健康产品" },
      { id: "education", label: "教育与知识服务", detail: "教育、培训、研究" },
      { id: "climate", label: "气候与能源", detail: "能源、气候、可持续发展" },
      { id: "public", label: "公共服务与非营利", detail: "政府、公共机构、社会影响" },
      { id: "creative", label: "创意与内容", detail: "设计、文化、内容创作" },
    ],
  },
  {
    id: "career-stage",
    kind: "single",
    eyebrow: "求职阶段",
    title: "如果未来六个月只解决一个问题，你会选哪一个？",
    prompt: "选最接近你当前状态的一项，而不是你觉得听起来最理想的一项。",
    options: [
      { id: "advance", label: "把已有经验带到更高一级的岗位", detail: "希望更有影响力，也更接近自己的长期方向。", score: 2, signals: ["经验迁移", "目标聚焦"], nextStep: "把最有价值的经历放到简历前半页，先让目标岗位看懂你的成长。" },
      { id: "pivot", label: "进入新的行业或职能", detail: "愿意重新组织过去的经验，寻找可迁移的入口。", score: 1, signals: ["学习迁移", "叙事重构"], nextStep: "把已有能力翻译成目标行业熟悉的语言，减少转型解释成本。" },
      { id: "start", label: "找到第一份稳定的专业工作", detail: "希望建立清晰的起点，并快速积累真实经验。", score: 1, signals: ["成长意愿", "执行启动"], nextStep: "用项目、课程或实习经历建立一条可信的成长主线。" },
      { id: "fit", label: "找到更适合生活节奏的工作方式", detail: "在工作内容之外，也重视地点、节奏和可持续性。", score: 2, signals: ["边界意识", "长期稳定"], nextStep: "把你需要的工作方式写成明确筛选条件，减少无效投递。" },
    ],
  },
  {
    id: "energy",
    kind: "single",
    eyebrow: "工作风格 · 1/4",
    title: "一天结束时，哪一种工作更可能让你感到充电？",
    prompt: "两种方式都很有价值，请选更自然、更不需要额外消耗的一种。",
    options: [
      { id: "energy-social", label: "在讨论中把思路变清楚", detail: "通过交流、反馈和共同推进获得能量。", axisValue: "E", signals: ["协作驱动"] },
      { id: "energy-focus", label: "先独立想清楚，再带着结论沟通", detail: "通过安静专注和深度思考形成判断。", axisValue: "I", signals: ["深度专注"] },
    ],
  },
  {
    id: "information",
    kind: "single",
    eyebrow: "工作风格 · 2/4",
    title: "面对一个陌生项目，你通常先抓什么？",
    prompt: "想象你刚加入一个新团队，手上的信息还不完整。",
    options: [
      { id: "information-facts", label: "已有事实、样例和限制", detail: "先把可验证的材料和现实边界整理出来。", axisValue: "S", signals: ["落地执行"] },
      { id: "information-patterns", label: "趋势、可能性和整体方向", detail: "先寻找问题背后的模式和更大的机会。", axisValue: "N", signals: ["抽象思考"] },
    ],
  },
  {
    id: "decision",
    kind: "single",
    eyebrow: "工作风格 · 3/4",
    title: "团队意见分歧时，你更自然地从哪里开始？",
    prompt: "不是判断谁更正确，而是选择你通常会先使用的切入点。",
    options: [
      { id: "decision-criteria", label: "把标准、成本和结果摆在桌面上", detail: "先让讨论回到目标和可比较的事实。", axisValue: "T", signals: ["结构化决策"] },
      { id: "decision-impact", label: "先理解对人的影响，再寻找共识", detail: "先照顾关系和感受，让团队能继续合作。", axisValue: "F", signals: ["关系与影响"] },
    ],
  },
  {
    id: "structure",
    kind: "single",
    eyebrow: "工作风格 · 4/4",
    title: "计划在中途变化时，哪种反应更像你？",
    prompt: "选择在真实工作中最常出现的反应，不是你希望自己表现出的样子。",
    options: [
      { id: "structure-plan", label: "重新拆出节点，恢复清晰节奏", detail: "先建立新的确定性，再继续推进。", axisValue: "J", signals: ["计划推进"] },
      { id: "structure-flex", label: "保留选项，边推进边调整", detail: "先利用变化带来的信息，再决定最终路径。", axisValue: "P", signals: ["灵活探索"] },
    ],
  },
  {
    id: "task-start",
    kind: "single",
    eyebrow: "情境取舍",
    title: "接到一个完全陌生的任务，你更可能先做什么？",
    prompt: "四个做法都合理，选择最符合你启动任务的第一步。",
    options: [
      { id: "task-map", label: "先拆目标和成功标准", detail: "确保自己知道什么结果才算完成。", score: 2, signals: ["目标拆解"], nextStep: "把你的目标拆解能力写成可见的成果，而不只是职责列表。" },
      { id: "task-prototype", label: "先做一个小实验或样例", detail: "用最小成本验证方向，再扩大投入。", score: 2, signals: ["快速验证"], nextStep: "在简历中突出你如何从不确定开始，并把尝试推进成结果。" },
      { id: "task-people", label: "先找熟悉的人校准理解", detail: "借助已有经验，避免在错误方向上浪费时间。", score: 1, signals: ["资源协作"], nextStep: "把跨团队协作写成具体动作，让读者看见你的推进方式。" },
      { id: "task-research", label: "先收集行业资料和背景", detail: "建立足够的上下文，再形成自己的判断。", score: 1, signals: ["学习研究"], nextStep: "把学习过程连接到实际产出，避免简历只留下“研究过”。" },
    ],
  },
  {
    id: "change",
    kind: "single",
    eyebrow: "情境取舍",
    title: "项目方向突然改变，你会先保护什么？",
    prompt: "在时间有限的情况下，选择你最优先守住的东西。",
    options: [
      { id: "change-goal", label: "重新确认目标和新的边界", detail: "先保证团队对“为什么做”达成一致。", score: 2, signals: ["方向判断"], nextStep: "让简历体现你如何在变化中重新定义目标，而不是只写执行过程。" },
      { id: "change-value", label: "保留已经验证有效的部分", detail: "先保护已有成果，减少不必要的返工。", score: 2, signals: ["价值判断"], nextStep: "用前后对比展示你保住了什么价值，以及为什么这样取舍。" },
      { id: "change-team", label: "先让相关的人知道变化", detail: "先降低信息差，确保大家不会各自行动。", score: 1, signals: ["透明沟通"], nextStep: "把沟通带来的协作结果写清楚，而不是只写“负责协调”。" },
      { id: "change-momentum", label: "先继续推进能推进的部分", detail: "保持动能，同时在行动中收集更多信息。", score: 1, signals: ["行动韧性"], nextStep: "补充你如何在不确定中推进，让经历更有说服力。" },
    ],
  },
  {
    id: "feedback",
    kind: "single",
    eyebrow: "情境取舍",
    title: "收到一句“还不够好”的反馈时，你会怎么接住？",
    prompt: "选择你最可能采取的下一步，而不是最标准的沟通话术。",
    options: [
      { id: "feedback-example", label: "请对方给一个具体例子", detail: "把模糊评价变成可以行动的标准。", score: 2, signals: ["反馈转化"], nextStep: "把你根据反馈改进的前后变化，整理成一条可复用的简历证据。" },
      { id: "feedback-observe", label: "先观察结果和使用者反应", detail: "用实际表现判断问题究竟出现在哪里。", score: 2, signals: ["结果意识"], nextStep: "优先保留有结果反馈的经历，让简历更接近真实影响。" },
      { id: "feedback-context", label: "先解释当时的背景和限制", detail: "确保评价建立在完整上下文之上。", score: 1, signals: ["上下文意识"], nextStep: "把限制条件和你的判断写短，让成果不要被背景淹没。" },
      { id: "feedback-pause", label: "先消化一下，再决定是否调整", detail: "避免在情绪或信息不足时仓促反应。", score: 1, signals: ["自我调节"], nextStep: "把沉淀后的判断转成明确行动，帮助简历呈现你的成长轨迹。" },
    ],
  },
  {
    id: "communication",
    kind: "single",
    eyebrow: "情境取舍",
    title: "如果只能用 30 秒介绍一个项目，你会先放什么？",
    prompt: "这个选择能帮助我们了解你习惯如何组织信息。",
    options: [
      { id: "communication-result", label: "先说结果和它改变了什么", detail: "让别人快速理解这件事为什么重要。", score: 2, signals: ["价值表达"], nextStep: "把简历每段经历的第一句改成结果或影响，再补充背景。" },
      { id: "communication-story", label: "先说当时遇到的难题", detail: "让听众知道你面对的挑战是什么。", score: 1, signals: ["问题意识"], nextStep: "把挑战和你的动作连接起来，避免只留下故事背景。" },
      { id: "communication-method", label: "先说你用了什么方法", detail: "让别人理解你的专业判断和工作过程。", score: 2, signals: ["方法沉淀"], nextStep: "保留关键方法，但用一句结果证明它产生了什么作用。" },
      { id: "communication-team", label: "先说谁和你一起完成了它", detail: "先呈现协作关系和你所在的工作环境。", score: 1, signals: ["团队协作"], nextStep: "进一步说明你的具体贡献，让团队成果和个人贡献同时清楚。" },
    ],
  },
  {
    id: "values",
    kind: "multi",
    eyebrow: "工作价值",
    title: "下一份工作中，哪些条件对你最重要？",
    prompt: "最多选 2 项。这会帮助我们判断你应该优先筛选什么样的机会。",
    maxSelections: 2,
    options: [
      { id: "values-autonomy", label: "自主空间", detail: "能决定方法，并对结果负责" },
      { id: "values-growth", label: "学习成长", detail: "有反馈、导师或新的挑战" },
      { id: "values-impact", label: "实际影响", detail: "工作能改变用户、业务或社会" },
      { id: "values-stability", label: "稳定与边界", detail: "节奏可持续，长期预期清晰" },
      { id: "values-team", label: "团队氛围", detail: "坦诚合作，彼此支持" },
      { id: "values-reward", label: "回报与认可", detail: "贡献能被公平评价和回报" },
    ],
  },
  {
    id: "environment",
    kind: "single",
    eyebrow: "工作环境",
    title: "哪种工作节奏更接近你想长期保持的状态？",
    prompt: "没有更好的选项，重要的是它是否适合你持续发挥。",
    options: [
      { id: "environment-deep", label: "稳定节奏，留出深度工作的时间", detail: "适合需要专注、积累和长期打磨的任务。", score: 2, signals: ["持续交付"], nextStep: "把长期项目的积累和迭代写出来，体现你的耐力。" },
      { id: "environment-varied", label: "任务多变，经常接触新问题", detail: "适合快速切换、探索和解决非标准问题。", score: 2, signals: ["适应变化"], nextStep: "用多个场景中的共同能力，串起一条清晰的职业主线。" },
      { id: "environment-people", label: "和固定团队密切协作", detail: "适合在共同目标和稳定关系中持续推进。", score: 1, signals: ["关系经营"], nextStep: "呈现你如何让团队更高效，而不只列出参加过哪些团队。" },
      { id: "environment-mission", label: "围绕明确使命快速推进", detail: "适合目标感强、愿意承担变化和压力的阶段。", score: 1, signals: ["使命驱动"], nextStep: "把你的动机连接到实际选择和结果，增强简历的可信度。" },
    ],
  },
];

const PERSONALITY_IDS = ["energy", "information", "decision", "structure"];
const APP_DOWNLOAD_URL = process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL ?? "/";
const TYPE_NAMES: Record<string, { name: string; description: string }> = {
  ISTJ: { name: "可靠执行者", description: "你更容易在清晰目标、稳定节奏和可验证的成果中发挥实力。" },
  ISFJ: { name: "稳定支持者", description: "你擅长把细节、关系和责任照顾好，让团队可以持续前进。" },
  INFJ: { name: "价值洞察者", description: "你会把人的需要和长期方向放在一起思考，再选择值得投入的路径。" },
  INTJ: { name: "策略架构者", description: "你习惯从整体结构和长期目标出发，把复杂问题变成可执行的路线。" },
  ISTP: { name: "独立解决者", description: "你擅长在真实限制下快速判断，用实用方案处理具体问题。" },
  ISFP: { name: "体验创造者", description: "你对真实体验和细节敏感，倾向于用灵活而有温度的方式创造价值。" },
  INFP: { name: "意义表达者", description: "你重视工作背后的意义，希望把个人价值与真实影响连接起来。" },
  INTP: { name: "逻辑探索者", description: "你喜欢拆解复杂问题，寻找更底层的规律和更聪明的可能性。" },
  ESTP: { name: "现场推进者", description: "你在变化和真实反馈中反应很快，擅长把机会转化为行动。" },
  ESFP: { name: "关系感染者", description: "你能快速感知现场和他人需要，把能量带进合作和用户体验。" },
  ENFP: { name: "机会连接者", description: "你善于发现可能性、连接资源，也能用热情推动新的方向开始。" },
  ENTP: { name: "创新挑战者", description: "你喜欢重新定义问题，用不同角度挑战惯性并找到新的解法。" },
  ESTJ: { name: "目标组织者", description: "你倾向于把目标、资源和责任安排清楚，让事情按节奏落地。" },
  ESFJ: { name: "团队协调者", description: "你擅长让人和流程协同起来，在明确的共同目标中建立信任。" },
  ENFJ: { name: "人才激励者", description: "你能看见人的潜力，也愿意用沟通和方向感带动集体成长。" },
  ENTJ: { name: "结果驱动者", description: "你喜欢把远大的目标变成清晰决策，并推动资源朝结果集中。" },
};

function orderedOptions(question: Question) {
  if (question.kind === "multi") return question.options;
  const seed = [...question.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const offset = seed % question.options.length;
  return [...question.options.slice(offset), ...question.options.slice(0, offset)];
}

function unique(items: readonly string[]) {
  return [...new Set(items)];
}

function resultFor(answers: Record<string, Answer>) {
  const personality = PERSONALITY_IDS.map(id => {
    const question = QUESTIONS.find(item => item.id === id);
    return question?.options.find(option => option.id === answers[id])?.axisValue ?? "?";
  }).join("");
  const personalityProfile = TYPE_NAMES[personality] ?? { name: "探索型实践者", description: "你正在通过真实选择摸索更适合自己的工作方式，答案会随着经历继续变得清晰。" };
  const selected = QUESTIONS.flatMap(question => {
    const answer = answers[question.id];
    const ids = Array.isArray(answer) ? answer : answer ? [answer] : [];
    return ids.map(id => question.options.find(option => option.id === id)).filter((option): option is Option => Boolean(option));
  });
  const scored = selected.filter(option => option.score != null);
  const rawScore = scored.reduce((sum, option) => sum + (option.score ?? 0), 0);
  const maxScore = scored.length * 2;
  const score = maxScore ? Math.round((rawScore / maxScore) * 100) : 0;
  const signals = unique(selected.flatMap(option => option.signals ?? [])).slice(0, 4);
  const nextSteps = unique(selected.map(option => option.nextStep).filter((step): step is string => Boolean(step))).slice(0, 3);
  const industries = (Array.isArray(answers.industries) ? answers.industries : []).map(id => QUESTIONS.find(question => question.id === "industries")?.options.find(option => option.id === id)?.label).filter((label): label is string => Boolean(label));
  const values = (Array.isArray(answers.values) ? answers.values : []).map(id => QUESTIONS.find(question => question.id === "values")?.options.find(option => option.id === id)?.label).filter((label): label is string => Boolean(label));
  const level = score >= 75
    ? { title: "你已经有可转化的职业信号", text: "你的选择里出现了清晰的方向、行动方式和工作偏好。下一步不是再堆更多内容，而是把这些信号准确翻译进简历。" }
    : score >= 50
      ? { title: "你的方向正在成形", text: "你已经有一些稳定的工作偏好，但还可以把目标、场景和表达方式收拢得更具体。" }
      : { title: "先把选择变得更清楚", text: "你可能正处在探索或转换阶段。先找到适合自己的工作方式，再让简历围绕它建立主线，会更省力。" };
  return { score, personality, personalityProfile, signals, nextSteps, industries, values, level };
}

function Intro({ onStart }: { onStart: () => void }) {
  return <section className="jp-quiz-intro"><div className="jp-quiz-intro-icon"><Compass size={28} /></div><p className="jp-quiz-eyebrow">2 分钟职业画像</p><h1>先了解你的工作方式，再找到更适合你的下一步。</h1><p className="jp-quiz-intro-lead">这是一份轻量的职场竞争力快照。我们会通过你的行业兴趣、工作场景选择和工作风格偏好，生成一份参考 16 型维度的工作画像，并给出简历优化方向。</p><div className="jp-quiz-intro-points"><div><Target size={18} /><span>找到你更容易发挥的工作场景</span></div><div><Users size={18} /><span>了解你的协作、决策和工作节奏</span></div><div><Sparkles size={18} /><span>获得下一步简历优化建议</span></div></div><button className="jp-quiz-start" onClick={onStart}>开始测评 <ArrowRight size={18} /></button><p className="jp-quiz-intro-note">共 {QUESTIONS.length} 题 · 约 2 分钟 · 不需要注册</p><p className="jp-quiz-intro-disclaimer">这不是临床心理测验，也不是正式 MBTI 认证或录用概率预测；结果只用于帮助你更好地认识自己的求职表达。</p></section>;
}

function Result({ result, onRestart }: { result: ReturnType<typeof resultFor>; onRestart: () => void }) {
  return <section className="jp-quiz-result"><div className="jp-quiz-result-icon"><Sparkles size={28} /></div><p className="jp-quiz-eyebrow">你的个性化职业画像</p><h1>{result.level.title}</h1><p className="jp-quiz-result-lead">{result.level.text}</p><div className="jp-quiz-score"><strong>{result.score}</strong><span>/ 100<br />综合竞争力信号</span></div><p className="jp-quiz-disclaimer">这个分数不是“标准答案”评分，而是根据你的选择组合估算出的行动准备度。它不会定义你，也不会替代真实的职业评估。</p><div className="jp-quiz-type-card"><div><p className="jp-quiz-card-label">工作风格画像 · 参考 16 型维度</p><strong>{result.personality} · {result.personalityProfile.name}</strong><p>{result.personalityProfile.description}</p></div><span className="jp-quiz-type-mark">{result.personality}</span></div><div className="jp-quiz-result-section"><h2>你更容易发挥的优势</h2><div className="jp-quiz-signal-list">{result.signals.map(signal => <span key={signal}><CheckCircle2 size={16} />{signal}</span>)}</div></div><div className="jp-quiz-result-grid"><section><h2>感兴趣的行业</h2><div className="jp-quiz-tag-list">{result.industries.map(industry => <span key={industry}>{industry}</span>)}</div></section><section><h2>在意的工作条件</h2><div className="jp-quiz-tag-list">{result.values.map(value => <span key={value}>{value}</span>)}</div></section></div><div className="jp-quiz-result-section jp-quiz-next-steps"><h2>下一步简历优化重点</h2>{result.nextSteps.map(step => <p key={step}><span className="jp-quiz-gap-dot" />{step}</p>)}</div><div className="jp-quiz-cta"><div><p className="jp-quiz-card-label">免费领取一次简历评估</p><p><strong>把这份画像变成真正的求职行动</strong><br />下载 JobPilot，免费获得一次简历评估（价值 10 欧元）。</p></div><a data-testid="quiz-download-app" href={APP_DOWNLOAD_URL} aria-label="下载 JobPilot App"><Download size={17} />下载 JobPilot App <ArrowRight size={17} /></a><small>预览邀请码：JPILOT10 · 正式上线后将跳转到应用商店</small></div><button className="jp-quiz-restart" onClick={onRestart}>重新测一次</button></section>;
}

export default function QuizPage() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const result = useMemo(() => step === QUESTIONS.length ? resultFor(answers) : null, [answers, step]);
  const question = QUESTIONS[step];
  const answer = question ? answers[question.id] : undefined;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const restart = () => { setAnswers({}); setStep(0); setStarted(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const choose = (option: Option) => {
    if (!question) return;
    if (question.kind === "multi") {
      const selected = Array.isArray(answer) ? answer : [];
      const next = selected.includes(option.id) ? selected.filter(id => id !== option.id) : selected.length >= (question.maxSelections ?? 99) ? selected : [...selected, option.id];
      setAnswers(previous => ({ ...previous, [question.id]: next }));
      return;
    }
    setAnswers(previous => ({ ...previous, [question.id]: option.id }));
    window.setTimeout(() => setStep(current => Math.min(QUESTIONS.length, current + 1)), 160);
  };
  const continueMulti = () => { if (Array.isArray(answer) && answer.length) setStep(current => Math.min(QUESTIONS.length, current + 1)); };

  return <main className="jp-quiz-shell"><header className="jp-quiz-header"><a href="/"><span className="jp-quiz-mark">J</span><strong>JobPilot</strong></a><span className="jp-quiz-time"><Clock3 size={16} />约 2 分钟</span></header>{!started ? <Intro onStart={() => setStarted(true)} /> : result ? <Result result={result} onRestart={restart} /> : <section className="jp-quiz-card"><div className="jp-quiz-progress"><span style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} /></div><div className="jp-quiz-count">{step + 1} / {QUESTIONS.length}</div><p className="jp-quiz-eyebrow">{question.eyebrow}</p><h1>{question.title}</h1><p className="jp-quiz-prompt">{question.prompt}</p><div className={`jp-quiz-options ${question.kind === "multi" ? "jp-quiz-options--multi" : ""}`}>{orderedOptions(question).map(option => { const selected = Array.isArray(answer) ? answer.includes(option.id) : answer === option.id; return <button type="button" key={option.id} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => choose(option)}><span className="jp-quiz-option-copy"><strong>{option.label}</strong><span>{option.detail}</span></span>{question.kind === "multi" ? <span className="jp-quiz-check" aria-hidden="true">{selected ? "✓" : ""}</span> : <ArrowRight size={18} />}</button>; })}</div>{question.kind === "multi" ? <button className="jp-quiz-continue" disabled={!Array.isArray(answer) || !answer.length} onClick={continueMulti}>继续 <ArrowRight size={18} /></button> : <p className="jp-quiz-footnote">没有标准答案；系统会综合你的选择组合，而不是用某一道题给你贴标签。</p>}</section>}</main>;
}
