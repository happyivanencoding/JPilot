"use client";
import { useEffect, useRef, useState } from "react";
import { Home as HomeIcon, PersonOutline as ProfileIcon, Search as OffersIcon } from "./native-icons";
import { rows, usePilot, type Json } from "./pilot-context";
import { Button, Hint } from "./ui";

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

export function V1FirstRunOverlay({ onDone }: { onDone: () => void }) {
  const p=usePilot();
  const {data,detail,tr,busy,upload,startTask,request,refresh,navigate,execute,openOffer}=p;
  const picker=useRef<HTMLInputElement>(null);
  const [authStep,setAuthStep]=useState(0),[invite,setInvite]=useState(""),[cvConfirmed,setCvConfirmed]=useState(false);
  const [chosenTitle,setChosenTitle]=useState(""),[chosenQuery,setChosenQuery]=useState(""),[customQuery,setCustomQuery]=useState(""),[submittedQuery,setSubmittedQuery]=useState("");
  const ingest=detail?.kind==="ingest"?detail:null;
  const proposal=String(ingest?.result?.proposal||"");
  const [preview,setPreview]=useState("");
  useEffect(()=>{if(proposal)setPreview(proposal);},[proposal,ingest?.id]);
  const directions=rows(data.v1?.careerDirections),offers=rows(data.discovery?.offers).slice(0,4);
  const searchReady=Boolean(submittedQuery&&String(data.discovery?.query||"").toLowerCase()===submittedQuery.toLowerCase()&&offers.length&&!new Set(["queued","running","reconciling"]).has(String(data.v1?.searchState||"")));
  const analysisReady=String(data.v1?.analysisState||"")==="completed"&&directions.length>0;
  const stage=authStep<2?authStep:!cvConfirmed?2:!analysisReady?3:!submittedQuery?4:!searchReady?5:6;
  const extractedName=preview.split(/\r?\n/).map(line=>line.trim().replace(/^#+\s*/,"")).find(line=>line.length>=2&&line.length<=60&&!line.includes("@")&&!/^cv\b/i.test(line));
  const displayName=extractedName||String(data.profile?.name||"").split("—")[0].trim()||tr("你好","Bonjour","Hi");
  const confirmCv=()=>execute(async()=>{
    if(!ingest?.id||!preview.trim())return;
    await request("/api/mobile",{method:"POST",body:JSON.stringify({action:"confirmCv",profileId:p.profileId,taskId:ingest.id,confirmed:true,content:preview,expectedVersionId:data.cvState?.versionId,uiLocale:p.locale})});
    setCvConfirmed(true);navigate({tab:"home"},true);await refresh();
  });
  const search=()=>{
    const query=customQuery.trim()||chosenQuery;
    if(!query)return;
    setSubmittedQuery(query);void startTask({kind:"search",query,silent:true});
  };
  const enterOffer=(offer:Json)=>{onDone();openOffer(String(offer.url));};
  return <div className="jp-v1-first-run" role="dialog" aria-modal="true" data-testid="v1-first-run">
    <div className="jp-v1-first-run-head"><div className="jp-onboarding-mark"><span>J</span></div><strong>JobPilot</strong><span>{Math.min(stage+1,7)}/7</span></div>
    <div className="jp-v1-first-run-body" key={stage}>
      {stage===0&&<><h1>{tr("先验证你的邀请","Validez d’abord votre invitation","First, verify your invitation")}</h1><Hint>{tr("这是 V1 测试入口。输入邀请码后继续。","Entrée de test V1. Saisissez votre code d’invitation.","This is the V1 test entry. Enter your invite code to continue.")}</Hint><label className="jp-field"><span>{tr("邀请码","Code d’invitation","Invite code")}</span><input value={invite} onChange={e=>setInvite(e.target.value)} autoFocus /></label><Button disabled={!invite.trim()} onClick={()=>setAuthStep(1)}>{tr("继续","Continuer","Continue")}</Button></>}
      {stage===1&&<><h1>{tr("用 Google 账号继续","Continuez avec Google","Continue with Google")}</h1><Hint>{tr("当前 V1 预览使用模拟登录，不会打开或读取真实 Google 账号。","Cet aperçu V1 simule la connexion et n’accède à aucun compte Google réel.","This V1 preview simulates sign-in and does not access a real Google account.")}</Hint><div className="jp-v1-google-card"><strong>Google</strong><span>jobpilot.v1.test@gmail.com</span><Hint>{tr("测试账号","Compte de test","Test account")}</Hint></div><Button onClick={()=>setAuthStep(2)}>{tr("模拟 Google 登录","Simuler la connexion Google","Simulate Google sign-in")}</Button></>}
      {stage===2&&<><h1>{tr("先把你的简历交给我们","Commencez par votre CV","Start with your CV")}</h1><Hint>{tr("我们先提取事实，再给方向和职位。不会先替你改写简历。","Nous extrayons d’abord les faits, avant de proposer des directions et des postes.","We extract the facts first, then suggest directions and roles.")}</Hint><input ref={picker} type="file" hidden accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void upload(file);}} />
        {!ingest&&<><div className="jp-v1-upload-card"><strong>PDF / DOCX / TXT / MD</strong><Hint>{tr("最大 12 MB","12 Mo maximum","Up to 12 MB")}</Hint></div><Button disabled={busy} onClick={()=>picker.current?.click()}>{tr("上传我的简历","Importer mon CV","Upload my CV")}</Button></>}
        {ingest&&["queued","running","reconciling"].includes(String(ingest.status))&&<><div className="jp-progress indeterminate"/><h2>{tr("正在读取你的简历…","Lecture de votre CV…","Reading your CV…")}</h2><Hint>{tr("提取姓名、教育、经历、技能和项目。","Extraction du nom, de la formation, des expériences, compétences et projets.","Extracting name, education, experience, skills and projects.")}</Hint></>}
        {ingest?.status==="completed"&&preview&&<><h2>{tr("信息提取完成","Extraction terminée","CV extracted")}</h2><Hint>{ingest.result?.filename}</Hint><textarea className="jp-v1-cv-preview" value={preview} onChange={e=>setPreview(e.target.value)} /><Button disabled={busy||!preview.trim()} onClick={()=>void confirmCv()}>{tr("确认，开始分析","Confirmer et analyser","Confirm and analyze")}</Button></>}
        {ingest&&["failed","interrupted"].includes(String(ingest.status))&&<><h2>{tr("这份简历没有成功读取","Ce CV n’a pas pu être lu","This CV could not be read")}</h2><Hint>{ingest.error}</Hint><Button kind="outline" onClick={()=>picker.current?.click()}>{tr("重新选择文件","Choisir un autre fichier","Choose another file")}</Button></>}
      </>}
      {stage===3&&<><div className="jp-v1-orbit"/><h1>{tr("简历读完了。正在找你的闪光点。","CV lu. Nous cherchons maintenant vos points forts.","CV read. Now finding where you stand out.")}</h1><Hint>{tr("我们会把经历和可能的职业方向放在一起看。","Nous rapprochons votre parcours de plusieurs directions possibles.","We are matching your experience with possible career directions.")}</Hint></>}
      {stage===4&&<><h1>{tr(`你好，${displayName}。`,`Bonjour ${displayName}.`,`Hi, ${displayName}.`)}</h1><p className="jp-onboarding-lead">{tr("我们看了你的简历，这几个方向可能会让你更有优势。","Après lecture de votre CV, voici quelques directions où votre profil peut ressortir.","We read your CV. These directions may let your profile stand out.")}</p><div className="jp-v1-direction-choice">{directions.slice(0,5).map((direction,index)=>{const title=String(direction.title||""),query=String(direction.searchQuery||title);return <button type="button" className={chosenQuery===query?"selected":""} key={index} onClick={()=>{setChosenTitle(title);setChosenQuery(query);setCustomQuery("");}}>{title}</button>;})}</div><label className="jp-field"><span>{tr("或者告诉我你更想看什么","Ou dites-nous ce que vous voulez explorer","Or tell us what you want to explore")}</span><input value={customQuery} onChange={e=>{setCustomQuery(e.target.value);if(e.target.value.trim()){setChosenTitle(e.target.value.trim());setChosenQuery(e.target.value.trim());}}} /></label><Button disabled={!chosenQuery} onClick={search}>{tr("就看这个方向","Explorer cette direction","Explore this direction")}</Button></>}
      {stage===5&&<><div className="jp-v1-orbit"/><h1>{tr(`好，我们正在找 ${chosenTitle} 的职位。`,`Très bien. Nous cherchons des postes en ${chosenTitle}.`,`Got it. We’re finding ${chosenTitle} roles.`)}</h1><Hint>{tr("先找真实岗位，再给每个岗位快速评分。","D’abord de vraies offres, puis un score rapide pour chacune.","First real roles, then a quick score for each one.")}</Hint></>}
      {stage===6&&<><h1>{tr("找到了。先滑一滑。","Voici une première sélection.","Found them. Swipe through.")}</h1><Hint>{tr("左右滑动看 3–4 个职位；点卡片就进入正常职位详情。","Faites glisser pour parcourir 3–4 offres ; touchez une carte pour ouvrir le détail.","Swipe through 3–4 roles; tap a card to open the normal role detail.")}</Hint><div className="jp-v1-swipe-deck">{offers.map(offer=><FirstRunOffer key={offer.url} offer={offer} onClick={()=>enterOffer(offer)} />)}</div><Button onClick={onDone}>{tr("进入 JobPilot","Entrer dans JobPilot","Enter JobPilot")}</Button></>}
    </div>
  </div>;
}

