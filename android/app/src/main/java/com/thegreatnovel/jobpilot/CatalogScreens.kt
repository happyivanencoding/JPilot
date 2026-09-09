package com.thegreatnovel.jobpilot

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject

@Composable fun OverviewScreen(state: PilotState,vm: JobPilotViewModel,onExplore: () -> Unit,onPrepare: () -> Unit,onProfile: () -> Unit,onFilter: (String) -> Unit) {
    val jobs = state.snapshot.objects("jobs")
    val d = state.snapshot.child("dashboard")
    val actionSets = d.child("actionSets")
    val actionable = actionSets.strings("decide").size
    val high = actionSets.strings("high").size
    val interviews = actionSets.strings("interview").size
    LazyColumn(Modifier.fillMaxSize(),contentPadding = PaddingValues(18.dp),verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { SectionTitle(tr("今天，推进哪一步？","Votre prochain pas.","Your next step."),state.snapshot.child("profile").text("name")) }
        item {
            Column(Modifier.fillMaxWidth().padding(vertical = 6.dp),verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(if(jobs.isEmpty() && state.snapshot.text("cv").isBlank()) tr("从你的简历开始。","Commençons par votre CV.","Start with your CV.") else if(jobs.isEmpty()) tr("选好你的第一批机会。","Faites votre première sélection.","Choose your first opportunities.") else if(actionable>0) tr("$actionable 个岗位已经评估，待安排投递","$actionable postes évalués restent à candidater","$actionable evaluated roles are ready to apply") else tr("把下一步安排好。","Gardez une longueur d’avance.","Plan your next move."),fontSize = 25.sp,lineHeight = 32.sp,fontWeight = FontWeight.SemiBold)
                Hint(tr("把精力放在值得投递的岗位与下一步行动上。","Les postes qui méritent votre attention. Les actions qui suivent.","Roles worth your attention. Clear next steps."))
                PrimaryButton(if(actionable>0) tr("查看已评估待投递岗位","Voir les postes évalués à candidater","Review evaluated roles to apply") else if(state.snapshot.text("cv").isBlank()) tr("导入我的简历","Importer mon CV","Import my CV") else tr("寻找适合我的岗位","Trouver des opportunités","Find opportunities")) { if(actionable>0) onFilter("decide") else if(state.snapshot.text("cv").isBlank()) onProfile() else onExplore() }
            }
        }
        if(jobs.isNotEmpty()) item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ActionMetric(high.toString(),tr("匹配 ≥85%","Match ≥85%","Match ≥85%"),Modifier.weight(1f).testTag("metric-high")) { onFilter("high") }
                ActionMetric(actionSets.strings("due").size.toString(),tr("待跟进","À relancer","Follow-ups"),Modifier.weight(1f).testTag("metric-due")) { onFilter("due") }
                ActionMetric(interviews.toString(),tr("面试","Entretiens","Interviews"),Modifier.weight(1f).testTag("metric-interview")) { onFilter("interview") }
            }
        }
        if(d.objects("due").isNotEmpty()) {
            item { Text(tr("优先行动","À faire en priorité","Priorities"),fontSize = 18.sp,fontWeight = FontWeight.SemiBold) }
            items(d.objects("due").take(3),key = { it.text("id") }) { due -> Column(Modifier.fillMaxWidth().clickable { vm.selectJob(due.text("id"),3) }.padding(vertical = 4.dp),verticalArrangement = Arrangement.spacedBy(6.dp)) { Text(due.text("company"),fontWeight = FontWeight.SemiBold); Text(due.text("nextAction").ifBlank { tr("联系招聘方","Recontacter le recruteur","Follow up with recruiter") },fontSize = 14.sp); Hint(due.text("dueDate")); HorizontalDivider(Modifier.padding(top = 8.dp)) } }
        }
        if(jobs.isNotEmpty()) item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(tr("我的求职进展","Votre recherche","Your job search"),fontSize = 18.sp,fontWeight = FontWeight.SemiBold)
                val stages = d.child("byStage")
                val rows = listOf("" to (tr("所有岗位","Tous les postes","All roles") to jobs.size),"preparing" to (tr("准备投递","À préparer","Prepare to apply") to stages.optInt("preparing")),"applied" to (tr("已投递 / 等待回复","Envoyées / en attente","Applied / awaiting reply") to stages.optInt("applied")),"responded" to (tr("收到回复","Réponses reçues","Replies received") to stages.optInt("responded")),"interview" to (tr("面试","Entretiens","Interviews") to stages.optInt("interview")),"offer" to (tr("Offer / 入职","Offre / embauche","Offer / hired") to (stages.optInt("offer")+stages.optInt("hired"))),"closed" to (tr("已结束","Terminées","Closed") to (stages.optInt("rejected")+stages.optInt("archived"))))
                rows.forEach { (key,data) -> Row(Modifier.fillMaxWidth().clickable { onFilter(key) }.padding(vertical = 13.dp),verticalAlignment = Alignment.CenterVertically) { Text(data.first,Modifier.weight(1f),fontSize = 15.sp); Text(data.second.toString(),fontWeight = FontWeight.SemiBold); Icon(Icons.Rounded.ChevronRight,null,Modifier.padding(start = 8.dp).size(18.dp)) } }
            }
        }
        if(jobs.isEmpty() && state.snapshot.text("cv").isNotBlank()) item {
            Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
                Text(tr("从你的目标开始","À partir de votre objectif","Start with your goal"),fontWeight=FontWeight.SemiBold,fontSize=18.sp)
                Hint(state.snapshot.child("config").child("target_roles").strings("contract_types").map { product(it) }.joinToString(" · "))
                val available=state.snapshot.child("config").child("availability").text("earliest")
                if(available.isNotBlank())Hint(tr("预计可入职：","Disponibilité prévue : ","Expected availability: ")+available)
                Text(tr("先比较少量相关岗位，再根据真实要求准备材料。","Comparez quelques offres pertinentes, puis préparez vos preuves pour leurs exigences réelles.","Compare a few relevant roles, then prepare evidence for their actual requirements."),fontSize=14.sp,lineHeight=22.sp)
                if(state.snapshot.child("analysis").text("markdown").isNotBlank())OutlinedButton({vm.showAnalysis()},Modifier.fillMaxWidth()){Text(tr("查看我的核心优势与行动","Voir mes atouts et mes actions","Review my signals and next actions"))}
            }
        }
        if(d.objects("recentReplies").isNotEmpty()) {
            item { Text(tr("最近回复","Dernières réponses","Recent replies"),fontSize = 18.sp,fontWeight = FontWeight.SemiBold) }
            items(d.objects("recentReplies").take(2)) { reply -> Column(Modifier.fillMaxWidth().clickable { vm.selectJob(reply.text("jobId"),3) }.padding(vertical = 8.dp),verticalArrangement = Arrangement.spacedBy(5.dp)) { Text(reply.text("company"),fontWeight = FontWeight.SemiBold); Text(reply.text("text"),fontSize = 14.sp,maxLines = 3); Hint(reply.text("at").take(10)) } }
        }
        item { OutlinedButton(onPrepare,Modifier.fillMaxWidth()) { Icon(Icons.Rounded.School,null,Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)); Text(tr("准备下一场面试","Préparer mon prochain entretien","Prepare for my next interview")) } }
    }
}
@Composable private fun ActionMetric(value: String,label: String,modifier: Modifier,onClick: () -> Unit) {
    Surface(onClick = onClick,modifier = modifier,shape = RoundedCornerShape(10.dp),color = MaterialTheme.colorScheme.surface,border = BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(horizontal = 12.dp,vertical = 14.dp),verticalArrangement = Arrangement.spacedBy(6.dp)) { Text(value,fontSize = 27.sp,fontWeight = FontWeight.SemiBold,color = MaterialTheme.colorScheme.primary); Text(label,fontSize = 11.sp,maxLines = 2); Icon(Icons.Rounded.ArrowForward,null,Modifier.size(16.dp),tint = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable fun ExploreScreen(state: PilotState,vm: JobPilotViewModel) {
    val context = LocalContext.current
    val discoveryOfferLimit = 5
    val defaultQuery = tr("根据当前简历、合同类型和目标，优先寻找巴黎和法国岗位，并扩展到欧洲其他国家或欧洲远程机会。优先官方职位页。","Selon mon CV, les contrats ciblés et mes objectifs, chercher d’abord à Paris et en France, puis élargir aux autres pays européens et aux opportunités européennes à distance. Privilégier les pages employeur officielles.","Based on my CV, target contracts and goals, search Paris and France first, then broaden to other European countries and Europe-based remote opportunities. Prefer official employer pages.")
    var query by rememberSaveable(state.profileId) { mutableStateOf(defaultQuery) }
    var previousDefault by rememberSaveable(state.profileId) { mutableStateOf(defaultQuery) }
    LaunchedEffect(defaultQuery) { if(query==previousDefault)query=defaultQuery;previousDefault=defaultQuery }
    var url by rememberSaveable(state.profileId) { mutableStateOf("") }
    val searching = state.snapshot.objects("tasks").any { it.text("kind") == "search" && it.text("status") in setOf("queued","running","reconciling") }
    val discovery = state.snapshot.child("discovery")
    val visibleOffers = discovery.objects("offers").take(discoveryOfferLimit)
    var selectedUrls by remember(state.profileId) { mutableStateOf(emptySet<String>()) }
    LaunchedEffect(visibleOffers.map { it.text("url") }) { selectedUrls=selectedUrls.intersect(visibleOffers.map { it.text("url") }.toSet()) }
    val selectedOffers=visibleOffers.filter { it.text("url") in selectedUrls }
    val allSelected=visibleOffers.isNotEmpty() && selectedUrls.size==visibleOffers.size
    val batchEvaluationTitle=tr("批量岗位评估","Évaluations groupées","Batch evaluations")
    LazyColumn(Modifier.fillMaxSize(),contentPadding = PaddingValues(18.dp),verticalArrangement = Arrangement.spacedBy(16.dp),overscrollEffect = null) {
        item { SectionTitle(tr("值得看的机会","Les bonnes opportunités","Worth a closer look"),tr("已评估的岗位在「投递」中，不会重复出现在这里。","Les postes évalués se retrouvent dans Candidatures.","Evaluated roles move to Applications.")) }
        item { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(query,{ query = it },Modifier.fillMaxWidth(),label = { Text(tr("搜索目标","Ma recherche","My search")) },minLines = 2,maxLines = 5,shape = RoundedCornerShape(10.dp))
            val contracts = state.snapshot.child("config").child("target_roles").strings("contract_types")
            Hint(tr("合同类型：","Contrats : ","Contracts: ") + contracts.joinToString(" · ") { ProductStrings.text(context,state.language,it) }.ifBlank { tr("不限","Tous","All") })
            PrimaryButton(if(searching) tr("搜索中","Recherche en cours","Searching") else tr("寻找适合我的岗位","Rechercher des offres","Find opportunities"),!state.working && !searching && query.isNotBlank()) { vm.startTask(json("kind" to "search","query" to query)) }
        } }
        item { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(url,{ url = it },Modifier.fillMaxWidth(),label = { Text(tr("或粘贴职位链接","Ou coller le lien d’un poste","Or paste a job URL")) },singleLine = true,shape = RoundedCornerShape(10.dp))
            val pastedJobId=state.snapshot.objects("jobs").find { it.text("url")==url.trim() }?.text("id")
            AiProgressButton(state,"evaluate",pastedJobId,tr("查看／评估该岗位","Consulter / évaluer cette offre","View / evaluate this role"),!state.working && url.startsWith("http"),outlined=true) { vm.startTask(json("kind" to "evaluate","url" to url.trim())) }
            HorizontalDivider()
        } }
        item { Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment=Alignment.CenterVertically) { Text(tr("待处理岗位","À examiner","To review"),Modifier.weight(1f),fontWeight = FontWeight.SemiBold); Hint(discovery.text("searchedAt").take(10)) }
            if(visibleOffers.isNotEmpty()) TextButton({ selectedUrls=if(allSelected) emptySet() else visibleOffers.map { it.text("url") }.toSet() },Modifier.testTag("select-all-pending")) { Icon(if(allSelected) Icons.Rounded.Deselect else Icons.Rounded.SelectAll,null,Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text(if(allSelected)tr("取消全选","Tout désélectionner","Clear selection")else tr("一键选中所有待处理岗位","Tout sélectionner","Select all pending roles")) }
            if(selectedOffers.isNotEmpty()) Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                OutlinedButton({ val batch=selectedOffers.map { JSONObject(it.toString()) };selectedUrls=emptySet();vm.saveOffers(batch) },Modifier.weight(1f).testTag("bulk-save-offers"),enabled=!state.working) { Text(tr("收藏 ${selectedOffers.size}","Enregistrer ${selectedOffers.size}","Save ${selectedOffers.size}")) }
                Button({ val batch=selectedOffers.filter { it.text("lifecycle")!="evaluating" }.map { json("kind" to "evaluate","url" to it.text("url"),"offer" to JSONObject(it.toString())) };selectedUrls=emptySet();vm.startTasks(batch,batchEvaluationTitle) },Modifier.weight(1f).testTag("bulk-evaluate-offers"),enabled=!state.working && selectedOffers.any { it.text("lifecycle")!="evaluating" }) { Text(tr("评估 ${selectedOffers.size}","Évaluer ${selectedOffers.size}","Evaluate ${selectedOffers.size}")) }
            }
            if(discovery.optBoolean("partial"))Hint(discovery.text("warning"))
        } }
        if(discovery.child("searchMetrics").has("returnedCount")) item { SearchMetricsPanel(discovery.child("searchMetrics")) }
        if(visibleOffers.isEmpty()) item { EmptyCard(tr("这里没有待处理的岗位","Aucune offre en attente ici","No pending offers here"),tr("可以发起搜索，或到投递页查看已有评估。","Lancez une recherche ou consultez vos évaluations dans Candidatures.","Search for opportunities or view evaluations in Applications.")) }
        items(visibleOffers,key = { it.text("url") }) { offer ->
            val saved = offer.text("jobId").isNotBlank() || state.snapshot.objects("jobs").any { it.text("url") == offer.text("url") }
            val evaluating = offer.text("lifecycle") == "evaluating"
            Column(Modifier.fillMaxWidth(),verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Row(verticalAlignment=Alignment.Top,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    Checkbox(offer.text("url") in selectedUrls,{ checked -> selectedUrls=if(checked) selectedUrls+offer.text("url") else selectedUrls-offer.text("url") },Modifier.testTag("select-offer-${offer.text("url").hashCode()}"))
                    Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                        Text(offer.text("company"),fontSize = 13.sp,color = MaterialTheme.colorScheme.primary,fontWeight = FontWeight.SemiBold)
                        Text(offer.text("title"),fontSize = 20.sp,lineHeight = 26.sp,fontWeight = FontWeight.SemiBold)
                    }
                }
                Hint(listOf(offer.text("location"),product(offer.text("contractType"))).filter { it.isNotBlank() && it != "unknown" }.joinToString(" · "))
                val sourceBits = buildList {
                    if(offer.text("sourceLabel").isNotBlank()) add(product(offer.text("sourceLabel"))) else if(offer.text("source").isNotBlank()) add(offer.text("source"))
                    if(offer.text("relevanceTier") == "adjacent") add(tr("相邻机会","opportunité adjacente","adjacent opportunity"))
                    if(offer.text("relevanceTier") == "closest") add(tr("最接近的备选","meilleure option de repli","closest fallback"))
                    if(offer.text("seniorityFit") == "above-target") add(tr("资历可能高于当前目标","séniorité possiblement supérieure","seniority may be above target"))
                    if(offer.text("roleFit") == "outside-primary") add(tr("岗位方向偏离主目标","hors cible principale","outside primary target"))
                    when(offer.text("locationFit")) {
                        "same-country" -> add(tr("法国其他地区","autre région en France","elsewhere in France"))
                        "europe-other" -> add(tr("欧洲其他国家","autre pays européen","another European country"))
                        "outside-europe" -> add(tr("欧洲以外","hors Europe","outside Europe"))
                        "outside-target" -> add(tr("地点偏离主目标","hors zone cible","outside target location"))
                    }
                    if(offer.text("contractType") == "unknown") add(tr("合同待确认","contrat à confirmer","contract to confirm"))
                    if(offer.has("ageDays") && !offer.isNull("ageDays")) add(if(offer.optInt("ageDays") == 0) tr("今天发布","publiée aujourd’hui","posted today") else tr("${offer.optInt("ageDays")} 天前","il y a ${offer.optInt("ageDays")} j","${offer.optInt("ageDays")}d ago"))
                    if(offer.has("searchRelevance") && !offer.isNull("searchRelevance")) add(tr("检索相关度 ${offer.optInt("searchRelevance")}/100","pertinence recherche ${offer.optInt("searchRelevance")}/100","search relevance ${offer.optInt("searchRelevance")}/100"))
                }
                if(sourceBits.isNotEmpty()) Hint(sourceBits.joinToString(" · "))
                Text(offer.text("why"),fontSize = 14.sp,lineHeight = 21.sp)
                Hint(if(evaluating) tr("分析中 · 不会重复启动","Évaluation en cours · une seule tâche","Evaluation in progress · one task only") else tr("待评估 · 岗位开放情况需核实","À évaluer · disponibilité à confirmer","Unassessed · availability unconfirmed"))
                TextButton({ context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(offer.text("url")))) },contentPadding = PaddingValues(0.dp)) { Text(tr("查看职位来源","Voir l’annonce source","View source posting")); Icon(Icons.Rounded.OpenInNew,null,Modifier.padding(start = 6.dp).size(15.dp)) }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton({ vm.saveOffer(offer) },Modifier.weight(1f),enabled = !saved && !state.working) { Text(if(saved) tr("已收藏","Enregistrée","Saved") else tr("保存","Enregistrer","Save")) }
                    val evaluateJobId=offer.text("jobId").takeIf(String::isNotBlank) ?: state.snapshot.objects("jobs").find { it.text("url")==offer.text("url") }?.text("id")
                    AiProgressButton(state,"evaluate",evaluateJobId,tr("岗位评估","Évaluer","Evaluate"),!evaluating && !state.working,modifier=Modifier.weight(1f)) { vm.startTask(json("kind" to "evaluate","url" to offer.text("url"),"offer" to JSONObject(offer.toString()))) }
                }
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
            }
        }
    }
}

