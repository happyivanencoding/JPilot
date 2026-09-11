package com.thegreatnovel.jobpilot

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject

@Composable
private fun HomeIdentity(signal: JSONObject?): Pair<String,String> {
    val title=signal?.text("title").orEmpty()
    val lower=title.lowercase()
    val statement=when {
        Regex("system|syst[eè]m|struct|architect|framework").containsMatchIn(lower) -> tr("你擅长把复杂问题理清。","Vous pensez en systèmes.","You think in systems.")
        Regex("data|anal|quant|model|insight").containsMatchIn(lower) -> tr("你会从数据里看到方向。","Vous voyez ce que les données suggèrent.","You see where the data points.")
        Regex("strateg|strat[eé]g|prior|decision").containsMatchIn(lower) -> tr("你先看结构，再做判断。","Vous voyez la structure avant le bruit.","You see structure before noise.")
        Regex("commun|stakeholder|client|people|collab").containsMatchIn(lower) -> tr("你会把想法变成共识。","Vous reliez les idées aux personnes.","You connect ideas with people.")
        Regex("deliver|execut|impact|result|build").containsMatchIn(lower) -> tr("你会把分析变成行动。","Vous transformez l’analyse en action.","You turn analysis into action.")
        title.isNotBlank() -> title
        else -> tr("你的经历已经形成一条主线。","Votre parcours dessine déjà une direction.","Your experience already points somewhere.")
    }
    return statement to (signal?.text("evidence")?.ifBlank {signal.text("why")} ?: "")
}

