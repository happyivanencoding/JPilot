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
fun V1OverviewScreen(state: PilotState, vm: JobPilotViewModel, onExplore: () -> Unit, onProfile: () -> Unit) {
    val hasCv = state.snapshot.text("cv").isNotBlank()
    val v1 = state.snapshot.child("v1")
    val directions = v1.objects("careerDirections")
    val offers = state.snapshot.child("discovery").objects("offers").take(3)
    val signals = state.snapshot.child("analysis").objects("strengths").ifEmpty {state.snapshot.child("analysis").child("globalLayout").objects("signals")}
    LazyColumn(
        Modifier.fillMaxSize(),
        state = analyticsListState(vm),
        contentPadding = PaddingValues(horizontal=22.dp,vertical=18.dp),
        verticalArrangement = Arrangement.spacedBy(22.dp),
        overscrollEffect = null,
    ) {
        item {
            Box(Modifier.fillMaxWidth().heightIn(min=110.dp)) {
                OnwardHalo(Modifier.size(170.dp).align(Alignment.TopEnd).offset(x=58.dp,y=(-26).dp))
                Column(Modifier.fillMaxWidth(.82f),verticalArrangement=Arrangement.spacedBy(7.dp)) {
                    state.snapshot.child("profile").text("name").takeIf(String::isNotBlank)?.let { Hint(it) }
                    EditorialTitle(tr("这是你会闪光的地方。", "Voici où votre profil peut vraiment ressortir.", "Here is where you can stand out."),large=true)
                }
            }
        }
        if (!hasCv) item {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(tr("上传一份简历，从真实岗位开始判断。", "Importez votre CV et comparez-le à de vraies offres.", "Upload your CV and compare it with real roles."), style=MaterialTheme.typography.headlineMedium)
                Hint(tr("Onward 会先理解你的经历，再给出适合探索的职业方向和岗位。", "Onward comprend d’abord votre parcours, puis propose des directions et des offres à explorer.", "Onward first understands your experience, then suggests directions and roles to explore."))
                PrimaryButton(tr("上传我的简历", "Importer mon CV", "Upload my CV")) { onProfile() }
            }
        } else {
            if(v1.child("cvProgress").text("status")=="failed") item {
                GlassCard {
                    Hint(v1.child("cvProgress").child("failure").text("message"))
                    PrimaryButton(tr("继续分析","Reprendre l’analyse","Continue analysis"),!state.working) {vm.retryV1()}
                }
            }
            if (signals.isNotEmpty()) item {
                EditorialSection(tr("你的优势在哪", "Vos points forts", "Where your strengths are")) {
                    signals.take(4).forEachIndexed { index,signal ->
                        Column(Modifier.fillMaxWidth().padding(vertical=4.dp),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                            Text(signal.text("title"),style=MaterialTheme.typography.titleMedium)
                            signal.text("evidence").takeIf { it.isNotBlank() }?.let { Hint(it) }
                        }
                        if(index<signals.take(4).lastIndex) HorizontalDivider(thickness=.6.dp,color=MaterialTheme.colorScheme.outlineVariant)
                    }
                }
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(tr("这些方向可能更适合你发力", "Des directions où votre profil peut ressortir", "Directions where your profile may stand out"), Modifier.weight(1f), style=MaterialTheme.typography.headlineSmall)
                        TextButton(onProfile) { Text(tr("调整", "Modifier", "Edit")) }
                    }
                    if (directions.isEmpty() && v1.optBoolean("backgroundActive")) {
                        LinearProgressIndicator(Modifier.fillMaxWidth())
                        Hint(tr("为你准备新的方向。", "De nouvelles pistes se préparent.", "New possibilities are on their way."))
                    } else directions.take(5).forEach { direction ->
                        Column(
                            Modifier.fillMaxWidth().clickable { vm.startTask(json("kind" to "search","query" to direction.text("searchQuery"),"silent" to true));onExplore() }.padding(vertical=11.dp),
                            verticalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(direction.text("title"), Modifier.weight(1f), style=MaterialTheme.typography.titleMedium)
                                Icon(Icons.Rounded.ArrowForward, null, Modifier.size(17.dp), tint = MaterialTheme.colorScheme.primary)
                            }
                            direction.strings("evidence").take(2).joinToString(" · ").takeIf { it.isNotBlank() }?.let { Hint(it) }
                        }
                        HorizontalDivider(thickness=.6.dp,color=MaterialTheme.colorScheme.outlineVariant)
                    }
                }
            }
            if (offers.isNotEmpty()) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(tr("先试这几个真实岗位", "Essayez d’abord ces offres", "Try these real roles first"), Modifier.weight(1f), style=MaterialTheme.typography.headlineSmall)
                        TextButton(onExplore) { Text(tr("全部", "Tout voir", "See all")) }
                    }
                }
                items(offers, key = { it.text("url") }) { offer -> V1OfferCard(offer) { vm.selectOffer(offer.text("url")) } }
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
    LaunchedEffect(suggested){if(query==previousSuggestion||query.isBlank())query=suggested;previousSuggestion=suggested}
    LazyColumn(Modifier.fillMaxSize(),state=analyticsListState(vm),contentPadding=PaddingValues(horizontal=22.dp,vertical=18.dp),verticalArrangement=Arrangement.spacedBy(18.dp),overscrollEffect=null) {
        item {SectionTitle(tr("机会","Opportunités","Opportunities"),tr("看看你和工作的契合点。","Découvrez les postes qui vous correspondent.","Find the work that fits you."))}
        item {
            Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(query,{query=it},Modifier.fillMaxWidth(),label={Text(tr("我想看看什么工作","Quel poste voulez-vous explorer ?","What role would you like to explore?"))},singleLine=true,shape=RoundedCornerShape(7.dp))
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    directions.forEach {direction->FilterChip(selected=query==direction.text("title"),onClick={query=direction.text("title")},label={Text(direction.text("title"),maxLines=1)})}
                }
                AiProgressButton(state,"search",label=tr("搜索这个方向","Rechercher cette direction","Search this direction"),enabled=query.isNotBlank()&&!state.working) {
                    val search=directions.find {it.text("title")==query}?.text("searchQuery")?:query
                    vm.startTask(json("kind" to "search","query" to search,"silent" to true))
                }
                v1.text("searchNotice").takeIf {it.isNotBlank()}?.let {Hint(it)}
                state.error?.let {Text(it,color=MaterialTheme.colorScheme.error,fontSize=13.sp)}
            }
        }
        if(offers.isNotEmpty()) item {Text(tr("最值得先看的岗位","À regarder en premier","Roles worth a look"),fontWeight=FontWeight.SemiBold)}
        if(offers.isEmpty()) item {
            Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
                if(v1.optBoolean("presentationFailed")) {Text(tr("这次没有准备好，请再试一次","La sélection n’est pas encore prête","This selection needs another try"));PrimaryButton(tr("重试","Réessayer","Retry"),!state.working){vm.retryV1()}}
                else if(!v1.optBoolean("backgroundActive")) Hint(tr("还没有找到这个方向的合适岗位，试试其他方向。","Pas d’offre adaptée pour le moment. Essayez une autre piste.","No suitable roles yet. Try another direction."))
            }
        }
        items(offers,key={it.text("url")}) {offer->V1OfferCard(offer){vm.selectOffer(offer.text("url"))}}
        if(history.isNotEmpty()) item {Text(tr("之前看过的方向","Recherches précédentes","Previously explored"),fontWeight=FontWeight.SemiBold)}
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
                    AnimatedVisibility(expanded) {Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {group.objects("offers").forEach {offer->V1OfferCard(offer){vm.selectOffer(offer.text("url"))}}}}
                    HorizontalDivider(thickness=.6.dp,color=MaterialTheme.colorScheme.outlineVariant)
                }
            }
        }
    }
}