@Composable fun SearchMetricsPanel(metrics: JSONObject) {
    val returned = metrics.optInt("returnedCount",0)
    val seconds = metrics.optLong("wallMs",0L).coerceAtLeast(0L) / 1000.0
    val providerBits = metrics.objects("providers").map { provider ->
        val status = when(provider.text("status")) {
            "ok" -> tr("可用","actif","active")
            "unconfigured" -> tr("未配置","non configuré","not configured")
            "error" -> tr("错误","erreur","error")
            else -> tr("关闭","désactivé","disabled")
        }
        "${provider.text("label")}: $status"
    }
    Column(Modifier.fillMaxWidth(),verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(tr("本次搜索表现","Performance de cette recherche","Search performance"),fontSize = 14.sp,fontWeight = FontWeight.SemiBold)
        val headline = buildList {
            add(tr("$returned 个岗位","$returned offres","$returned roles"))
            if(metrics.optInt("strongCount",0) > 0) add(tr("${metrics.optInt("strongCount")} 个强相关","${metrics.optInt("strongCount")} très proches","${metrics.optInt("strongCount")} strong"))
            if(metrics.optInt("adjacentCount",0) > 0) add(tr("${metrics.optInt("adjacentCount")} 个相邻","${metrics.optInt("adjacentCount")} adjacentes","${metrics.optInt("adjacentCount")} adjacent"))
            if(metrics.optInt("closestCount",0) > 0) add(tr("${metrics.optInt("closestCount")} 个最接近备选","${metrics.optInt("closestCount")} options de repli","${metrics.optInt("closestCount")} closest fallbacks"))
            add(String.format(java.util.Locale.US,"%.1f s",seconds))
            if(metrics.has("fresh7dRate") && !metrics.isNull("fresh7dRate")) add(tr("${metrics.optInt("fresh7dRate")}% ≤7天","${metrics.optInt("fresh7dRate")}% ≤7 j","${metrics.optInt("fresh7dRate")}% ≤7d"))
            if(metrics.has("datedRate")) add(tr("${metrics.optInt("datedRate")}% 有日期","${metrics.optInt("datedRate")}% datées","${metrics.optInt("datedRate")}% dated"))
        }
        Text(headline.joinToString("  ·  "),fontSize = 13.sp,color = MaterialTheme.colorScheme.onSurfaceVariant)
        val mode = if(metrics.optBoolean("aiFallbackUsed")) tr("结构化源不足，已使用精简 AI 补充。","Sources structurées insuffisantes : complément IA ciblé utilisé.","Structured sources were insufficient; targeted AI fallback was used.") else tr("本次未调用搜索 Agent。","Aucun agent de recherche utilisé pour cette requête.","No search agent was used for this query.")
        Hint(mode)
        if(providerBits.isNotEmpty()) Hint(providerBits.joinToString("  ·  "))
        HorizontalDivider()
    }
}

