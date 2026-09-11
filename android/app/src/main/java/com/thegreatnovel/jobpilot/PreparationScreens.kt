package com.thegreatnovel.jobpilot

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import org.json.JSONArray
import java.time.Instant
import java.time.ZoneOffset

@Composable fun TrainingScreen(state: PilotState, vm: JobPilotViewModel) {
    val jobs = state.snapshot.objects("jobs")
    var selectedId by rememberSaveable(state.profileId) { mutableStateOf("") }
    val selected = jobs.find { it.text("id") == selectedId } ?: jobs.firstOrNull()
    DisposableEffect(selected?.text("id"),state.language) {
        vm.watchJobDisplays(setOfNotNull(selected?.text("id")))
        onDispose { vm.watchJobDisplays(emptySet()) }
    }
    var selectionMenu by remember { mutableStateOf(false) }
    var minutes by rememberSaveable { mutableFloatStateOf(30f) }
    var deadline by rememberSaveable { mutableStateOf("") }
    val suggestedQuestion=selected?.child("mobilePlan")?.strings("questions")?.firstOrNull() ?: selected?.child("interview")?.objects("questions")?.firstOrNull()?.text("question") ?: tr("请介绍你的经历，以及为什么申请这个岗位。","Présentez votre parcours et votre motivation pour ce poste.","Introduce your experience and motivation for this role.")
    var question by rememberSaveable(selected?.text("id")) { mutableStateOf(suggestedQuestion) }
    var previousQuestion by rememberSaveable(selected?.text("id")) { mutableStateOf(suggestedQuestion) }
    LaunchedEffect(suggestedQuestion) {if(question==previousQuestion)question=suggestedQuestion;previousQuestion=suggestedQuestion}
    var answer by rememberSaveable(selected?.text("id")) { mutableStateOf("") }
    var coach by rememberSaveable { mutableStateOf("") }
    var analysisExpanded by rememberSaveable { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize().imePadding(),contentPadding = PaddingValues(22.dp),verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item { SectionTitle(tr("把优势讲清楚。","Préparez votre différence.","Prepare your advantage."),tr("训练围绕真实经历和目标岗位展开。","Un entraînement lié à vos preuves et au poste visé.","Practice grounded in your experience and target job.")) }
        if(state.snapshot.child("analysis").text("markdown").isNotBlank()) item { TextButton({ vm.showAnalysis() }) { Text(tr("查看已有的优势与能力分析","Consulter mes forces et compétences","Review my strengths and skills")) } }
        item { LocalizationNotice(selected?.child("localization") ?: JSONObject(),vm::retryLocalization) }
        item { GlassCard {
            Text(tr("为一个具体岗位准备","Un plan pour un poste précis","A plan for a specific role"),fontSize = 19.sp,fontWeight = FontWeight.SemiBold)
            Box {
                OutlinedButton({ selectionMenu = true },Modifier.fillMaxWidth()) { Text(selected?.let { it.text("company") + " · " + it.text("role") } ?: tr("先收藏一个岗位","Enregistrez d’abord une offre","Save an offer first"),Modifier.weight(1f),maxLines = 2); Icon(Icons.Rounded.ExpandMore,null) }
                DropdownMenu(selectionMenu,{ selectionMenu = false }) { jobs.forEach { job -> DropdownMenuItem(text = { Text(job.text("company") + " · " + job.text("role")) },onClick = { selectedId = job.text("id"); selectionMenu = false }) } }
            }
            Text(tr("每天 ${minutes.toInt()} 分钟","${minutes.toInt()} minutes par jour","${minutes.toInt()} minutes per day"),fontSize = 14.sp)
            Slider(value = minutes,onValueChange = { minutes = it },valueRange = 15f..60f,steps = 2)
            DateField(deadline,{ deadline = it },tr("面试日期（可选）","Date d’entretien (facultative)","Interview date (optional)"))
            val existingPlan=selected?.child("mobilePlan")?.text("markdown")?.isNotBlank() == true
            AiProgressButton(state,"plan",selected?.text("id"),if(existingPlan)tr("更新训练计划","Actualiser le plan","Update plan")else tr("生成针对性训练计划","Créer mon plan ciblé","Create a targeted plan"),selected != null && !state.working) { vm.startTask(json("kind" to "plan","jobId" to selected?.text("id"),"minutesPerDay" to minutes.toInt(),"interviewDate" to deadline,"retry" to existingPlan)) }
        } }
        val tasks = selected?.objects("prepTasks") ?: emptyList()
        if(tasks.isNotEmpty()) item { GlassCard {
            Text(tr("准备清单","Ma préparation","Preparation checklist"),fontSize = 18.sp,fontWeight = FontWeight.SemiBold)
            val done = tasks.count { it.optBoolean("done") }
            LinearProgressIndicator(progress = { done.toFloat() / tasks.size },modifier = Modifier.fillMaxWidth())
            Hint("$done / ${tasks.size} " + tr("已完成","terminé","completed"))
            tasks.forEach { task -> Row(Modifier.fillMaxWidth().clickable { vm.updateJob(selected!!.text("id"),json("taskId" to task.text("id"),"taskDone" to !task.optBoolean("done"))) },verticalAlignment = Alignment.CenterVertically) { Checkbox(task.optBoolean("done"),onCheckedChange = { vm.updateJob(selected!!.text("id"),json("taskId" to task.text("id"),"taskDone" to it)) }); Text(task.text("label"),Modifier.weight(1f),fontSize = 14.sp) } }
            selected?.child("mobilePlan")?.text("taskId")?.takeIf { it.isNotBlank() }?.let { planId -> TextButton({ vm.loadTask(planId) }) { Text(tr("查看完整计划","Lire le plan complet","Read full plan")) } }
        } }
        item { GlassCard {
            Text(tr("模拟面试","Entraînement à l’entretien","Interview practice"),fontSize = 19.sp,fontWeight = FontWeight.SemiBold)
            Hint(tr("反馈评分衡量回答质量，不代表录用概率。","Le score mesure votre réponse, pas votre chance d’être recruté.","Scores assess your answer, not your hiring probability."))
            val suggestions = (selected?.child("mobilePlan")?.strings("questions") ?: emptyList()) + (selected?.child("interview")?.objects("questions")?.map { it.text("question") } ?: emptyList())
            if(suggestions.isNotEmpty()) Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement = Arrangement.spacedBy(8.dp)) { suggestions.distinct().take(8).forEachIndexed { i,q -> AssistChip(onClick = { question = q },label = { Text(tr("问题 ${i+1}","Question ${i+1}","Question ${i+1}")) }) } }
            OutlinedTextField(question,{ question = it },label = { Text(tr("面试问题","Question","Question")) },modifier = Modifier.fillMaxWidth(),minLines = 2,shape = RoundedCornerShape(18.dp))
            OutlinedTextField(answer,{ answer = it },label = { Text(tr("我的回答","Ma réponse","My answer")) },modifier = Modifier.fillMaxWidth(),minLines = 5,maxLines = 10,shape = RoundedCornerShape(18.dp))
            AiProgressButton(state,"practice",selected?.text("id"),tr("获取逐项反馈","Recevoir un retour précis","Get detailed feedback"),!state.working && answer.isNotBlank() && question.isNotBlank()) { vm.startTask(json("kind" to "practice","jobId" to selected?.text("id"),"question" to question,"answer" to answer)) }
        } }
        item { GlassCard {
            Text(tr("职业教练","Coach carrière","Career coach"),fontSize = 18.sp,fontWeight = FontWeight.SemiBold)
            OutlinedTextField(coach,{ coach = it },modifier = Modifier.fillMaxWidth(),minLines = 2,label = { Text(tr("关于我的职业路径……","À propos de mon parcours…","About my career…")) },shape = RoundedCornerShape(18.dp))
            AiProgressButton(state,"coach",selected?.text("id"),tr("一起思考","Réfléchir avec mon coach","Think with my coach"),!state.working && coach.isNotBlank(),outlined=true) { vm.startTask(json("kind" to "coach","jobId" to selected?.text("id"),"question" to coach)) }
        } }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun DateField(value: String,onChange: (String) -> Unit,label: String) {
    var open by remember { mutableStateOf(false) }
    Box { OutlinedTextField(value,{},Modifier.fillMaxWidth(),readOnly = true,label = { Text(label) },trailingIcon = { Icon(Icons.Rounded.CalendarMonth,null) },shape = RoundedCornerShape(18.dp)); Box(Modifier.matchParentSize().clickable { open = true }) }
    if(open) {
        val picker = rememberDatePickerState(initialSelectedDateMillis = runCatching { java.time.LocalDate.parse(value).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli() }.getOrNull())
        DatePickerDialog(onDismissRequest = { open = false }, confirmButton = { TextButton({ picker.selectedDateMillis?.let { onChange(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString()) }; open = false }) { Text(tr("确认","Valider","Confirm")) } }, dismissButton = { TextButton({ onChange(""); open = false }) { Text(tr("清除","Effacer","Clear")) } }) { DatePicker(picker) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun ProfileScreen(state: PilotState,vm: JobPilotViewModel) {
    val context = LocalContext.current
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let { runCatching { context.contentResolver.takePersistableUriPermission(it,Intent.FLAG_GRANT_READ_URI_PERMISSION) }; vm.upload(it) } }
    var privacyMode by remember { mutableStateOf(0) }
    if(privacyMode>0) CvPrivacyDialog(vm,state,{privacyMode=0},if(privacyMode==1)({picker.launch(arrayOf("application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain","text/markdown"))})else null)
    var editCv by remember { mutableStateOf(false) }
    var cvDraft by remember(state.snapshot.text("cv")) { mutableStateOf(state.snapshot.text("cv")) }
    var confirmSave by remember { mutableStateOf(false) }
    val config = state.snapshot.child("config")
    var roles by remember(state.profileId) { mutableStateOf(config.child("target_roles").strings("primary").joinToString(", ")) }
    var location by remember(state.profileId) { mutableStateOf(config.child("candidate").text("location")) }
    var remote by remember(state.profileId) { mutableStateOf(config.child("compensation").text("location_flexibility")) }
    var preferences by remember { mutableStateOf(false) }
    var contracts by remember(state.profileId) { mutableStateOf(config.child("target_roles").strings("contract_types").toSet()) }
    val needsCv=state.snapshot.child("access").optBoolean("needsCv")
    val jobs=state.snapshot.objects("jobs")
    var profileTab by rememberSaveable(state.profileId) { mutableIntStateOf(0) }
    var applicationStatus by rememberSaveable(state.profileId) { mutableStateOf("") }
    var applicationQuery by rememberSaveable(state.profileId) { mutableStateOf("") }
    var applicationMenu by remember { mutableStateOf(false) }
    val applications=jobs.filter { (applicationStatus.isBlank() || it.text("status")==applicationStatus) &&
        (it.text("company")+" "+it.text("role")).contains(applicationQuery.trim(),ignoreCase=true) }
        .sortedByDescending { it.text("updatedAt",it.text("createdAt")) }
    val directions=state.snapshot.child("v1").objects("careerDirections")
    LazyColumn(Modifier.fillMaxSize().imePadding().testTag("profile-content"),state=analyticsListState(vm),contentPadding = PaddingValues(22.dp),verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item {
            TabRow(profileTab) {
                listOf(tr("个人资料","Mon profil","Profile"),tr("投递情况","Candidatures","Applications")).forEachIndexed { i,label ->
                    Tab(profileTab==i,{profileTab=i},modifier=Modifier.testTag("profile-tab-$i"),text={Text(label)})
                }
            }
        }
        if(profileTab==1) {
            item {
                Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
                    Text(tr("投递情况","Mes candidatures","My applications"),fontSize=22.sp,fontWeight=FontWeight.SemiBold)
                    Hint(tr("全部 ${jobs.size} 个岗位 · 当前显示 ${applications.size} 个","${jobs.size} offres · ${applications.size} affichées","${jobs.size} roles · ${applications.size} shown"))
                    OutlinedTextField(applicationQuery,{applicationQuery=it},Modifier.fillMaxWidth().testTag("application-query"),singleLine=true,label={Text(tr("搜索公司或岗位","Rechercher une entreprise ou un poste","Search company or role"))})
                    Box {
                        OutlinedButton({applicationMenu=true},Modifier.fillMaxWidth()) {Text(if(applicationStatus.isBlank())tr("全部状态","Tous les statuts","All statuses")else product(applicationStatus),Modifier.weight(1f));Icon(Icons.Rounded.ExpandMore,null)}
                        DropdownMenu(applicationMenu,{applicationMenu=false}) {
                            (listOf("")+state.snapshot.strings("statuses")+jobs.map {it.text("status")}).distinct().forEach { value ->
                                DropdownMenuItem(text={Text(if(value.isBlank())tr("全部状态","Tous les statuts","All statuses")else product(value))},onClick={applicationStatus=value;applicationMenu=false})
                            }
                        }
                    }
                    if(applications.isEmpty()) Hint(if(jobs.isEmpty())tr("保存或跟踪的岗位会显示在这里。","Vos offres enregistrées et suivies apparaîtront ici.","Saved and tracked roles will appear here.")else tr("没有符合筛选的岗位。","Aucune offre ne correspond aux filtres.","No roles match these filters."))
                }
            }
            items(applications,key={it.text("id")}) { job -> ProfileApplicationCard(job,vm) }
        } else {
        item {SearchAreaSettings(state,vm)}
        item { GlassCard(accent = true) {
            Icon(Icons.Rounded.Description,null,Modifier.size(34.dp),tint = MaterialTheme.colorScheme.primary)
            Text(tr("让简历成为起点","Le CV comme point de départ","Start with your CV"),fontSize = 22.sp,fontWeight = FontWeight.SemiBold)
            Hint(tr("PDF、Word、TXT · 最大 12 MB","PDF, Word, TXT · 12 Mo maximum","PDF, Word, TXT · up to 12 MB"))
            TextButton({privacyMode=2}) {Text(tr("简历信息如何使用","Utilisation des informations du CV","How your CV information is used"),fontSize=12.sp)}
            PrimaryButton(tr("从手机上传简历","Importer un CV du téléphone","Upload a CV from my phone"),!state.working) {privacyMode=1}
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton({ vm.openCvPreview() },Modifier.weight(1f),enabled = state.snapshot.text("cv").isNotBlank()) { Text(tr("查看 PDF","Voir le PDF","View PDF")) }
                TextButton({ editCv = true },Modifier.weight(1f)) { Text(tr("编辑内容","Modifier le contenu","Edit content")) }
            }
        } }
        if(!BuildConfig.APPLICATION_ID.endsWith(".v1")) item { GlassCard { AnalysisEntry(state,vm) } }
        if(!needsCv) item { GlassCard {
            Row(verticalAlignment=Alignment.CenterVertically) { Text(tr("我的岗位版本","Mes versions par offre","My role-specific versions"),Modifier.weight(1f),fontWeight=FontWeight.SemiBold);Hint(jobs.size.toString()) }
            Hint(tr("为不同岗位准备的简历，都在这里。","Retrouvez ici vos CV adaptés à chaque offre.","Your tailored CVs, organised by role."))
            if(jobs.isEmpty()) Hint(tr("当你在岗位页点击“查看我的 XX 分版本”，它会出现在这里。","Une offre apparaîtra ici lorsque vous demanderez votre version ciblée.","A role appears here after you request its tailored version."))
            jobs.forEach { job ->
                val hasRoleCv = job.child("cvDraft").text("id").isNotBlank() || job.child("cv").text("file").isNotBlank()
                Column(
                    Modifier.fillMaxWidth().clickable { vm.selectJob(job.text("id"), if (hasRoleCv) 1 else 0) }.padding(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) { Text(job.text("company"), fontWeight = FontWeight.SemiBold); Text(job.text("role"), fontSize = 14.sp) }
                        val match = job.child("v1Match")
                        if (match.has("displayScore")) Text("${match.optInt("displayScore")}/100", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    }
                    Hint(when { job.child("cvDraft").text("status") == "pending" -> tr("候选 CV 等待你确认", "Brouillon à confirmer", "CV draft awaiting your decision"); job.child("cv").text("file").isNotBlank() -> tr("已有岗位版 CV", "CV adapté conservé", "Tailored CV saved"); else -> tr("已保存岗位", "Offre enregistrée", "Role saved") })
                    HorizontalDivider()
                }
            }
        } }
        if(!BuildConfig.APPLICATION_ID.endsWith(".v1") && !needsCv && directions.isNotEmpty()) item { GlassCard {
            Text(tr("AI 建议的探索方向","Directions suggérées","Suggested directions"),fontWeight=FontWeight.SemiBold)
            Hint(tr("这些是建议，不会覆盖你明确填写的目标。点击一个方向会填入编辑框，由你决定是否保存。","Ce sont des suggestions ; elles ne remplacent pas vos objectifs explicites.","These are suggestions and never override your explicit goals."))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) { directions.forEach { direction -> FilterChip(false,{roles=direction.text("title");preferences=true},label={Text(direction.text("title"),maxLines=1)}) } }
        } }
        item { GlassCard {
            Text(tr("语言","Langues","Languages"),fontWeight=FontWeight.SemiBold,fontSize=18.sp)
            Text(tr("界面与分析","Application et conseils","App and insights"),fontWeight=FontWeight.Medium)
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) { listOf("zh" to "中文","fr" to "Français","en" to "English").forEach { (key,label) ->
                FilterChip(state.language==key,{vm.experienceLanguage(key)},enabled=!state.working,modifier=Modifier.testTag("ui-language-$key"),label={Text(label)})
            } }
            Hint(tr("分析、岗位详情和公司信息始终跟随界面语言；未识别系统语言时使用 English。","Les analyses, les offres et les informations sur les entreprises suivent toujours la langue de l’application ; English est utilisé si la langue système n’est pas reconnue.","Analysis, role details and company information always follow the app language; English is used when the system language is not recognised."))
            HorizontalDivider()
            Text(tr("求职简历","CV de candidature","Application CV"),fontWeight=FontWeight.Medium)
            val material=state.snapshot.child("languageSettings").text("applicationLanguage",config.child("cv").text("language","fr"))
            Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) { listOf("fr" to "Français","en" to "English").forEach { (key,label) ->
                FilterChip(material==key,{vm.saveProfile(json("applicationLanguage" to key))},modifier=Modifier.testTag("material-language-$key"),enabled=!state.working,label={Text(label)})
            } }
            Hint(tr("只决定新生成简历的语言，不限制岗位搜索。","La langue de vos prochains CV, pas un filtre sur les offres.","The language of new CVs, not a filter on job opportunities."))
        } }
        item { GlassCard {
            Row(verticalAlignment = Alignment.CenterVertically) { Text(tr("求职偏好","Mes critères","Job preferences"),Modifier.weight(1f),fontWeight = FontWeight.SemiBold); TextButton({ preferences = !preferences }) { Text(tr("编辑","Modifier","Edit")) } }
            Hint(listOf(roles,location,remote).filter { it.isNotBlank() }.joinToString("\n").ifBlank { tr("填写目标岗位与工作地点","Définissez les rôles et lieux ciblés.","Set target roles and locations.") })
            Text(tr("合同／职位类型","Types de contrat","Contract types"),fontWeight = FontWeight.Medium,fontSize = 14.sp)
            Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("Stage","Alternance","CDI","CDD").forEach { type -> FilterChip(type in contracts,{ contracts = if(type in contracts) contracts - type else contracts + type; vm.saveProfile(json("contractTypes" to JSONArray(contracts.toList()))) },label = { Text(product(type)) },enabled = !state.working) } }
            if(contracts.isEmpty()) Hint(tr("不限制合同类型","Tous les types de contrat","All contract types"))
            if(preferences) {
                OutlinedTextField(roles,{ roles = it },Modifier.fillMaxWidth(),label = { Text(tr("目标岗位（逗号分隔）","Rôles ciblés (séparés par virgule)","Target roles (comma separated)")) },shape = RoundedCornerShape(18.dp))
                OutlinedTextField(location,{ location = it },Modifier.fillMaxWidth(),label = { Text(tr("城市","Localisation","Location")) },shape = RoundedCornerShape(18.dp))
                OutlinedTextField(remote,{ remote = it },Modifier.fillMaxWidth(),label = { Text(tr("远程办公偏好","Préférence télétravail","Remote preference")) },shape = RoundedCornerShape(18.dp))
                PrimaryButton(tr("保存偏好","Enregistrer mes critères","Save preferences"),!state.working) { vm.saveProfile(json("roles" to JSONArray(roles.split(',').map { it.trim() }.filter { it.isNotBlank() }),"location" to location,"remote" to remote)); preferences = false }
            }
        } }
        item { GlassCard {
            Text(tr("外观","Apparence","Appearance"),fontWeight = FontWeight.SemiBold)
            Row(Modifier.horizontalScroll(rememberScrollState()),horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("system" to tr("系统","Système","System"),"light" to tr("亮色","Clair","Light"),"dark" to tr("暗色","Sombre","Dark")).forEach { (key,label) -> FilterChip(state.theme == key,{ vm.appearance(theme = key) },label = { Text(label) }) } }
        } }

        item { TextButton(vm::logout,Modifier.fillMaxWidth().testTag("sign-out")) {Text(tr("登出","Se déconnecter","Sign out"))} }
        }
    }
    if(editCv) ModalBottomSheet(onDismissRequest = { editCv = false },sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),modifier = Modifier.imePadding()) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.88f).blockSheetEdgeMotion().padding(22.dp),verticalArrangement = Arrangement.spacedBy(14.dp)) {
            SectionTitle(tr("我的主简历","Mon CV de référence","My master CV"))
            OutlinedTextField(cvDraft,{ cvDraft = it },Modifier.fillMaxWidth().weight(1f),shape = RoundedCornerShape(20.dp))
            PrimaryButton(tr("保存修改","Enregistrer les modifications","Save changes"),!state.working && cvDraft.isNotBlank()) { confirmSave = true }
        }
    }
    if(confirmSave) AlertDialog(onDismissRequest = { confirmSave = false },title = { Text(tr("替换当前主简历？","Remplacer le CV actuel ?","Replace the current CV?")) },text = { Text(tr("这将更新当前档案的求职依据。旧版会备份，未保留的经历将不再参与后续分析。","Cette version deviendra la référence du profil sélectionné. L’ancienne version sera sauvegardée ; les faits retirés ne seront plus inclus dans les analyses.","This becomes the selected profile’s reference CV. The previous version is backed up; removed facts will no longer inform analysis.")) },confirmButton = { TextButton({ vm.saveCv(cvDraft); confirmSave = false; editCv = false }) { Text(tr("确认保存","Confirmer","Confirm")) } },dismissButton = { TextButton({ confirmSave = false }) { Text(tr("返回检查","Revoir","Review")) } })
}
