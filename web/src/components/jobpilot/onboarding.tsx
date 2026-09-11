"use client";
import { useEffect, useRef, useState } from "react";
import { Home as HomeIcon, PersonOutline as ProfileIcon, Search as OffersIcon } from "./native-icons";
import { rows, usePilot, type Json } from "./pilot-context";
import { AiProgressButton, Button, Hint } from "./ui";
import {CvAnalysisWater,useCvWaterProgress} from "./cv-water";

export type GuideTab = "home" | "offers" | "profile";
type GuideItem = { icon: typeof HomeIcon; title: [string, string, string]; summary: [string, string, string]; details: [string, string, string][] };

const GUIDE_ITEMS: Record<GuideTab, GuideItem> = {
  home: {
    icon: HomeIcon,
    title: ["首页", "Accueil", "Home"],
    summary: ["先看你适合什么，而不是先学会操作软件。", "Commencez par comprendre où votre profil peut aller.", "Start by seeing where your profile can go."],
    details: [["确认简历后，JobPilot 会自动理解你的经历并给出 3–5 个可探索方向。", "Après confirmation du CV, JobPilot comprend votre parcours et propose 3–5 directions à explorer.", "After you confirm your CV, JobPilot understands your experience and suggests 3–5 directions."], ["首页直接展示最值得先看的真实岗位和当前能力信号。", "L’accueil montre directement les offres les plus pertinentes et vos principaux signaux.", "Home shows the most useful real roles and your main profile signals."]]
  },
  offers: {
    icon: OffersIcon,
    title: ["机会", "Offres", "Offers"],
    summary: ["先看即时匹配分，再决定要不要深入。", "Voyez d’abord le score de match, puis choisissez quoi approfondir.", "See the match score first, then decide what deserves a closer look."],
    details: [["所有结果先用快速 0–100 匹配排序，不需要逐个等待 AI。", "Toutes les offres reçoivent d’abord un score rapide sur 100, sans attente IA offre par offre.", "Every result gets an immediate 0–100 match before any deep AI work."], ["前几条岗位会在后台补充职责、要求、加分点、真实缺口和 CV 提升空间。", "Les premières offres sont enrichies en arrière-plan avec missions, exigences, forces, écarts réels et potentiel du CV.", "Top roles are enriched in the background with responsibilities, requirements, strengths, real gaps and CV upside."]]
  },
  profile: {
    icon: ProfileIcon,
    title: ["我的", "Moi", "My"],
    summary: ["管理你的事实来源和每个岗位的独立简历版本。", "Gérez votre source de vérité et vos versions de CV par offre.", "Manage your source of truth and independent role-specific CVs."],
    details: [["Master Profile 是所有匹配与新简历的共同事实来源。", "Le Master Profile est la source commune de tous les matchs et nouveaux CV.", "The Master Profile is the shared fact source for every match and new CV."], ["每个岗位版本都独立从 Master 分叉，不会把上一份定制 CV 当作下一份输入。", "Chaque CV ciblé repart du Master ; une version d’offre ne devient jamais la source de la suivante.", "Every tailored CV branches from Master; one role CV never becomes the next role's input."]]
  }
};

const text = (value: [string, string, string], tr: (zh: string, fr: string, en?: string) => string) => tr(...value);

export function OnboardingOverlay({ mode, tab, onClose, onSkip }: { mode: "welcome" | "tab"; tab?: GuideTab; onClose: () => void; onSkip: () => void }) {
  const { tr } = usePilot();
  const items = Object.entries(GUIDE_ITEMS) as [GuideTab, GuideItem][];
  const selected = tab ? GUIDE_ITEMS[tab] : null;
  const SelectedIcon = selected?.icon || HomeIcon;
  return <div className="jp-onboarding-overlay" role="presentation">
    <section className="jp-onboarding-card" role="dialog" aria-modal="true" aria-labelledby="jp-onboarding-title" data-testid={mode === "welcome" ? "onboarding-welcome" : `onboarding-${tab}`}>
      {mode === "welcome" ? <>
        <div className="jp-onboarding-mark"><span>J</span></div>
        <p className="jp-onboarding-kicker">JobPilot</p>
        <h1 id="jp-onboarding-title">{tr("欢迎使用 JobPilot", "Bienvenue dans JobPilot", "Welcome to JobPilot")}</h1>
        <p className="jp-onboarding-lead">{tr("用几步了解你的求职工作台。", "Découvrez votre espace de recherche en quelques étapes.", "Learn your job-search workspace in a few steps.")}</p>
        <div className="jp-onboarding-list">{items.map(([key, item]) => { const Icon = item.icon; return <div className="jp-onboarding-list-item" key={key}><span className="jp-onboarding-icon"><Icon size={22} /></span><div><strong>{text(item.title, tr)}</strong><Hint>{text(item.summary, tr)}</Hint></div></div>; })}</div>
        <Button onClick={onClose}>{tr("开始使用", "Commencer", "Get started")}</Button>
        <button type="button" className="jp-onboarding-skip" onClick={onSkip}>{tr("跳过引导", "Passer le guide", "Skip guide")}</button>
      </> : selected ? <>
        <div className="jp-onboarding-tab-icon"><SelectedIcon size={30} /></div>
        <p className="jp-onboarding-kicker">{tr("第一次查看这个 Tab", "Première découverte de cet onglet", "First look at this tab")}</p>
        <h1 id="jp-onboarding-title">{text(selected.title, tr)}</h1>
        <p className="jp-onboarding-lead">{text(selected.summary, tr)}</p>
        <div className="jp-onboarding-details">{selected.details.map((detail, index) => <div className="jp-onboarding-detail" key={index}><span>✓</span><p>{text(detail, tr)}</p></div>)}</div>
        <Button onClick={onClose}>{tr("知道了，开始使用", "Compris, commencer", "Got it, start exploring")}</Button>
        <button type="button" className="jp-onboarding-skip" onClick={onSkip}>{tr("跳过引导", "Passer le guide", "Skip guide")}</button>
      </> : null}
    </section>
  </div>;
}