@Composable
private fun V1OfferCard(offer: JSONObject, onClick: () -> Unit) {
    val deep = offer.child("deepMatch")
    val fast = offer.child("fastMatch")
    val score = if(offer.child("matchScore").has("current"))offer.child("matchScore").optInt("current") else if (deep.has("currentScore")) deep.optInt("currentScore") else fast.optInt("score", -1)
    val strengths = if (deep.objects("strengths").isNotEmpty()) deep.objects("strengths").map { it.text("title") } else fast.objects("strengths").map { it.text("title") }
    val gaps = if (deep.objects("capabilityGaps").isNotEmpty()) deep.objects("capabilityGaps").map { it.text("title") } else fast.objects("gaps").map { it.text("title") }
    Column(
        Modifier.fillMaxWidth().testTag("offer-${offer.text("url").hashCode()}").clickable(onClick=onClick).padding(vertical=13.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
            if(offer.child("roleCv").length()>0) Pill(when(offer.child("roleCv").text("status")) {"generating"->tr("岗位简历准备中","CV en préparation","Preparing role CV");"pending"->tr("岗位简历已就绪 · 待确认","CV prêt · à confirmer","Role CV ready · review");else->tr("已保留岗位简历","CV ciblé conservé","Role CV saved")})
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(offer.text("company"), style=MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    Text(offer.text("title"), style=MaterialTheme.typography.titleLarge)
                }
                V1MatchBadge(score)
            }
            Hint(listOf(offer.text("location"), product(offer.text("contractType"))).filter { it.isNotBlank() && it != "unknown" }.joinToString(" · "))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                strengths.take(2).forEach { Pill("+ $it") }
                gaps.take(2).forEach { Pill("− $it", warm = true) }
            }
            OnwardCvOutcome(offer)
            HorizontalDivider(Modifier.padding(top=4.dp),thickness=.6.dp,color=MaterialTheme.colorScheme.outlineVariant)
    }
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
            Row(Modifier.padding(horizontal = 22.dp, vertical = 8.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(job.text("company"), color = MaterialTheme.colorScheme.primary, style=MaterialTheme.typography.labelLarge)
                    Text(job.text("role"), style=MaterialTheme.typography.headlineMedium, maxLines = 3)
                }
                if (display >= 0) V1MatchBadge(display)
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
                        if (current >= 0) item {
                            EditorialSection(tr("你的简历与这个岗位", "Votre CV pour ce poste", "Your CV for this role")) {
                                OnwardCvOutcome(job,detail=true)
                            }
                        }
                        item { TextButton({ runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(job.text("url")))) } }) { Icon(Icons.Rounded.OpenInNew, null, Modifier.size(17.dp)); Spacer(Modifier.width(7.dp)); Text(tr("打开原始职位页", "Ouvrir l’annonce officielle", "Open original posting")) } }
                        if (deep.text("roleSummary").isNotBlank()) item { EditorialSection(tr("这个岗位做什么", "Ce que fait ce poste", "What this role does")) { Text(deep.text("roleSummary"), style=MaterialTheme.typography.bodyMedium); deep.strings("responsibilities").take(6).forEach { Text("• $it", style=MaterialTheme.typography.bodyMedium) } } }
                        val strengths = deep.objects("strengths")
                        if (strengths.isNotEmpty()) item { EditorialSection(tr("你的强项", "Vos points forts", "Your strengths")) { strengths.take(6).forEach { item -> Text("+ ${item.text("title")}", style=MaterialTheme.typography.titleSmall); Hint(item.text("evidence")) } } }
                        val presentation = deep.objects("presentationGaps")
                        if (presentation.isNotEmpty()) item { EditorialSection(tr("可以通过简历表达改善", "À améliorer dans la présentation du CV", "Can improve through CV presentation")) { presentation.take(6).forEach { item -> Text(item.text("title"), style=MaterialTheme.typography.titleSmall); Text(item.text("why"), style=MaterialTheme.typography.bodyMedium) } } }
                        val gaps = deep.objects("capabilityGaps")
                        if (gaps.isNotEmpty()) item { EditorialSection(tr("值得补强的地方", "Vos axes de progrès", "Where to grow")) { gaps.take(7).forEach { item -> Text("− ${item.text("title")}", style=MaterialTheme.typography.titleSmall); Text(item.text("why"), style=MaterialTheme.typography.bodyMedium); item.text("nextAction").takeIf(String::isNotBlank)?.let { Hint(it) } } } }
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