function FirstRunOffer({offer,onClick}:{offer:Json;onClick:()=>void}) {
  const {tr,product}=usePilot();
  const deep=offer.deepMatch||{},fast=offer.fastMatch||{};
  const score=Number(deep.currentScore??fast.score),potential=Number(deep.cvPotentialScore??score);
  const strengths=rows(deep.strengths).length?rows(deep.strengths).map(x=>x.title):rows(fast.strengths).map(x=>x.title);
  const gaps=rows(deep.capabilityGaps).length?rows(deep.capabilityGaps).map(x=>x.title):rows(fast.gaps).map(x=>x.title);
  return <button type="button" className="jp-v1-swipe-card" onClick={onClick}><div className="jp-row"><div className="jp-grow"><span className="jp-company">{offer.company}</span><h2>{offer.title}</h2></div><div className="jp-match100">{Number.isFinite(score)?Math.round(score):"—"}<span>/100</span></div></div><Hint>{[offer.location,offer.contractType!=="unknown"?product(offer.contractType):""].filter(Boolean).join(" · ")}</Hint><div className="jp-v1-signal-row">{strengths.slice(0,2).map((x,i)=><span className="jp-v1-plus" key={i}>+ {x}</span>)}</div><div className="jp-v1-signal-row">{gaps.slice(0,2).map((x,i)=><span className="jp-v1-minus" key={i}>− {x}</span>)}</div>{Number.isFinite(potential)&&potential>score&&<Hint>{tr(`简历表达优化空间：约 ${Math.round(potential)}/100`,`Potentiel CV : ~${Math.round(potential)}/100`,`CV presentation potential: ~${Math.round(potential)}/100`)}</Hint>}<strong className="jp-v1-card-cta">{tr("点开看详细匹配","Ouvrir le détail","Open detailed match")}</strong></button>;
}
