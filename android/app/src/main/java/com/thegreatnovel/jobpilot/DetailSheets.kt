package com.thegreatnovel.jobpilot

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
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
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.json.JSONArray

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun JobDetailSheet(job: JSONObject,state: PilotState,vm: JobPilotViewModel) {
    val context = LocalContext.current
    var tab by rememberSaveable(job.text("id"),state.selectedJobTab) { mutableIntStateOf(state.selectedJobTab) }
    var status by rememberSaveable(job.text("id")) { mutableStateOf(job.text("status")) }
    var statusMenu by remember { mutableStateOf(false) }
    var nextAction by rememberSaveable(job.text("id")) { mutableStateOf(job.child("followup").text("nextAction")) }
    var nextActionEdited by rememberSaveable(job.text("id")) { mutableStateOf(false) }
    LaunchedEffect(job.child("followup").text("nextAction")) {if(!nextActionEdited)nextAction=job.child("followup").text("nextAction")}
    var date by rememberSaveable(job.text("id")) { mutableStateOf(job.child("followup").text("dueDate")) }
    var note by rememberSaveable(job.text("id")) { mutableStateOf(job.child("followup").text("note")) }
    var reply by rememberSaveable(job.text("id")) { mutableStateOf("") }
    var replyKind by rememberSaveable(job.text("id")) { mutableStateOf("Recruteur") }
    var practiceQuestion by rememberSaveable(job.text("id")) { mutableStateOf("") }
    var practiceAnswer by rememberSaveable(job.text("id")) { mutableStateOf("") }
    val contentState=rememberLazyListState()
    val scope=rememberCoroutineScope()
    val evaluating=state.snapshot.objects("tasks").any { it.text("kind")=="evaluate" && it.text("jobId")==job.text("id") && it.text("status") in setOf("queued","running","reconciling") }
    ModalBottomSheet(onDismissRequest = { vm.selectJob(null) },sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),modifier = Modifier.imePadding()) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.92f).testTag("job-detail-${job.text("id")}")) {
            Row(Modifier.padding(horizontal = 22.dp,vertical = 8.dp),verticalAlignment = Alignment.CenterVertically,horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f),verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(job.text("company"),color = MaterialTheme.colorScheme.primary,fontWeight = FontWeight.SemiBold); Text(job.text("role"),fontSize = 21.sp,fontWeight = FontWeight.SemiBold,maxLines = 3) }
                ScoreBadge(job.optDouble("score",Double.NaN))
            }
            val labels = listOf(tr("匹配","Match","Fit"),"CV",tr("面试","Entretien","Interview"),tr("跟踪","Suivi","Tracking"))
            TabRow(selectedTabIndex = tab,containerColor = androidx.compose.ui.graphics.Color.Transparent) { labels.forEachIndexed { i,label -> Tab(tab == i,{ tab = i },modifier=Modifier.testTag("job-tab-$i"),text = { Text(label,fontSize = 13.sp) }) } }
            LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("job-content"),state=contentState,contentPadding = PaddingValues(22.dp),verticalArrangement = Arrangement.spacedBy(16.dp)) {
                item { LocalizationNotice(job.child("localization"),vm::retryLocalization) }
                when(tab) {
                    0 -> {
                        item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Pill(product(job.text("status"))); if(job.text("lastChecked").isNotBlank()) Pill(job.text("lastChecked").take(10)) } }
                        if(job.text("recommendation").isNotBlank()) item { Text(job.text("recommendation"),fontWeight=FontWeight.SemiBold,color=MaterialTheme.colorScheme.primary,fontSize=16.sp) }
                        item { Hint(listOf(job.text("location"),product(job.text("workMode")),product(job.text("contract"))).filter { it.isNotBlank() }.joinToString(" · ")); TextButton({ context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(job.text("url")))) }) { Icon(Icons.Rounded.OpenInNew,null,Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text(tr("打开原始职位页","Ouvrir l’annonce officielle","Open original job page")) } }
                        if(job.text("summary").isNotBlank()) item { GlassCard { Text(tr("判断依据","Lecture du poste","Assessment"),fontWeight = FontWeight.SemiBold); Markdown(job.text("summary")); if(job.text("angle").isNotBlank()) { HorizontalDivider(); Text(job.text("angle"),fontSize = 14.sp) } } }
                        if(job.strings("strengths").isNotEmpty()) item { GlassCard { Text(tr("优势与证据","Vos atouts documentés","Documented strengths"),fontSize = 18.sp,fontWeight = FontWeight.SemiBold); job.strings("strengths").forEach { Bullet(it) } } }
                        if(job.objects("gaps").isNotEmpty()) item { Text(tr("需要准备的差距","Les écarts à préparer","Gaps to prepare"),fontSize = 18.sp,fontWeight = FontWeight.SemiBold) }
                        items(job.objects("gaps")) { gap -> GlassCard { Text(gap.text("title"),fontWeight = FontWeight.SemiBold); if(gap.text("severity").isNotBlank()) Pill(product(gap.text("severity")),warm = true); Text(gap.text("why"),fontSize = 14.sp); Hint(gap.text("positioning")) } }
                        items(job.objects("match")) { match -> GlassCard { Text(match.text("requirement"),fontWeight = FontWeight.SemiBold); Pill(product(match.text("fit"))); Text(match.text("evidence"),fontSize = 14.sp); if(match.text("action").isNotBlank()) Hint(match.text("action")) } }
                        item { if(job.text("evaluationState") != "evaluated") Button({vm.startTask(json("kind" to "evaluate","url" to job.text("url")))},Modifier.fillMaxWidth().testTag("evaluate-job"),enabled=!state.working&&!evaluating){Text(if(evaluating)tr("分析中","Évaluation en cours","Evaluating")else tr("运行正式评估","Évaluer ce poste","Evaluate this role"))}; Hint(tr("已保存的评估不会重复生成。评分不是录用概率。","Les évaluations enregistrées ne sont pas régénérées. Le score n’est pas une probabilité d’embauche.","Saved evaluations are not regenerated. Scores are not hiring probabilities.")) }
                        if(job.text("reportNum").isNotBlank()) item { TextButton({ vm.openReport(job) },Modifier.testTag("view-report")) { Text(tr("查看完整评估报告","Lire le rapport complet","Read full report")) } }
                    }
                    1 -> {
                        val cv = job.child("cv")
                        item { GlassCard {
                            Text(tr("为这个岗位调整表达","La bonne version, pour ce poste.","The right version for this role."),fontSize = 22.sp,fontWeight = FontWeight.SemiBold)
                            Hint(tr("使用当前档案的已核实经历，不添加不存在的技能或成果。","À partir des preuves du profil actif, sans inventer de compétences ni de résultats.","Uses the active profile’s evidence, without inventing skills or achievements."))
                            if(cv.has("atsScore")) Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) { Pill("ATS ${cv.text("atsScore")}/100"); if(cv.strings("keywords").isNotEmpty() && !cv.isNull("keywordCoverage")) Pill(tr("关键词 ${cv.text("keywordCoverage")}%","Mots-clés ${cv.text("keywordCoverage")}%","Keywords ${cv.text("keywordCoverage")}%")) }
                            if(cv.text("file").isBlank()) PrimaryButton(tr("生成定制 PDF 简历","Générer mon CV adapté","Generate tailored PDF CV"),!state.working) { vm.startTask(json("kind" to "cv","jobId" to job.text("id"))) }
                            else PrimaryButton(tr("查看定制简历","Voir mon CV adapté","View tailored CV"),!state.working) { vm.openCvPreview(job = job) }
                            if(cv.text("inputVersionId").isNotBlank() && cv.text("inputVersionId") != state.snapshot.child("cvState").text("versionId")) TextButton({ vm.startTask(json("kind" to "cv","jobId" to job.text("id"))) },enabled = !state.working) { Text(tr("根据新版 CV 更新","Actualiser avec mon nouveau CV","Update with my new CV")) }
                            if(cv.text("file").isNotBlank()) OutlinedButton({ vm.shareCv(job) },Modifier.fillMaxWidth(),enabled = !state.working) { Icon(Icons.Rounded.IosShare,null); Spacer(Modifier.width(8.dp)); Text(tr("打开或分享 PDF","Ouvrir / partager le PDF","Open / share PDF")) }
                        } }
                        if(cv.strings("changes").isNotEmpty()) item { GlassCard { Text(tr("这份简历的调整","Ce qui a été adapté","What changed"),fontWeight = FontWeight.SemiBold); cv.strings("changes").forEach { Bullet(it) } } }
                        if(cv.strings("keywords").isNotEmpty()) item { GlassCard { Text(tr("岗位关键词","Mots-clés du poste","Role keywords"),fontWeight = FontWeight.SemiBold); Text(cv.strings("keywords").joinToString(" · "),fontSize = 14.sp) } }
                    }
                    2 -> {
                        if(job.child("mobilePlan").text("markdown").isBlank()) item { PrimaryButton(tr("制定针对性准备计划","Créer un plan de préparation","Create a preparation plan"),!state.working) { vm.startTask(json("kind" to "plan","jobId" to job.text("id"),"minutesPerDay" to 30)) } }
                        if(job.child("mobilePlan").text("markdown").isNotBlank()) item { GlassCard { Markdown(job.child("mobilePlan").text("markdown")) } }
                        items(job.objects("prepTasks")) { task -> Row(Modifier.fillMaxWidth(),verticalAlignment = Alignment.CenterVertically) { Checkbox(task.optBoolean("done"),{ vm.updateJob(job.text("id"),json("taskId" to task.text("id"),"taskDone" to it)) }); Text(task.text("label"),Modifier.weight(1f),fontSize = 14.sp) } }
                        val interview = job.child("interview")
                        if(interview.strings("process").isNotEmpty()) item { GlassCard { Text(tr("面试流程","Processus d’entretien","Interview process"),fontWeight = FontWeight.SemiBold); interview.strings("process").forEach { Bullet(it) }; if(!interview.optBoolean("processKnown")) Pill(tr("实际流程待确认","À confirmer avec le recruteur","Confirm with recruiter"),warm = true) } }
                        if(interview.text("caseStudy").isNotBlank()) item { GlassCard { Text(tr("针对性案例","Cas à préparer","Case preparation"),fontWeight = FontWeight.SemiBold); Text(interview.text("caseStudy"),fontSize = 14.sp) } }
                        items(interview.objects("questions")) { q -> GlassCard { Text(q.text("question"),fontWeight = FontWeight.SemiBold); Text(q.text("answer"),fontSize = 14.sp); Hint(q.text("proof")); TextButton({ practiceQuestion = q.text("question");scope.launch { val target=(contentState.layoutInfo.totalItemsCount-1).coerceAtLeast(0);contentState.animateScrollToItem(target) } },Modifier.testTag("practice-this-question")) { Text(tr("练习这道题","M’entraîner à cette question","Practice this question")) } } }
                        item { GlassCard {
                            Text(tr("针对性模拟","Simulation ciblée","Targeted practice"),fontSize = 18.sp,fontWeight = FontWeight.SemiBold)
                            OutlinedTextField(practiceQuestion,{ practiceQuestion = it },Modifier.fillMaxWidth(),label = { Text(tr("问题","Question","Question")) },minLines = 2,shape = RoundedCornerShape(18.dp))
                            OutlinedTextField(practiceAnswer,{ practiceAnswer = it },Modifier.fillMaxWidth(),label = { Text(tr("我的回答","Ma réponse","My answer")) },minLines = 4,maxLines = 10,shape = RoundedCornerShape(18.dp))
                            PrimaryButton(tr("获取反馈","Recevoir un retour","Get feedback"),!state.working && practiceQuestion.isNotBlank() && practiceAnswer.isNotBlank()) { vm.startTask(json("kind" to "practice","jobId" to job.text("id"),"question" to practiceQuestion,"answer" to practiceAnswer)) }
                        } }
                    }
                    else -> {
                        item { GlassCard {
                            Text(tr("投递状态","Statut de candidature","Application status"),fontWeight = FontWeight.SemiBold)
                            Box { OutlinedButton({ statusMenu = true },Modifier.fillMaxWidth()) { Text(product(status),Modifier.weight(1f)); Icon(Icons.Rounded.ExpandMore,null) }; DropdownMenu(statusMenu,{ statusMenu = false }) { state.snapshot.strings("statuses").forEach { s -> DropdownMenuItem(text = { Text(product(s)) },onClick = { status = s; statusMenu = false }) } } }
                            OutlinedTextField(nextAction,{ nextAction = it;nextActionEdited=true },Modifier.fillMaxWidth(),label = { Text(tr("下一步行动","Prochaine action","Next action")) },shape = RoundedCornerShape(18.dp))
                            DateField(date,{ date = it },tr("跟进日期","Date de relance","Follow-up date"))
                            OutlinedTextField(note,{ note = it },Modifier.fillMaxWidth(),label = { Text(tr("我的备注","Mes notes","My notes")) },minLines = 3,shape = RoundedCornerShape(18.dp))
                            PrimaryButton(tr("保存跟踪状态","Enregistrer le suivi","Save tracking"),!state.working) { vm.updateJob(job.text("id"),json("status" to status,"dueDate" to date,"note" to note).apply { if(nextActionEdited)put("nextAction",nextAction) }) }
                        } }
                        item { GlassCard {
                            Text(tr("记录对方的回复","Une réponse du recruteur ?","Heard from the employer?"),fontWeight = FontWeight.SemiBold)
                            Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("Accusé auto","Recruteur","Entretien","Refus","Offre").forEach { kind -> FilterChip(replyKind == kind,{ replyKind = kind },label = { Text(product(kind)) }) } }
                            OutlinedTextField(reply,{ reply = it },Modifier.fillMaxWidth(),label = { Text(tr("粘贴或概括收到的回复","Coller ou résumer la réponse","Paste or summarize the reply")) },minLines = 4,maxLines = 8,shape = RoundedCornerShape(18.dp))
                            Hint(tr("只保存记录，不会发送邮件。投递阶段可在上方调整。","Aucun email n’est envoyé. Vous pouvez ajuster le statut ci-dessus.","No email is sent. Update the stage above as needed."))
                            PrimaryButton(tr("保存回复","Enregistrer la réponse","Save reply"),reply.isNotBlank() && !state.working) { vm.updateJob(job.text("id"),json("reply" to reply,"replyKind" to replyKind)); reply = "" }
                        } }
                        items(job.objects("replies").reversed()) { entry -> GlassCard { Row { Pill(product(entry.text("kind")),warm = true); Spacer(Modifier.weight(1f)); Hint(entry.text("at").take(10)) }; Text(entry.text("text"),fontSize = 14.sp,lineHeight = 22.sp) } }
                        if(job.objects("statusHistory").isNotEmpty()) item { GlassCard { Text(tr("状态时间线","Historique des étapes","Stage history"),fontWeight = FontWeight.SemiBold); job.objects("statusHistory").reversed().forEach { h -> Text(h.text("at").take(10) + " · " + product(h.text("status")),fontSize = 13.sp) } } }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun TaskSheet(task: JSONObject,state: PilotState,vm: JobPilotViewModel) {
    val result = task.child("result")
    var preview by remember(task.text("id"),result.text("proposal")) { mutableStateOf(result.text("proposal")) }
    var confirm by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = vm::dismissTask,sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),modifier = Modifier.imePadding()) {
        LazyColumn(Modifier.fillMaxWidth().fillMaxHeight(.9f),contentPadding = PaddingValues(22.dp),verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item { Row(verticalAlignment = Alignment.CenterVertically) { Text(taskTitle(task.text("kind")),Modifier.weight(1f),fontSize = 23.sp,fontWeight = FontWeight.SemiBold); Pill(taskState(task.text("status")),warm = task.text("status") == "failed") } }
            item { Hint(task.text("phase"));LocalizationNotice(result.child("localization"),vm::retryLocalization) }
            if(task.text("status") in setOf("queued","running")) item { LinearProgressIndicator(Modifier.fillMaxWidth()); Spacer(Modifier.height(10.dp)); Hint(tr("可以离开这个页面。结果会保存在当前档案的任务记录中。","Vous pouvez quitter cet écran. Le résultat sera conservé dans l’activité de ce profil.","You can leave this screen. Results will remain in this profile’s activity.")) }
            item { TaskMetrics(task.child("metrics")) }
            if(task.text("error").isNotBlank()) item { GlassCard { Text(task.text("error"),color = MaterialTheme.colorScheme.error); if(task.text("kind") != "ingest") OutlinedButton({ vm.dismissTask(); vm.startTask(JSONObject(task.child("input").toString()).put("kind",task.text("kind")).put("retry",true)) },Modifier.fillMaxWidth(),enabled = !state.working) { Text(tr("重试这项操作","Réessayer cette action","Retry this action")) } } }
            if(task.text("status") == "completed") {
                when(task.text("kind")) {
                    "ingest" -> {
                        item { Text(result.text("filename"),fontWeight = FontWeight.SemiBold); Hint(tr("这是本地提取的原文，不是 AI 改写。请检查顺序、数字、日期以及当前档案。","Texte extrait localement, sans réécriture IA. Vérifiez l’ordre, les chiffres, les dates et le profil choisi.","Locally extracted text, not an AI rewrite. Check reading order, figures, dates and selected profile.")) }
                        item { OutlinedTextField(preview,{ preview = it },Modifier.fillMaxWidth().heightIn(min = 300.dp,max = 450.dp),shape = RoundedCornerShape(20.dp)) }
                        item { PrimaryButton(tr("确认保存","Confirmer et enregistrer","Confirm and save"),!state.working && preview.isNotBlank()) { confirm = true }; TextButton(vm::dismissTask) { Text(tr("暂不修改主简历","Ne pas modifier mon CV actuel","Keep my current CV unchanged")) } }
                    }
                    "search" -> {
                        item { Text("${result.objects("offers").size} " + tr("个待核实岗位","offres à vérifier","offers to verify"),fontSize = 20.sp,fontWeight = FontWeight.SemiBold); Hint(tr("完整结果已经放在「机会」页面。","Les résultats complets sont disponibles dans Explorer.","Full results are available in Explore.")) }
                        if(result.child("searchMetrics").has("returnedCount")) item { SearchMetricsPanel(result.child("searchMetrics")) }
                        items(result.objects("offers")) { offer -> GlassCard { Text(offer.text("company"),fontWeight = FontWeight.SemiBold); Text(offer.text("title")); Hint(listOf(offer.text("sourceLabel"),offer.text("location")).filter { it.isNotBlank() }.joinToString(" · ")); Hint(offer.text("why")); OutlinedButton({ vm.saveOffer(offer) },enabled = !state.working && state.snapshot.objects("jobs").none { it.text("url") == offer.text("url") }) { Text(tr("加入清单","Enregistrer","Save offer")) } } }
                    }
                    "evaluate" -> item { GlassCard { ScoreBadge(result.optDouble("score",Double.NaN)); Text(result.text("summary")); Hint(tr("分数来自已保存的正式评估报告。","Score issu du rapport officiel enregistré.","Score from the saved formal evaluation report.")) } }
                    "cv" -> item { GlassCard { Text(tr("定制 PDF 已生成","Votre CV adapté est prêt","Your tailored CV is ready"),fontSize = 22.sp,fontWeight = FontWeight.SemiBold); Hint("ATS " + result.child("cv").text("atsScore") + "/100"); state.snapshot.objects("jobs").find { it.text("id") == result.text("jobId") }?.let { job -> PrimaryButton(tr("打开或分享 PDF","Ouvrir / partager le PDF","Open / share PDF")) { vm.shareCv(job) } } } }
                    else -> item { Markdown(result.text("markdown")) }
                }
            }
        }
    }
    if(confirm) AlertDialog(onDismissRequest = { confirm = false },title = { Text(tr("更新当前档案的主简历？","Mettre à jour le CV de ce profil ?","Update this profile’s master CV?")) },text = { Text(state.snapshot.child("profile").text("name") + "\n\n" + tr("这份简历将成为后续搜索和分析的依据。旧版会备份；未保留的经历将不再参与分析。","Ce CV deviendra la référence des recherches et analyses. L’ancienne version sera sauvegardée ; les faits retirés ne seront plus utilisés.","This becomes the source for future search and analysis. The old version is backed up; removed facts will no longer be used.")) },confirmButton = { TextButton({ confirm = false; vm.confirmCv(task.text("id"),preview) }) { Text(tr("确认更新","Confirmer","Confirm")) } },dismissButton = { TextButton({ confirm = false }) { Text(tr("返回检查","Revoir","Review")) } })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun ComparisonSheet(jobs: List<JSONObject>,vm: JobPilotViewModel,onClose: () -> Unit) {
    val ids=jobs.map{it.text("id")}.toSet()
    val locale=LocalPilotLanguage.current
    DisposableEffect(ids,locale) { vm.watchJobDisplays(ids);onDispose { vm.watchJobDisplays(emptySet()) } }
    ModalBottomSheet(onDismissRequest = onClose,sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.85f).verticalScroll(rememberScrollState()).padding(22.dp),verticalArrangement = Arrangement.spacedBy(18.dp)) {
            SectionTitle(tr("把机会放在一起看","Comparer vos opportunités","Compare your opportunities"),tr("横向滚动查看各岗位；没有评估的岗位不会显示分数。","Faites défiler les colonnes. Les offres non évaluées restent sans score.","Scroll across columns. Unrated offers stay unrated."))
            jobs.firstOrNull{it.child("localization").optBoolean("pending")}?.let { LocalizationNotice(it.child("localization"),vm::retryLocalization) }
            Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement = Arrangement.spacedBy(12.dp)) { jobs.forEach { job -> GlassCard(Modifier.width(260.dp)) { Text(job.text("company"),fontWeight = FontWeight.SemiBold); Text(job.text("role"),fontSize = 19.sp,minLines = 3); ScoreBadge(job.optDouble("score",Double.NaN)); Pill(product(job.text("status"))); Hint(job.text("location")); Hint(product(job.text("workMode"))); HorizontalDivider(); Text(tr("优势","Forces","Strengths"),fontWeight = FontWeight.SemiBold); job.strings("strengths").take(3).forEach { Bullet(it) }; Text(tr("差距","Écarts","Gaps"),fontWeight = FontWeight.SemiBold); job.objects("gaps").take(3).forEach { Bullet(it.text("title")) }; Hint(tr("薪酬：以报告和原始职位页为准","Rémunération : vérifier le rapport et l’annonce source.","Compensation: check the report and source posting.")) } } }
            PrimaryButton(tr("分析取舍与优先顺序","Analyser les compromis & priorités","Analyze tradeoffs and priorities")) { onClose(); vm.startTask(json("kind" to "compare","jobIds" to JSONArray(jobs.map { it.text("id") }))) }
        }
    }
}
