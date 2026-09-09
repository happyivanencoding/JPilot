package com.thegreatnovel.jobpilot

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
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
    var planExpanded by rememberSaveable(job.text("id")) { mutableStateOf(true) }
    val contentState=rememberLazyListState()
    val scope=rememberCoroutineScope()
    val evaluating=state.snapshot.objects("tasks").any { it.text("kind")=="evaluate" && it.text("jobId")==job.text("id") && it.text("status") in setOf("queued","running","reconciling") }
    ModalBottomSheet(onDismissRequest = { vm.selectJob(null) },sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),modifier = Modifier.imePadding()) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.92f).blockSheetEdgeMotion().testTag("job-detail-${job.text("id")}")) {
            Row(Modifier.padding(horizontal = 22.dp,vertical = 8.dp),verticalAlignment = Alignment.CenterVertically,horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f),verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(job.text("company"),color = MaterialTheme.colorScheme.primary,fontWeight = FontWeight.SemiBold); Text(job.text("role"),fontSize = 21.sp,fontWeight = FontWeight.SemiBold,maxLines = 3) }
                ScoreBadge(job.optDouble("score",Double.NaN))
            }
            val labels = listOf(tr("匹配","Match","Fit"),"CV",tr("面试","Entretien","Interview"),tr("跟踪","Suivi","Tracking"))
            TabRow(selectedTabIndex = tab,containerColor = androidx.compose.ui.graphics.Color.Transparent) { labels.forEachIndexed { i,label -> Tab(tab == i,{ tab = i },modifier=Modifier.testTag("job-tab-$i"),text = { Text(label,fontSize = 13.sp) }) } }
            LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("job-content"),state=contentState,contentPadding = PaddingValues(22.dp),verticalArrangement = Arrangement.spacedBy(16.dp),overscrollEffect=null) {
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
                        item { if(job.text("evaluationState") != "evaluated") AiProgressButton(state,"evaluate",job.text("id"),tr("运行正式评估","Évaluer ce poste","Evaluate this role"),!state.working&&!evaluating,modifier=Modifier.testTag("evaluate-job")){vm.startTask(json("kind" to "evaluate","url" to job.text("url")))}; Hint(tr("已保存的评估不会重复生成。评分不是录用概率。","Les évaluations enregistrées ne sont pas régénérées. Le score n’est pas une probabilité d’embauche.","Saved evaluations are not regenerated. Scores are not hiring probabilities.")) }
                        if(job.text("reportNum").isNotBlank()) item { TextButton({ vm.openReport(job) },Modifier.testTag("view-report")) { Text(tr("查看完整评估报告","Lire le rapport complet","Read full report")) } }
                    }
                    1 -> {
                        val cv = job.child("cv");val draft=job.child("cvDraft");val pendingDraft=draft.text("status")=="pending"
                        item { GlassCard {
                            Text(tr("为这个岗位调整表达","La bonne version, pour ce poste.","The right version for this role."),fontSize = 22.sp,fontWeight = FontWeight.SemiBold)
                            Hint(tr("只使用当前档案的已核实经历。生成结果先成为候选草稿，只有你确认后才成为这个岗位的已保留版本。","Uniquement à partir des preuves du profil actif. La proposition reste un brouillon jusqu’à votre confirmation.","Uses verified evidence only. The proposal stays a draft until you confirm it."))
                            if(cv.has("atsScore")) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Pill("ATS ${cv.text("atsScore")}/100"); if(cv.has("presentationScore")&&!cv.isNull("presentationScore"))Pill(tr("已保留呈现分 ${cv.text("presentationScore")}/100","Présentation conservée ${cv.text("presentationScore")}/100","Saved presentation ${cv.text("presentationScore")}/100")) }
                            if(cv.text("file").isNotBlank()) OutlinedButton({ vm.openCvPreview(job = job) },Modifier.fillMaxWidth(),enabled=!state.working) { Text(tr("查看已保留的定制简历","Voir le CV adapté conservé","View saved tailored CV")) }
                            if(!pendingDraft) AiProgressButton(state,"cv",job.text("id"),if(cv.text("file").isBlank())tr("生成定制 PDF 简历草稿","Générer un brouillon de CV adapté","Generate tailored CV draft")else tr("生成新的候选版本","Générer une nouvelle proposition","Generate new candidate version"),!state.working) { vm.startTask(json("kind" to "cv","jobId" to job.text("id"),"retry" to true)) }
                            if(cv.text("inputVersionId").isNotBlank() && cv.text("inputVersionId") != state.snapshot.child("cvState").text("versionId") && !pendingDraft) AiProgressButton(state,"cv",job.text("id"),tr("根据新版主简历生成新版本","Créer depuis le nouveau CV","Generate from updated master CV"),!state.working,outlined=true) { vm.startTask(json("kind" to "cv","jobId" to job.text("id"),"retry" to true)) }
                        } }
                        if(draft.length()>0)item { TailoredCvDraftCard(job,state,vm) }
                        if(cv.strings("changes").isNotEmpty()) item { GlassCard { Text(tr("已保留版本的调整","Adaptations de la version conservée","Saved version changes"),fontWeight = FontWeight.SemiBold); cv.strings("changes").forEach { Bullet(it) } } }
                        if(cv.strings("keywords").isNotEmpty()) item { GlassCard { Text(tr("岗位关键词","Mots-clés du poste","Role keywords"),fontWeight = FontWeight.SemiBold); Text(cv.strings("keywords").joinToString(" · "),fontSize = 14.sp) } }
                    }
                    2 -> {
                        val planMarkdown=job.child("mobilePlan").text("markdown")
                        if(planMarkdown.isBlank()) item { AiProgressButton(state,"plan",job.text("id"),tr("制定针对性准备计划","Créer un plan de préparation","Create a preparation plan"),!state.working) { vm.startTask(json("kind" to "plan","jobId" to job.text("id"),"minutesPerDay" to 30)) } }
                        if(planMarkdown.isNotBlank()) item { GlassCard(Modifier.testTag("interview-plan-card")) {
                            Row(Modifier.fillMaxWidth().clickable { planExpanded=!planExpanded }.testTag("toggle-interview-plan"),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                                Text(tr("面试准备计划","Plan de préparation à l’entretien","Interview preparation plan"),Modifier.weight(1f),fontSize=18.sp,fontWeight=FontWeight.SemiBold)
                                Text(if(planExpanded)tr("收起","Réduire","Collapse")else tr("展开","Développer","Expand"),fontSize=12.sp,color=MaterialTheme.colorScheme.primary)
                                Icon(if(planExpanded)Icons.Rounded.ExpandLess else Icons.Rounded.ExpandMore,null,Modifier.size(20.dp),tint=MaterialTheme.colorScheme.primary)
                            }
                            AnimatedVisibility(planExpanded) { Column(verticalArrangement=Arrangement.spacedBy(10.dp)) { HorizontalDivider();Markdown(planMarkdown) } }
                            AiProgressButton(state,"plan",job.text("id"),tr("更新准备计划","Actualiser le plan","Update preparation plan"),!state.working,outlined=true) { vm.startTask(json("kind" to "plan","jobId" to job.text("id"),"minutesPerDay" to 30,"retry" to true)) }
                        } }
                        items(job.objects("prepTasks")) { task -> Row(Modifier.fillMaxWidth(),verticalAlignment = Alignment.CenterVertically) { Checkbox(task.optBoolean("done"),{ vm.updateJob(job.text("id"),json("taskId" to task.text("id"),"taskDone" to it)) }); Text(task.text("label"),Modifier.weight(1f),fontSize = 14.sp) } }
                        val interview = job.child("interview")
                        if(interview.strings("process").isNotEmpty()) item { GlassCard { Text(tr("面试流程","Processus d’entretien","Interview process"),fontWeight = FontWeight.SemiBold); interview.strings("process").forEach { Bullet(it) }; if(!interview.optBoolean("processKnown")) Pill(tr("实际流程待确认","À confirmer avec le recruteur","Confirm with recruiter"),warm = true) } }
                        if(interview.text("caseStudy").isNotBlank()) item { GlassCard { Text(tr("针对性案例","Cas à préparer","Case preparation"),fontWeight = FontWeight.SemiBold); Text(interview.text("caseStudy"),fontSize = 14.sp) } }
                        items(interview.objects("questions")) { q -> GlassCard { Text(q.text("question"),fontWeight = FontWeight.SemiBold); Text(q.text("answer"),fontSize = 14.sp); Hint(q.text("proof")); TextButton({ practiceQuestion = q.text("question");scope.launch { val target=(contentState.layoutInfo.totalItemsCount-1).coerceAtLeast(0);contentState.animateScrollToItem(target) } },Modifier.testTag("practice-this-question")) { Text(tr("练习这道题","M’entraîner à cette question","Practice this question")) } } }
                        item { GlassCard {
                            Text(tr("针对性模拟","Simulation ciblée","Targeted practice"),fontSize = 18.sp,fontWeight = FontWeight.SemiBold)
                            OutlinedTextField(practiceQuestion,{ practiceQuestion = it },Modifier.fillMaxWidth(),label = { Text(tr("问题","Question","Question")) },minLines = 2,shape = RoundedCornerShape(18.dp))
                            OutlinedTextField(practiceAnswer,{ practiceAnswer = it },Modifier.fillMaxWidth(),label = { Text(tr("我的回答","Ma réponse","My answer")) },minLines = 4,maxLines = 10,shape = RoundedCornerShape(18.dp))
                            AiProgressButton(state,"practice",job.text("id"),tr("获取反馈","Recevoir un retour","Get feedback"),!state.working && practiceQuestion.isNotBlank() && practiceAnswer.isNotBlank()) { vm.startTask(json("kind" to "practice","jobId" to job.text("id"),"question" to practiceQuestion,"answer" to practiceAnswer)) }
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
                            Row(Modifier.horizontalScroll(rememberScrollState(),overscrollEffect=null),horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("Accusé auto","Recruteur","Entretien","Refus","Offre").forEach { kind -> FilterChip(replyKind == kind,{ replyKind = kind },label = { Text(product(kind)) }) } }
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


@Composable private fun TailoredCvDraftCard(job:JSONObject,state:PilotState,vm:JobPilotViewModel) {
    val draft=job.child("cvDraft");val assessment=draft.child("assessment");val pending=draft.text("status")=="pending"
    var editing by remember(draft.text("id"),draft.optInt("revision")) { mutableStateOf(false) }
    var payload by remember(draft.text("id"),draft.optInt("revision")) { mutableStateOf(JSONObject(draft.child("payload").toString())) }
    fun mutate(block:(JSONObject)->Unit){val next=JSONObject(payload.toString());block(next);payload=next}
    GlassCard(Modifier.testTag("tailored-cv-draft")) {
        Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(8.dp)) { Text(if(pending)tr("候选简历草稿","Brouillon de CV adapté","Tailored CV draft")else if(draft.text("status")=="accepted")tr("已保留的草稿记录","Brouillon conservé","Saved draft record")else tr("已拒绝的草稿","Brouillon refusé","Rejected draft"),Modifier.weight(1f),fontWeight=FontWeight.SemiBold,fontSize=18.sp);Pill("ATS ${draft.optInt("atsScore")}/100",warm=!draft.optBoolean("atsPass")) }
        if(assessment.has("draftScore")) Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)){Hint(tr("当前主简历","CV actuel","Current master CV"));Text(assessment.text("baselineScore"),fontSize=29.sp,fontWeight=FontWeight.SemiBold,color=MaterialTheme.colorScheme.primary)}
            Text("→",fontSize=20.sp,color=MaterialTheme.colorScheme.primary)
            Column(Modifier.weight(1f)){Hint(tr("这个草稿","Ce brouillon","This draft"));Text(assessment.text("draftScore"),fontSize=29.sp,fontWeight=FontWeight.SemiBold,color=MaterialTheme.colorScheme.primary)}
            val delta=assessment.optInt("delta");Pill((if(delta>=0)"+" else "")+delta,warm=delta<0)
        }
        Hint(tr("“呈现匹配度”衡量这份简历是否把你已有的相关证据清楚地呈现给当前岗位；它不是录用概率，也不会改变正式岗位评分。","Le score mesure uniquement la présentation de vos preuves existantes pour ce poste ; ce n’est pas une probabilité d’embauche et il ne modifie pas le score officiel.","Presentation score measures how clearly existing evidence is shown for this role; it is not hiring probability and does not change the formal job score."))
        if(assessment.text("summary").isNotBlank())Text(assessment.text("summary"),fontSize=14.sp,lineHeight=21.sp)
        if(assessment.strings("improvements").isNotEmpty()){Text(tr("这次提升来自","D’où vient l’amélioration","What improved"),fontWeight=FontWeight.SemiBold);assessment.strings("improvements").forEach { Bullet(it) }}
        if(assessment.strings("remainingGaps").isNotEmpty()){Text(tr("仍然没有被简历解决","Ce que le CV ne résout pas","Still unresolved"),fontWeight=FontWeight.SemiBold);assessment.strings("remainingGaps").forEach { Bullet(it) }}
        if(!draft.optBoolean("atsPass") && draft.objects("atsIssues").isNotEmpty()){Hint(tr("ATS 风险不会再让整份草稿失败；请在保留前检查。","Les alertes ATS n’annulent plus le brouillon ; vérifiez-les avant de le conserver.","ATS risks no longer fail the entire draft; review them before saving."));draft.objects("atsIssues").forEach { Hint(product(it.text("message"))) }}
        if(pending && editing) {
            OutlinedTextField(payload.text("summary"),{v->mutate{it.put("summary",v)}},Modifier.fillMaxWidth(),label={Text(tr("职业摘要","Résumé professionnel","Professional summary"))},minLines=4,maxLines=10,shape=RoundedCornerShape(14.dp))
            payload.objects("experience").forEachIndexed { index,entry -> Column(verticalArrangement=Arrangement.spacedBy(5.dp)){Text("${entry.text("company")} · ${entry.text("role")}",fontWeight=FontWeight.SemiBold);Hint(listOf(entry.text("location"),entry.text("dates")).filter(String::isNotBlank).joinToString(" · "));OutlinedTextField(entry.strings("bullets").joinToString("\n"),{v->mutate{root->val arr=root.optJSONArray("experience")?:JSONArray();val e=arr.optJSONObject(index)?:JSONObject();e.put("bullets",JSONArray(v.lines().map(String::trim).filter(String::isNotBlank)));arr.put(index,e);root.put("experience",arr)}},Modifier.fillMaxWidth(),label={Text(tr("经历要点（每行一条）","Points d’expérience (une ligne par point)","Experience bullets (one per line)"))},minLines=4,maxLines=12,shape=RoundedCornerShape(14.dp))} }
            payload.objects("projects").forEachIndexed { index,entry -> OutlinedTextField(entry.text("description"),{v->mutate{root->val arr=root.optJSONArray("projects")?:JSONArray();val e=arr.optJSONObject(index)?:JSONObject();e.put("description",v);arr.put(index,e);root.put("projects",arr)}},Modifier.fillMaxWidth(),label={Text(tr("项目","Projet","Project")+" · "+entry.text("name"))},minLines=3,maxLines=8,shape=RoundedCornerShape(14.dp)) }
            payload.objects("education").forEachIndexed { index,entry -> OutlinedTextField(entry.text("description"),{v->mutate{root->val arr=root.optJSONArray("education")?:JSONArray();val e=arr.optJSONObject(index)?:JSONObject();e.put("description",v);arr.put(index,e);root.put("education",arr)}},Modifier.fillMaxWidth(),label={Text(tr("教育","Formation","Education")+" · "+entry.text("title"))},minLines=2,maxLines=6,shape=RoundedCornerShape(14.dp)) }
            payload.objects("skills").forEachIndexed { index,entry -> OutlinedTextField(entry.strings("items").joinToString(", "),{v->mutate{root->val arr=root.optJSONArray("skills")?:JSONArray();val e=arr.optJSONObject(index)?:JSONObject();e.put("items",JSONArray(v.split(',', '\n').map(String::trim).filter(String::isNotBlank)));arr.put(index,e);root.put("skills",arr)}},Modifier.fillMaxWidth(),label={Text(entry.text("category",tr("技能","Compétences","Skills")))},minLines=2,maxLines=5,shape=RoundedCornerShape(14.dp)) }
            PrimaryButton(tr("保存修改并重新生成 PDF","Enregistrer et régénérer le PDF","Save edits and regenerate PDF"),!state.working){vm.updateTailoredDraft(draft.text("id"),payload);editing=false}
            TextButton({payload=JSONObject(draft.child("payload").toString());editing=false}){Text(tr("取消编辑","Annuler les modifications","Cancel edits"))}
        } else if(pending) {
            OutlinedButton({vm.openCvPreview(job=job,tailoredDraftId=draft.text("id"))},Modifier.fillMaxWidth().testTag("preview-tailored-draft"),enabled=!state.working){Text(tr("预览真实 PDF","Prévisualiser le PDF réel","Preview actual PDF"))}
            OutlinedButton({editing=true},Modifier.fillMaxWidth(),enabled=!state.working){Text(tr("手动修改这个版本","Modifier manuellement cette version","Edit this version manually"))}
            AiProgressButton(state,"cv_review",job.text("id"),if(assessment.optInt("revision",-1)==draft.optInt("revision"))tr("重新评估这个草稿","Réévaluer ce brouillon","Reassess this draft")else tr("评估修改后的草稿","Évaluer le brouillon modifié","Assess edited draft"),!state.working,outlined=true,modifier=Modifier.testTag("review-tailored-draft")){vm.startTask(json("kind" to "cv_review","jobId" to job.text("id"),"draftId" to draft.text("id"),"revision" to draft.optInt("revision"),"retry" to true))}
            Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){Button({vm.decideTailoredDraft(draft.text("id"),"accept")},Modifier.weight(1f).testTag("accept-tailored-draft"),enabled=!state.working){Text(tr("保留这个版本","Conserver","Keep"))};OutlinedButton({vm.decideTailoredDraft(draft.text("id"),"reject")},Modifier.weight(1f).testTag("reject-tailored-draft"),enabled=!state.working){Text(tr("不要这个版本","Refuser","Reject"))}}
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun TaskSheet(task: JSONObject,state: PilotState,vm: JobPilotViewModel) {
    val result = task.child("result")
    var preview by remember(task.text("id"),result.text("proposal")) { mutableStateOf(result.text("proposal")) }
    var confirm by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = vm::dismissTask,sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),modifier = Modifier.imePadding()) {
        LazyColumn(Modifier.fillMaxWidth().fillMaxHeight(.9f).blockSheetEdgeMotion(),contentPadding = PaddingValues(22.dp),verticalArrangement = Arrangement.spacedBy(16.dp),overscrollEffect=null) {
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
                    "cv" -> item { GlassCard { Text(tr("定制简历草稿已生成","Brouillon de CV adapté prêt","Tailored CV draft ready"),fontSize = 22.sp,fontWeight = FontWeight.SemiBold); val a=result.child("cvDraft").child("assessment");if(a.has("draftScore"))Hint("${a.text("baselineScore")} → ${a.text("draftScore")} (${if(a.optInt("delta")>=0)"+" else ""}${a.optInt("delta")})"); Hint(tr("回到岗位 CV 页面继续编辑、重新评估或确认保留。","Retournez à l’onglet CV du poste pour modifier, réévaluer ou conserver le brouillon.","Return to the job CV tab to edit, reassess, or keep the draft.")) } }
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
        Column(Modifier.fillMaxWidth().fillMaxHeight(.85f).blockSheetEdgeMotion().verticalScroll(rememberScrollState(),overscrollEffect=null).padding(22.dp),verticalArrangement = Arrangement.spacedBy(18.dp)) {
            SectionTitle(tr("把机会放在一起看","Comparer vos opportunités","Compare your opportunities"),tr("横向滚动查看各岗位；没有评估的岗位不会显示分数。","Faites défiler les colonnes. Les offres non évaluées restent sans score.","Scroll across columns. Unrated offers stay unrated."))
            jobs.firstOrNull{it.child("localization").optBoolean("pending")}?.let { LocalizationNotice(it.child("localization"),vm::retryLocalization) }
            Row(Modifier.horizontalScroll(rememberScrollState(),overscrollEffect=null),horizontalArrangement = Arrangement.spacedBy(12.dp)) { jobs.forEach { job -> GlassCard(Modifier.width(260.dp)) { Text(job.text("company"),fontWeight = FontWeight.SemiBold); Text(job.text("role"),fontSize = 19.sp,minLines = 3); ScoreBadge(job.optDouble("score",Double.NaN)); Pill(product(job.text("status"))); Hint(job.text("location")); Hint(product(job.text("workMode"))); HorizontalDivider(); Text(tr("优势","Forces","Strengths"),fontWeight = FontWeight.SemiBold); job.strings("strengths").take(3).forEach { Bullet(it) }; Text(tr("差距","Écarts","Gaps"),fontWeight = FontWeight.SemiBold); job.objects("gaps").take(3).forEach { Bullet(it.text("title")) }; Hint(tr("薪酬：以报告和原始职位页为准","Rémunération : vérifier le rapport et l’annonce source.","Compensation: check the report and source posting.")) } } }
            PrimaryButton(tr("分析取舍与优先顺序","Analyser les compromis & priorités","Analyze tradeoffs and priorities")) { onClose(); vm.startTask(json("kind" to "compare","jobIds" to JSONArray(jobs.map { it.text("id") }))) }
        }
    }
}