@Composable
fun V1OverviewScreen(state: PilotState, vm: JobPilotViewModel, onExplore: () -> Unit, onProfile: () -> Unit) {
    val hasCv = state.snapshot.text("cv").isNotBlank()
    val v1 = state.snapshot.child("v1")
    val directions = v1.objects("careerDirections")
    val offers = state.snapshot.child("discovery").objects("offers").take(3)
    val signals = state.snapshot.child("analysis").objects("strengths").ifEmpty {state.snapshot.child("analysis").child("globalLayout").objects("signals")}
    val identity=HomeIdentity(signals.firstOrNull())
    val name=state.snapshot.child("profile").text("name").trim().substringBefore(' ').takeIf(String::isNotBlank)
    LazyColumn(
        Modifier.fillMaxSize(),
        state = analyticsListState(vm),
        contentPadding = PaddingValues(horizontal=22.dp,vertical=18.dp),
        verticalArrangement = Arrangement.spacedBy(0.dp),
        overscrollEffect = null,
    ) {
        item {
            Box(Modifier.fillMaxWidth().heightIn(min=if(hasCv)170.dp else 136.dp)) {
                OnwardHalo(Modifier.size(220.dp).align(Alignment.TopEnd).offset(x=82.dp,y=(-35).dp))
                Column(Modifier.fillMaxWidth(.86f),verticalArrangement=Arrangement.spacedBy(5.dp)) {
                    Text(
                        if(name!=null)tr("你好，$name。","Bonjour, $name.","Hello, $name.")else tr("你好。","Bonjour.","Hello."),
                        style=MaterialTheme.typography.bodySmall,
                        color=MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if(hasCv) {
                        Text(identity.first,style=MaterialTheme.typography.displayLarge)
                        if(identity.second.isNotBlank()) Text(identity.second,style=MaterialTheme.typography.bodyMedium,color=MaterialTheme.colorScheme.onSurfaceVariant,maxLines=3)
                    } else Text(tr("你的下一章，从这里开始。","Votre prochain chapitre commence ici.","Your next chapter starts here."),style=MaterialTheme.typography.displayLarge)
                }
            }
        }
        if (!hasCv) item {
            Column(Modifier.fillMaxWidth().padding(bottom=30.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Hint(tr("上传简历，Onward 会从你的真实经历出发，找出值得探索的方向与岗位。","Importez votre CV : Onward part de votre parcours réel pour faire émerger les directions et les offres à explorer.","Upload your CV and Onward will use your real experience to surface directions and roles worth exploring."))
                PrimaryButton(tr("上传我的简历", "Importer mon CV", "Upload my CV")) { onProfile() }
            }
        } else {
            if(v1.child("cvProgress").text("status")=="failed") item {
                GlassCard { Hint(v1.child("cvProgress").child("failure").text("message")); PrimaryButton(tr("继续分析","Reprendre l’analyse","Continue analysis"),!state.working) {vm.retryV1()} }
            }
            item {
                OnwardReveal(35) {
                    Column(Modifier.fillMaxWidth().padding(bottom=30.dp),verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(tr("值得探索的方向", "Directions à explorer", "Directions to explore"), Modifier.weight(1f), style=MaterialTheme.typography.headlineSmall)
                            TextButton(onProfile) { Text(tr("调整", "Modifier", "Edit")) }
                        }
                        if (directions.isEmpty() && v1.optBoolean("backgroundActive")) {
                            LinearProgressIndicator(Modifier.fillMaxWidth().height(3.dp)); Hint(tr("为你准备新的方向。", "De nouvelles pistes se préparent.", "New possibilities are on their way."))
                        } else directions.take(4).forEachIndexed { index,direction ->
                            OnwardReveal(index*32) {
                                Row(
                                    Modifier.fillMaxWidth().onwardPress { vm.startTask(json("kind" to "search","query" to direction.text("searchQuery"),"silent" to true));onExplore() }.padding(vertical=9.dp),
                                    verticalAlignment=Alignment.CenterVertically,
                                    horizontalArrangement=Arrangement.spacedBy(11.dp),
                                ) {
                                    DirectionMedallion(direction.text("title"))
                                    Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(2.dp)) {
                                        Text(direction.text("title"),style=MaterialTheme.typography.titleMedium)
                                        direction.strings("evidence").take(2).joinToString(" · ").takeIf { it.isNotBlank() }?.let { Text(it,style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant,maxLines=1) }
                                    }
                                    Icon(Icons.Rounded.ArrowForward,null,Modifier.size(17.dp),tint=MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            HorizontalDivider(thickness=.6.dp,color=MaterialTheme.colorScheme.outlineVariant)
                        }
                    }
                }
            }
            if (offers.isNotEmpty()) {
                item {
                    OnwardReveal(70) {
                        Row(Modifier.fillMaxWidth().padding(bottom=4.dp),verticalAlignment = Alignment.CenterVertically) {
                            Text(tr("今天值得看的岗位", "Pour vous aujourd’hui", "For you today"), Modifier.weight(1f), style=MaterialTheme.typography.headlineSmall)
                            TextButton(onExplore) { Text(tr("全部", "Tout voir", "See all")) }
                        }
                    }
                }
                items(offers, key = { it.text("url") }) { offer -> V1OfferCard(offer) { vm.selectOffer(offer.text("url")) } }
                item {Spacer(Modifier.height(18.dp))}
            }
        }
    }
}

@Composable
fun V1ExploreScreen(state:PilotState,vm:JobPilotViewModel) {
    val v1=state.snapshot.child("v1");val directions=v1.objects("careerDirections")
    val discovery=state.snapshot.child("discovery");val offers=discovery.objects("offers");val history=discovery.objects("history")
    val suggested=v1.child("journey").text("label").ifBlank {directions.firstOrNull()?.text("title").orEmpty()}
    var query by rememberSaveable(state.profileId){mutableStateOf(suggested)}
    var previousSuggestion by rememberSaveable(state.profileId){mutableStateOf(suggested)}
    var showFilters by rememberSaveable(state.profileId){mutableStateOf(false)}
    LaunchedEffect(suggested){if(query==previousSuggestion||query.isBlank())query=suggested;previousSuggestion=suggested}
    LazyColumn(Modifier.fillMaxSize(),state=analyticsListState(vm),contentPadding=PaddingValues(horizontal=22.dp,vertical=18.dp),verticalArrangement=Arrangement.spacedBy(0.dp),overscrollEffect=null) {
        item {
            Column(Modifier.padding(bottom=24.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {
                Text(tr("机会","Opportunités","Opportunities"),style=MaterialTheme.typography.displayMedium)
                Text(tr("根据你的经历挑选的岗位。","Des postes choisis à partir de votre parcours.","Roles selected from your experience."),style=MaterialTheme.typography.bodyMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        item {
            Column(Modifier.padding(bottom=32.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(query,{query=it},Modifier.fillMaxWidth(),label={Text(tr("搜索职位或公司","Rechercher un poste, une entreprise…","Search a role or company…"))},singleLine=true,shape=RoundedCornerShape(7.dp))
                AiProgressButton(state,"search",label=tr("搜索","Rechercher","Search"),enabled=query.isNotBlank()&&!state.working) {
                    val search=directions.find {it.text("title")==query}?.text("searchQuery")?:query
                    vm.startTask(json("kind" to "search","query" to search,"silent" to true))
                }
                v1.text("searchNotice").takeIf {it.isNotBlank()}?.let {Hint(it)}
                state.error?.let {Text(it,color=MaterialTheme.colorScheme.error,fontSize=13.sp)}
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(bottom=10.dp),verticalAlignment=Alignment.CenterVertically) {
                Text(tr("${offers.size} 个为你挑选的机会","${offers.size} opportunités sélectionnées pour vous","${offers.size} opportunities selected for you"),Modifier.weight(1f),style=MaterialTheme.typography.bodySmall)
                TextButton({showFilters=!showFilters}) {Text(tr("筛选","Filtres","Filters"))}
            }
        }
        if(showFilters) item {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom=12.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                directions.forEach {direction->FilterChip(selected=query==direction.text("title"),onClick={query=direction.text("title")},label={Text(direction.text("title"),maxLines=1)})}
            }
        }
        if(offers.isEmpty()) item {
            Column(Modifier.padding(top=12.dp,bottom=24.dp),verticalArrangement=Arrangement.spacedBy(10.dp)) {
                if(v1.optBoolean("presentationFailed")) {Text(tr("这次没有准备好，请再试一次","La sélection n’est pas encore prête","This selection needs another try"));PrimaryButton(tr("重试","Réessayer","Retry"),!state.working){vm.retryV1()}}
                else if(!v1.optBoolean("backgroundActive")) Hint(tr("还没有找到这个方向的合适岗位，试试其他方向。","Pas d’offre adaptée pour le moment. Essayez une autre piste.","No suitable roles yet. Try another direction."))
            }
        }
        items(offers,key={it.text("url")}) {offer->V1OfferCard(offer){vm.selectOffer(offer.text("url"))}}
        if(history.isNotEmpty()) item {Text(tr("之前看过的方向","Recherches précédentes","Previously explored"),Modifier.padding(top=28.dp,bottom=6.dp),style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.SemiBold)}
        history.forEach {group->
            val key=group.text("directionKey",group.text("taskId"))
            item(key="history-$key") {
                var expanded by rememberSaveable(state.profileId,key){mutableStateOf(false)}
                Column {
                    Row(Modifier.fillMaxWidth().clickable {expanded=!expanded}.padding(vertical=12.dp),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Rounded.ExpandMore,if(expanded)tr("收起","Réduire","Collapse")else tr("展开","Développer","Expand"),Modifier.size(20.dp).rotate(if(expanded)180f else 0f),tint=MaterialTheme.colorScheme.primary)
                        Text(group.text("label").ifBlank {tr("之前的方向","Piste précédente","Previous direction")},Modifier.weight(1f),style=MaterialTheme.typography.titleMedium)
                        val count=group.objects("offers").size
                        Hint(tr("${count} 个岗位","${count} offres","${count} roles"))
                    }
                    AnimatedVisibility(expanded) {Column {group.objects("offers").forEach {offer->V1OfferCard(offer){vm.selectOffer(offer.text("url"))}}}}
                    HorizontalDivider(thickness=.6.dp,color=MaterialTheme.colorScheme.outlineVariant)
                }
            }
        }
        item {Spacer(Modifier.height(18.dp))}
    }
}

@Composable
private fun V1OfferCard(offer: JSONObject, onClick: () -> Unit) {
    val deep = offer.child("deepMatch")
    val fast = offer.child("fastMatch")
    val score = if(offer.child("matchScore").has("current"))offer.child("matchScore").optInt("current") else if (deep.has("currentScore")) deep.optInt("currentScore") else fast.optInt("score", -1)
    val roleCv=offer.child("roleCv")
    Row(
        Modifier.fillMaxWidth().testTag("offer-${offer.text("url").hashCode()}").onwardPress(onClick).padding(vertical=13.dp),
        verticalAlignment=Alignment.CenterVertically,
        horizontalArrangement=Arrangement.spacedBy(10.dp),
    ) {
        CompanyMark(offer.text("company"))
        Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(2.dp)) {
            Text(offer.text("title"),style=MaterialTheme.typography.titleMedium,maxLines=2)
            Text(offer.text("company"),style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
            OnwardMeta(offer.text("location"),offer.text("contractType").takeIf{it!="unknown"}.orEmpty())
            if(roleCv.length()>0) Text(when(roleCv.text("status")){"generating"->tr("岗位简历准备中","CV en préparation","Preparing role CV");"pending"->tr("岗位简历已就绪 · 待确认","CV prêt · à confirmer","Role CV ready · review");else->tr("已保留岗位简历","CV ciblé conservé","Role CV saved")},fontSize=9.sp,color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.SemiBold)
        }
        MatchLabel(score)
        Icon(Icons.Rounded.ArrowForward,null,Modifier.size(16.dp),tint=MaterialTheme.colorScheme.onSurfaceVariant)
    }
    HorizontalDivider(thickness=.6.dp,color=MaterialTheme.colorScheme.outlineVariant)
}

@Composable
fun V1MatchBadge(score: Int) {
    Column(horizontalAlignment = Alignment.End) {
        Text(if (score >= 0) score.toString() else "—", style=MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.primary)
        Text("/100", style=MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** Discovery and saved roles use the same detail surface. Browsing does not save. */
@Composable
fun V1OfferDetailSheet(offer:JSONObject,state:PilotState,vm:JobPilotViewModel) {
    val saved=state.snapshot.objects("jobs").find {it.text("url")==offer.text("url")}
    val watchedJobId=saved?.text("id")?.takeIf(String::isNotBlank)
    // Discovery cards can point at an already-saved candidature. Keep that
    // saved result in the display-localization poll set while the sheet is
    // visible, otherwise a newly started translation can remain "pending"
    // forever because selectedOffer is URL-based rather than selectedJob-based.
    DisposableEffect(watchedJobId,state.language) {
        vm.watchJobDisplays(setOfNotNull(watchedJobId))
        onDispose { vm.watchJobDisplays(emptySet()) }
    }
    val deep=offer.child("deepMatch");val fast=offer.child("fastMatch");val scores=offer.child("matchScore")
    val current=scores.optInt("baseline",deep.optInt("currentScore",fast.optInt("score",-1)))
    val view=saved ?: json("id" to "", "url" to offer.text("url"),"role" to offer.text("title"),"company" to offer.text("company"),"location" to offer.text("location"),"contract" to offer.text("contractType"),"status" to "À candidater", "matchScore" to scores,
        "v1Match" to json("currentScore" to current,"displayScore" to scores.optInt("current",current),"cvPotentialScore" to scores.optInt("forecast",deep.optInt("cvPotentialScore",current)),"deepMatch" to deep))
    V1SavedJobDetailSheet(view,state,vm,offer)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun V1SavedJobDetailSheet(job: JSONObject, state: PilotState, vm: JobPilotViewModel, offer:JSONObject?=null) {
    val context = LocalContext.current
    val roleKey=job.text("url",job.text("id"))
    val saved=job.text("id").isNotBlank()
    val hasCv=job.child("cvDraft").text("status")=="pending" || job.child("cv").text("file").isNotBlank()
    var tab by rememberSaveable(roleKey) { mutableIntStateOf(state.selectedJobTab.coerceIn(0, 2)) }
    val match = job.child("v1Match")
    val deep = match.child("deepMatch")
    val current = match.optInt("currentScore", match.optInt("displayScore", -1))
    val display = match.optInt("displayScore", current)
    LaunchedEffect(tab,roleKey,state.cvPreview,state.previewLoading) {if(state.cvPreview==null&&!state.previewLoading)vm.analytics.navigate(listOf("job_match","job_cv","job_tracking")[tab],when(tab){1->"view_cv";2->"tracking";else->null})}
    var reply by rememberSaveable(roleKey) {mutableStateOf(job.child("followup").text("replyNote"))}
    var status by rememberSaveable(roleKey) { mutableStateOf(job.text("status")) }
    var statusMenu by remember { mutableStateOf(false) }
    var nextAction by rememberSaveable(roleKey) { mutableStateOf(if(job.child("followup").text("nextActionSource")=="user")job.child("followup").text("nextAction")else "") }
    val trackingKey=vm.trackingKey(job,offer)
    DisposableEffect(trackingKey){onDispose {vm.flushTracking(trackingKey)}}
    var date by rememberSaveable(roleKey) { mutableStateOf(job.child("followup").text("dueDate")) }
    var note by rememberSaveable(roleKey) { mutableStateOf(job.child("followup").text("note")) }
    ModalBottomSheet(onDismissRequest = { if(offer!=null)vm.selectOffer(null)else vm.selectJob(null) }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), modifier = Modifier.imePadding()) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.92f).blockSheetEdgeMotion().testTag("v1-saved-job-detail")) {
            Box(Modifier.fillMaxWidth().padding(horizontal=22.dp,vertical=10.dp)) {
                OnwardHalo(Modifier.size(190.dp).align(Alignment.TopEnd).offset(x=74.dp,y=(-34).dp))
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.Top,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
                    CompanyMark(job.text("company"),size=48)
                    Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(5.dp)) {
                        Text(job.text("company"),color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.labelLarge)
                        Text(job.text("role"),style=MaterialTheme.typography.headlineMedium,maxLines=3)
                        OnwardMeta(job.text("location"),product(job.text("contract")))
                        FlowRow(horizontalArrangement=Arrangement.spacedBy(6.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {
                            job.text("contract").takeIf {it.isNotBlank()&&it!="unknown"}?.let {Pill(product(it))}
                            job.text("workMode").takeIf(String::isNotBlank)?.let {Pill(product(it),warm=true)}
                        }
                    }
                    if(display>=0) AnimatedMatchScore(display)
                }
            }
            val labels = listOf(tr("匹配", "Match", "Fit"), "CV", tr("跟踪", "Suivi", "Tracking"))
            TabRow(tab, containerColor = androidx.compose.ui.graphics.Color.Transparent) {
                labels.forEachIndexed { index, label ->
                    val locked=index==1&&!hasCv
                    Tab(tab==index,{vm.analytics.click(listOf("tab_match","tab_cv","tab_tracking")[index]);tab=index},modifier=Modifier.testTag("job-tab-$index"),unselectedContentColor=if(locked)MaterialTheme.colorScheme.onSurface.copy(alpha=.44f)else MaterialTheme.colorScheme.onSurfaceVariant,text={Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(5.dp)){if(locked)Icon(Icons.Rounded.Lock,tr("待生成","À créer","Not generated"),Modifier.size(13.dp));Text(label,fontSize=13.sp)}})
                }
            }
            LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("job-content"), state=key(tab){analyticsListState(vm)}, contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(16.dp), overscrollEffect = null) {
                item { LocalizationNotice(job.child("localization"), vm::retryLocalization) }
                when (tab) {
                    0 -> if(job.child("localization").optBoolean("pending")) {
                        item {
                            Hint(tr("为你准备岗位建议","Vos conseils se préparent","Your role insights are on their way"))
                            if(!job.child("localization").optBoolean("failed")) LinearProgressIndicator(Modifier.fillMaxWidth().height(3.dp))
                        }
                    } else {
                        if(current>=0) item {
                            Column(Modifier.fillMaxWidth().padding(bottom=2.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
                                Text(tr("你的匹配","Votre correspondance","Your match"),style=MaterialTheme.typography.headlineSmall)
                                deep.text("roleSummary").takeIf(String::isNotBlank)?.let {Text(it,style=MaterialTheme.typography.bodyMedium,color=MaterialTheme.colorScheme.onSurfaceVariant)}
                                OnwardCvOutcome(job,detail=true)
                            }
                        }
                        val strengths=deep.objects("strengths")
                        if(strengths.isNotEmpty()) item {
                            EditorialSection(tr("为什么这个岗位适合你","Pourquoi ce poste vous va","Why this role fits")) {
                                strengths.take(5).forEach {item->SemanticRow(item.text("title"),item.text("evidence"))}
                            }
                        }
                        val gaps=deep.objects("capabilityGaps")
                        if(gaps.isNotEmpty()) item {
                            EditorialSection(tr("需要补强","À renforcer","To strengthen")) {
                                gaps.take(5).forEach {item->SemanticRow(item.text("title"),item.text("nextAction").ifBlank {item.text("why")},kind="gap")}
                            }
                        }
                        val presentation=deep.objects("presentationGaps")
                        if(presentation.isNotEmpty()) item {
                            EditorialSection(tr("简历表达可以更好","À mieux présenter dans le CV","CV presentation to sharpen")) {
                                presentation.take(4).forEach {item->SemanticRow(item.text("title"),item.text("why"),kind="document")}
                            }
                        }
                        item {
                            EditorialSection(tr("建议操作","Actions suggérées","Suggested actions")) {
                                Row(Modifier.fillMaxWidth().clickable {tab=1}.padding(vertical=2.dp)) {SemanticRow(tr("为这个岗位创建 CV","Créer un CV ciblé pour ce poste","Create a targeted CV for this role"),kind="document",chevron=true)}
                                Row(Modifier.fillMaxWidth().clickable {runCatching {context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(job.text("url"))))}}.padding(vertical=2.dp)) {SemanticRow(tr("查看公司与原始职位","Découvrir l’entreprise et l’annonce","View the company and original posting"),kind="company",chevron=true)}
                            }
                        }
                        if (deep.length() == 0 && job.text("summary").isNotBlank()) item { GlassCard { Text(tr("历史岗位判断", "Lecture historique du poste", "Historical role assessment"), fontWeight = FontWeight.SemiBold); Markdown(job.text("summary")) } }
                        if (job.text("reportNum").isNotBlank()) item { TextButton({ vm.openReport(job) }) { Text(tr("查看历史正式报告", "Lire le rapport historique", "Read historical formal report")) } }
                    }
                    1 -> {
                        val cv = job.child("cv")
                        val draft = job.child("cvDraft")
                        val pending = draft.text("status") == "pending"
                        val masterId = state.snapshot.child("cvState").text("versionId")
                        item {
                            EditorialSection(tr("岗位版简历", "Votre CV pour cette offre", "Your CV for this role")) {
                                if(!hasCv) Icon(Icons.Rounded.Lock,null,Modifier.size(28.dp),tint=MaterialTheme.colorScheme.onSurfaceVariant)
                                if(!hasCv) Hint(tr("根据这份岗位要求，重新组织你已有的经历。由你决定是否生成和保留。","Présentez votre parcours pour cette offre. Vous décidez de créer et de conserver le CV.","Present your existing experience for this role. You choose whether to generate and keep it."))
                                if(pending) PrimaryButton(tr("查看你的岗位版简历","Voir votre CV ciblé","View your role CV"),!state.working){vm.openCvPreview(job=job,tailoredDraftId=draft.text("id"))}
                                if (cv.text("file").isNotBlank()) OutlinedButton({ vm.openCvPreview(job = job) }, Modifier.fillMaxWidth()) { Text(tr("查看已保留的岗位版 CV", "Voir le CV ciblé conservé", "View saved role CV")) }
                                if(!pending && (cv.text("file").isBlank() || cv.text("inputVersionId")!=masterId)) {
                                    if(cv.text("file").isNotBlank()) Hint(tr("简历有更新，可以生成新版。","Votre CV a changé. Vous pouvez créer une nouvelle version.","Your CV has changed. You can create a new version."))
                                    AiProgressButton(state,"cv",job.text("id").takeIf {saved},tr("生成我的岗位专属简历","Créer mon CV pour cette offre","Generate my role-specific CV"),enabled=!state.working){if(offer!=null)vm.tailorOffer(offer)else vm.startTask(json("kind" to "cv","jobId" to job.text("id"),"retry" to true))}
                                }
                            }
                        }
                        if (draft.length() > 0) item { TailoredCvDraftCard(job, state, vm) }
                        state.error?.let {message->item {Text(message,color=MaterialTheme.colorScheme.error)}}
                    }
                    else -> item {
                        EditorialSection(tr("投递状态", "Statut de candidature", "Application status")) {
                            Box {
                                OutlinedButton({ statusMenu = true }, Modifier.fillMaxWidth()) { Text(product(status), Modifier.weight(1f)); Icon(Icons.Rounded.ExpandMore, null) }
                                DropdownMenu(statusMenu, { statusMenu = false }) { state.snapshot.strings("statuses").forEach { value -> DropdownMenuItem(text = { Text(product(value)) }, onClick = { status = value; statusMenu = false;vm.queueTracking(job,offer,json("status" to value),true) }) } }
                            }
                            OutlinedTextField(nextAction, { nextAction = it;vm.queueTracking(job,offer,json("nextAction" to it)) }, Modifier.fillMaxWidth(), label = { Text(tr("下一步行动", "Prochaine action", "Next action")) }, shape = RoundedCornerShape(7.dp))
                            DateField(date, { date = it;vm.queueTracking(job,offer,json("dueDate" to it),true) }, tr("跟进日期", "Date de relance", "Follow-up date"))
                            OutlinedTextField(reply,{reply=it;vm.queueTracking(job,offer,json("replyNote" to it))},Modifier.fillMaxWidth(),label={Text(tr("收到的回复","Réponse reçue","Reply received"))},minLines=2,shape=RoundedCornerShape(7.dp))
                            OutlinedTextField(note, { note = it;vm.queueTracking(job,offer,json("note" to it)) }, Modifier.fillMaxWidth(), label = { Text(tr("我的备注", "Mes notes", "My notes")) }, minLines = 3, shape = RoundedCornerShape(7.dp))
                            TrackingSaveState(state.trackingStates[trackingKey]) {vm.flushTracking(trackingKey)}
                        }
                    }
                }
                item { Spacer(Modifier.navigationBarsPadding()) }
            }
        }
    }
}