@Composable fun ApplicationsScreen(state: PilotState,vm: JobPilotViewModel,filter: String,onFilter: (String) -> Unit,filterRequest: Int = 0) {
    var query by rememberSaveable(state.profileId) { mutableStateOf("") }
    LaunchedEffect(filterRequest) { query="" }
    var compareMode by rememberSaveable { mutableStateOf(false) }
    var chosen by remember(state.profileId) { mutableStateOf(setOf<String>()) }
    var comparison by remember { mutableStateOf(false) }
    var refine by rememberSaveable(state.profileId) { mutableStateOf(false) }
    var sortMode by rememberSaveable(state.profileId) { mutableStateOf("score-desc") }
    var evaluationFilter by rememberSaveable(state.profileId) { mutableStateOf("all") }
    val jobs = state.snapshot.objects("jobs")
    val activeEvaluations=state.snapshot.objects("tasks").filter { it.text("kind")=="evaluate" && it.text("status") in setOf("queued","running","reconciling") }
    val unrated=jobs.filter { job -> job.text("evaluationState")!="evaluated" && job.text("url").startsWith("http") && activeEvaluations.none { it.text("jobId")==job.text("id") || it.child("input").text("url")==job.text("url") } }
    val evaluateUnratedTitle=tr("批量评估 ${unrated.size} 个未评估岗位","Évaluation de ${unrated.size} offres","Evaluate ${unrated.size} unrated roles")
    val sets = state.snapshot.child("dashboard").child("actionSets")
    val specialIds=if(filter in setOf("high","due","decide"))sets.strings(filter).toSet()else emptySet()
    fun categoryMatches(job:JSONObject)=when(filter){
        ""->true
        "offer"->job.text("stage") in setOf("offer","hired")
        "closed"->job.text("stage") in setOf("rejected","archived")
        "high","due","decide"->job.text("id") in specialIds
        else->job.text("stage")==filter
    }
    fun updatedKey(job:JSONObject)=listOf(job.text("updatedAt"),job.text("lastChecked"),job.text("discoveredAt"),job.text("postedAt")).firstOrNull { it.isNotBlank() } ?: ""
    val filtered = jobs.filter { job ->
        categoryMatches(job) && (job.text("company") + " " + job.text("role")).contains(query,true) && when(evaluationFilter){"evaluated"->job.text("evaluationState")=="evaluated";"unrated"->job.text("evaluationState")!="evaluated";else->true}
    }.sortedWith(when(sortMode){
        "score-asc"->compareBy<JSONObject> { it.optDouble("score",Double.NaN).let { score->if(score.isFinite())score else Double.POSITIVE_INFINITY } }.thenByDescending(::updatedKey)
        "recent"->compareByDescending(::updatedKey)
        else->compareByDescending<JSONObject> { it.optDouble("score",Double.NaN).let { score->if(score.isFinite())score else Double.NEGATIVE_INFINITY } }.thenByDescending(::updatedKey)
    })
    LazyColumn(Modifier.fillMaxSize().testTag("applications-$filter-${filtered.size}"),contentPadding = PaddingValues(18.dp),verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Column(verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) { Column(Modifier.weight(1f)) { SectionTitle(tr("我的投递","Mes candidatures","My applications")); Hint("${filtered.size} " + tr("个岗位","postes","roles")) }; TextButton({ if(compareMode && chosen.size>=2) comparison=true else compareMode=!compareMode }) { Text(if(compareMode) "${chosen.size}/4" else tr("对比","Comparer","Compare")) } }
            if(unrated.isNotEmpty()) OutlinedButton({ vm.startTasks(unrated.map { json("kind" to "evaluate","url" to it.text("url"),"retry" to true) },evaluateUnratedTitle) },Modifier.fillMaxWidth().testTag("evaluate-all-unrated"),enabled=!state.working) { Icon(Icons.Rounded.AutoAwesome,null,Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text(tr("一键评估所有未评估岗位（${unrated.size}）","Évaluer toutes les offres non évaluées (${unrated.size})","Evaluate all unrated roles (${unrated.size})")) }
        } }
        item { OutlinedTextField(query,{ query=it },Modifier.fillMaxWidth(),placeholder = { Text(tr("公司或职位","Entreprise ou poste","Company or role")) },leadingIcon = { Icon(Icons.Rounded.Search,null) },singleLine = true,shape = RoundedCornerShape(10.dp)) }
        item { Row(Modifier.horizontalScroll(rememberScrollState(),overscrollEffect=null),horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val options=listOf("" to tr("全部","Tout","All"),"preparing" to tr("准备投递","À préparer","Prepare"),"applied" to tr("已投递","Envoyées","Applied"),"responded" to tr("收到回复","Réponses","Replies"),"interview" to tr("面试","Entretiens","Interviews"),"offer" to tr("Offer / 入职","Offre / embauche","Offer / hired"),"closed" to tr("已结束","Terminées","Closed"))
            options.forEach { (key,label) -> FilterChip(filter==key,{ onFilter(key) },modifier=Modifier.testTag("filter-$key"),label = { Text(label) }) }
        } }
        item { Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            OutlinedButton({refine=!refine},Modifier.weight(1f).testTag("application-refine")) { Icon(Icons.Rounded.Tune,null,Modifier.size(18.dp));Spacer(Modifier.width(7.dp));Text(tr("筛选与排序","Filtrer et trier","Filter & sort")) }
            if(filter in setOf("high","due","decide")) Pill(when(filter){"high"->tr("高匹配","Match élevé","High match");"due"->tr("待跟进","À relancer","Follow up");else->tr("已评估待投递","Évaluées à candidater","Evaluated to apply")})
        } }
        if(refine)item { GlassCard {
            Text(tr("评估状态","État de l’évaluation","Evaluation status"),fontWeight=FontWeight.SemiBold)
            Row(Modifier.horizontalScroll(rememberScrollState(),overscrollEffect=null),horizontalArrangement=Arrangement.spacedBy(8.dp)) { listOf("all" to tr("全部","Toutes","All"),"evaluated" to tr("仅已评估","Évaluées","Evaluated"),"unrated" to tr("仅未评估","Non évaluées","Unrated")).forEach { (key,label)->FilterChip(evaluationFilter==key,{evaluationFilter=key},label={Text(label)}) } }
            Text(tr("排序","Tri","Sort"),fontWeight=FontWeight.SemiBold)
            Row(Modifier.horizontalScroll(rememberScrollState(),overscrollEffect=null),horizontalArrangement=Arrangement.spacedBy(8.dp)) { listOf("score-desc" to tr("评分高→低","Score décroissant","Score high→low"),"score-asc" to tr("评分低→高","Score croissant","Score low→high"),"recent" to tr("最近更新","Plus récentes","Recently updated")).forEach { (key,label)->FilterChip(sortMode==key,{sortMode=key},label={Text(label)}) } }
        } }
        if(filter in setOf("high","due","decide")) item { TextButton({ onFilter("") }) { Text(tr("清除快捷筛选","Effacer ce filtre","Clear quick filter")) } }
        if(compareMode) item { Row(verticalAlignment = Alignment.CenterVertically) { Hint(tr("选择 2–4 个岗位","Sélectionnez 2 à 4 postes","Select 2–4 roles")); Spacer(Modifier.weight(1f)); TextButton({ compareMode=false;chosen=emptySet() }) { Text(tr("取消","Annuler","Cancel")) } } }
        if(filtered.isEmpty()) item { EmptyCard(tr("当前筛选没有岗位","Aucun poste dans ce filtre","No roles in this filter"),tr("更换筛选，或到机会页寻找岗位。","Changez le filtre ou recherchez des opportunités.","Change the filter or explore opportunities.")) }
        items(filtered,key = { it.text("id") }) { job ->
            val select = { if(compareMode) chosen = if(job.text("id") in chosen) chosen-job.text("id") else if(chosen.size<4) chosen+job.text("id") else chosen else vm.selectJob(job.text("id")) }
            Column(Modifier.fillMaxWidth().testTag("job-${job.text("id")}").clickable { select() }.padding(vertical = 8.dp),verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically,horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if(compareMode) Checkbox(job.text("id") in chosen,{ select() })
                    Column(Modifier.weight(1f),verticalArrangement = Arrangement.spacedBy(5.dp)) { Text(job.text("company"),fontSize = 13.sp,color = MaterialTheme.colorScheme.primary,fontWeight = FontWeight.SemiBold); Text(job.text("role"),fontSize = 19.sp,lineHeight = 25.sp,fontWeight = FontWeight.SemiBold) }
                    ScoreBadge(job.optDouble("score",Double.NaN))
                }
                Hint(listOf(job.text("location"),product(job.text("contract"))).filter { it.isNotBlank() }.joinToString(" · "))
                Row { Text(product(job.text("status")),Modifier.weight(1f),fontSize = 13.sp,fontWeight = FontWeight.Medium); Icon(Icons.Rounded.ChevronRight,null,Modifier.size(18.dp)) }
                if(job.child("followup").text("nextAction").isNotBlank()) Hint(job.child("followup").text("nextAction"))
                HorizontalDivider(Modifier.padding(top = 8.dp))
            }
        }
        if(compareMode && chosen.size>=2) item { PrimaryButton(tr("比较选中的岗位","Comparer la sélection","Compare selected roles")) { comparison=true } }
    }
    if(comparison) ComparisonSheet(jobs.filter { it.text("id") in chosen },vm) { comparison=false }
}