export function V1FirstRunOverlay({onDone}:{onDone:()=>void|Promise<void>}) {
  const p=usePilot(),{data,tr,locale,busy,loading,profileId}=p;
  const picker=useRef<HTMLInputElement>(null);
  const [languageChosen,setLanguageChosen]=useState(true),[email,setEmail]=useState("");
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const [sourceLanguage,setSourceLanguage]=useState("en"),[analysisLanguage,setAnalysisLanguage]=useState<"en"|"fr"|"zh">(locale);
  const [languageEdited,setLanguageEdited]=useState(false);
  useEffect(()=>{if(!languageEdited)setAnalysisLanguage(locale);},[locale,languageEdited]);
  const [chosenQuery,setChosenQuery]=useState(""),[customQuery,setCustomQuery]=useState(""),[chooseAgain,setChooseAgain]=useState(false),[uploading,setUploading]=useState(false);
  const v=data.v1||{},journey=v.journey||{},analysis=data.analysis||{},discovery=data.discovery||{};
  const directions=rows(v.careerDirections),offers=rows(discovery.offers).slice(0,4);
  const signedIn=!!profileId&&!p.expired;
  const importing=["queued","running","reconciling"].includes(String(v.importState));
  const targetStage=!signedIn?(languageChosen?1:0):(loading&&!data.profile?.id||uploading||importing&&!p.error)?3:(v.importState==="failed"||!data.cv)?2:!v.analysisReady?3:(chooseAgain||!journey.query)?4:!v.offersReady?5:6;
  const [stage,setStage]=useState(targetStage);
  useEffect(()=>{
    if(stage===3&&targetStage===4&&v.analysisReady){const timer=setTimeout(()=>setStage(targetStage),650);return()=>clearTimeout(timer);}
    setStage(targetStage);
  },[targetStage,profileId]);
  const progress=v.cvProgress||{},cvFailed=progress.status==="failed"||!v.analysisReady&&v.presentationFailed;
  const waterPercent=useCvWaterProgress(progress,stage===3,!!cvFailed||!!p.error);
  const languages=(selected:string,onSelect:(value:"en"|"fr"|"zh")=>void,source=false)=><div className="jp-chips">{([["en","English"],["fr","Français"],["zh","中文"]] as const).filter(([code])=>!source||code!=="zh").map(([code,label])=><button type="button" key={code} aria-pressed={code===selected} className={`jp-chip ${code===selected?"selected":""}`} onClick={()=>onSelect(code)}>{label}</button>)}</div>;
  const login=()=>p.execute(async()=>{await p.request("/api/v1/session",{method:"POST",body:JSON.stringify({action:"login",email:email.trim()})});window.location.replace("/");});
  const pick=async(file:File)=>{setUploading(true);await p.upload(file,sourceLanguage,analysisLanguage);setUploading(false);};
  const search=()=>{const query=customQuery.trim()||chosenQuery;if(query){setChooseAgain(false);void p.startTask({kind:"search",query,silent:true,source:"v1-onboarding"});}};
  const enterOffer=async(offer:Json)=>{await onDone();p.openOffer(String(offer.url));};
  const empty=stage===5&&v.searchState==="completed"&&discovery.availableCount===0;
  return <div className="jp-v1-first-run" data-testid="v1-first-run">
    {stage===3&&<CvAnalysisWater percent={waterPercent} paused={!!cvFailed||!!p.error} complete={progress.status==="completed"}/>}
    <div className="jp-v1-first-run-head"><div className="jp-onboarding-mark" style={{width:42,height:42,borderRadius:10}}><span>J</span></div><strong>JobPilot</strong></div>
    <div className="jp-v1-first-run-body" key={stage}>
      {stage===0&&<><h1>{tr("让你的下一步更清晰。","Votre prochaine étape, plus claire.","Make your next move clearer.")}</h1><Hint>{tr("你的优势，值得尝试的方向，还有下一份工作。","Vos forces, vos pistes et votre prochain poste.","Your strengths, your possibilities, your next role.")}</Hint><strong>{tr("选择语言","Choisissez votre langue","Choose your language")}</strong>{languages(locale,p.setLocale)}<Button onClick={()=>setLanguageChosen(true)}>{tr("开始","Commencer","Get started")}</Button></>}
      {stage===1&&<><h1>{tr("找到属于你的机会","Trouvez votre prochaine opportunité","Find your next opportunity")}</h1><Hint>{tr("输入邮箱，开始探索或回到你的空间。","Votre e-mail pour commencer ou retrouver votre espace.","Enter your email to begin or return to your space.")}</Hint><label className="jp-field"><span>{tr("邮箱","E-mail","Email")}</span><input data-testid="preview-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&validEmail&&!busy){e.preventDefault();void login();}}}/></label><Button data-testid="preview-login" disabled={busy||!validEmail} onClick={()=>void login()}>{tr("继续","Continuer","Continue")}</Button><Hint>{tr("V1 测试入口 · 暂不验证邮箱，请使用测试简历。","Accès test V1 · e-mail non vérifié, CV de test uniquement.","V1 test access · email is not verified; use test CVs.")}</Hint><Button kind="text" onClick={()=>setLanguageChosen(false)}>{tr("更换语言","Changer de langue","Change language")}</Button></>}
      {stage===2&&<><h1>{tr("从你的简历开始","Tout commence avec votre CV","It starts with your CV")}</h1><Hint>{tr("看看你擅长什么，以及哪些工作值得一试。","Découvrez vos atouts et les postes à explorer.","See what you bring and which roles are worth exploring.")}</Hint><strong>{tr("简历语言","Langue du CV","CV language")}</strong>{languages(sourceLanguage,setSourceLanguage,true)}<strong>{tr("我希望用这种语言看分析","Langue de mes conseils","My insights in")}</strong>{languages(analysisLanguage,value=>{setLanguageEdited(true);setAnalysisLanguage(value);})}<input ref={picker} data-testid="onboarding-cv-input" type="file" hidden accept=".pdf,.docx,.txt,.md" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void pick(file);}}/>{v.importState==="failed"&&<p role="alert">{tr("这份文件暂时打不开，请换一份 PDF 或 Word。","Ce fichier ne s’ouvre pas. Essayez un autre PDF ou Word.","This file could not be opened. Try another PDF or Word file.")}</p>}<Button data-testid="onboarding-upload" disabled={busy} onClick={()=>picker.current?.click()}>{tr("选择简历","Choisir mon CV","Choose my CV")}</Button><Hint>PDF · Word · TXT · 12 MB</Hint></>}
      {stage===3&&<><h1>{tr("你的下一步，可以有哪些可能？","Quelles possibilités pour la suite ?","What could your next step look like?")}</h1>{cvFailed?<><p className="jp-cv-failure" role="alert">{progress.failure?.message||tr("简历已保存，分析暂未完成。可以直接继续，无需重新上传。","Votre CV est enregistré. Reprenez l’analyse sans renvoyer le fichier.","Your CV is saved. Continue the analysis without uploading it again.")}</p><Button disabled={busy} onClick={()=>p.retryV1()}>{tr("继续分析","Reprendre l’analyse","Continue analysis")}</Button></>:<><Hint>{progress.label||tr("正在读取简历","Lecture de votre CV","Reading your CV")}</Hint><div className="jp-cv-progress" data-testid="cv-analysis-progress" role="progressbar" aria-label={tr("简历分析预计进度","Progression estimée de l’analyse","Estimated CV analysis progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={waterPercent}><strong>{progress.status==="completed"?"100%":`≈${waterPercent}%`}</strong><Hint>{tr("你的优势与方向，即将浮现。","Vos atouts et vos pistes prennent forme.","Your strengths and directions are taking shape.")}</Hint></div></>}</>}
      {stage===4&&<><h1>{data.profile?.name?tr(`你好，${data.profile.name}。`,`Bonjour ${data.profile.name}.`,`Hi, ${data.profile.name}.`):tr("这是你会闪光的地方。","Voici vos atouts.","Here is where you stand out.")}</h1><div className="jp-stack">{rows(analysis.strengths).slice(0,3).map((s,i)=><section className="jp-card" key={i}><strong>{s.title}</strong><Hint>{s.evidence}</Hint></section>)}</div>{rows(analysis.growthAreas).slice(0,1).map((gap,i)=><p key={i}>{gap.nextAction}</p>)}<h2>{tr("你想先看看哪个方向？","Quelle piste vous attire ?","Which direction interests you?")}</h2><div className="jp-v1-direction-choice">{directions.map((d,i)=><button type="button" key={i} className={chosenQuery===d.searchQuery&&!customQuery?"selected":""} onClick={()=>{setChosenQuery(d.searchQuery);setCustomQuery("");}}>{d.title}</button>)}</div><label className="jp-field"><span>{tr("我有其他想法","J’ai une autre idée","I have something else in mind")}</span><input value={customQuery} onChange={e=>setCustomQuery(e.target.value)}/></label><Button data-testid="onboarding-search" disabled={busy||!(customQuery.trim()||chosenQuery)} onClick={search}>{tr("看看这些工作","Voir les offres","Show me the roles")}</Button></>}
      {stage===5&&<><AiProgressButton taskKind="search" onClick={()=>p.retryV1()}>{tr("搜索这个方向","Rechercher cette direction","Search this direction")}</AiProgressButton><h1>{empty?tr("这个方向暂时没有合适的岗位","Pas encore d’offre adaptée à cette piste","No suitable roles for this direction yet"):tr("为你挑选值得一试的工作","Une sélection qui vous correspond","Finding roles worth your time")}</h1>{!empty&&<Hint>{tr("每份工作都会带上匹配分、你的优势和提升建议。","Chaque offre avec son match, vos atouts et vos prochaines actions.","Each role comes with your match, strengths and ways to improve.")}</Hint>}{v.presentationFailed&&<Button disabled={busy} onClick={()=>p.retryV1()}>{tr("再试一次","Réessayer","Try again")}</Button>}<Button kind="text" onClick={()=>setChooseAgain(true)}>{tr("换个方向看看","Explorer une autre piste","Explore another direction")}</Button>{empty&&<Button kind="text" onClick={()=>void onDone()}>{tr("先进入首页","Aller à l’accueil","Go to Home")}</Button>}</>}
      {stage===6&&<><h1>{tr("这几份工作，值得你看看。","Ces offres méritent votre attention.","These roles are worth a look.")}</h1><div className="jp-v1-swipe-deck">{offers.map(offer=><FirstRunOffer key={offer.url} offer={offer} onClick={()=>void enterOffer(offer)}/>)}</div><Button onClick={()=>void onDone()}>{tr("继续探索","Continuer à explorer","Keep exploring")}</Button></>}
      {p.error&&<p role="alert">{p.error}</p>}
      {signedIn&&<Button kind="text" data-testid="onboarding-logout" disabled={busy||uploading} onClick={()=>p.logout()}>{tr("登出","Se déconnecter","Sign out")}</Button>}
    </div>
  </div>;
}

function FirstRunOffer({offer,onClick}:{offer:Json;onClick:()=>void}) {
  const {tr,product}=usePilot();
  const deep=offer.deepMatch||{},fast=offer.fastMatch||{};
  const score=Number(deep.currentScore??fast.score),potential=Number(deep.cvPotentialScore??score);
  const strengths=rows(deep.strengths).length?rows(deep.strengths).map(x=>x.title):rows(fast.strengths).map(x=>x.title);
  const gaps=rows(deep.capabilityGaps).length?rows(deep.capabilityGaps).map(x=>x.title):rows(fast.gaps).map(x=>x.title);
  return <button type="button" className="jp-v1-swipe-card" onClick={onClick}><div className="jp-row"><div className="jp-grow"><span className="jp-company">{offer.company}</span><h2>{offer.title}</h2></div><div className="jp-match100">{Number.isFinite(score)?Math.round(score):"—"}<span>/100</span></div></div><Hint>{[offer.location,offer.contractType!=="unknown"?product(offer.contractType):""].filter(Boolean).join(" · ")}</Hint><div className="jp-v1-signal-row">{strengths.slice(0,2).map((x,i)=><span className="jp-v1-plus" key={i}>+ {x}</span>)}</div><div className="jp-v1-signal-row">{gaps.slice(0,2).map((x,i)=><span className="jp-v1-minus" key={i}>− {x}</span>)}</div>{Number.isFinite(potential)&&potential>score&&<Hint>{tr(`简历优化：${Math.round(score)} → 预计 ${Math.round(potential)}/100`,`CV : ${Math.round(score)} → ~${Math.round(potential)}/100`,`CV edits: ${Math.round(score)} → ~${Math.round(potential)}/100`)}</Hint>}<strong className="jp-v1-card-cta">{tr("点开看详细匹配","Ouvrir le détail","Open detailed match")}</strong></button>;
}
