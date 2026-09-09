package com.thegreatnovel.jobpilot

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable fun PilotApp(vm: JobPilotViewModel, state: PilotState) {
    if (!state.loggedIn) { LoginScreen(vm,state); return }
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var filter by rememberSaveable(state.profileId) { mutableStateOf("") }
    var filterRequest by rememberSaveable(state.profileId) { mutableIntStateOf(0) }
    var profileMenu by remember { mutableStateOf(false) }
    var taskCenter by remember { mutableStateOf(false) }
    val holder = rememberSaveableStateHolder()
    val labels = listOf(tr("首页","Accueil","Home"),tr("机会","Offres","Offers"),tr("投递","Candidatures","Applications"),tr("准备","Préparer","Prepare"),tr("档案","Dossier","Profile"))
    val icons = listOf(Icons.Rounded.Home,Icons.Rounded.Search,Icons.Rounded.WorkOutline,Icons.Rounded.School,Icons.Rounded.PersonOutline)
    val tasks = state.snapshot.objects("tasks")
    val active = tasks.filter { it.text("status") in setOf("queued","running","reconciling") }
    val keyboard = WindowInsets.ime.getBottom(LocalDensity.current) > 0
    LaunchedEffect(state.destination) { state.destination?.let { tab = it.optInt("tab",tab); filter = it.text("filter"); filterRequest++; vm.consumeDestination() } }
    LaunchedEffect(state.profileId) { taskCenter = false }
    BackHandler(tab != 0 && state.task == null && state.selectedJob == null && !state.analysisVisible && state.cvPreview == null) { tab = 0 }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            PilotChrome {
                Column {
                    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp,vertical = 8.dp),verticalAlignment = Alignment.CenterVertically) {
                        Image(painterResource(R.drawable.ic_jobpilot),null,Modifier.size(34.dp))
                        Text("JobPilot",Modifier.padding(start = 8.dp).weight(1f),fontSize = 21.sp,letterSpacing=(-.6).sp,fontWeight = FontWeight.SemiBold)
                        Box {
                            TextButton({ profileMenu = true },modifier=Modifier.testTag("profile-switch"),contentPadding = PaddingValues(horizontal = 8.dp)) {
                                Text(state.snapshot.objects("profiles").find { it.text("id") == state.profileId }?.text("shortName")?.substringBefore(" ·") ?: tr("档案","Profil","Profile"),maxLines = 1)
                                Icon(Icons.Rounded.ExpandMore,null,Modifier.size(18.dp))
                            }
                            DropdownMenu(profileMenu,{ profileMenu = false }) { state.snapshot.objects("profiles").forEach { p -> DropdownMenuItem(modifier=Modifier.testTag("profile-${p.text("id")}"),text = { Text(p.text("name")) },onClick = { profileMenu = false; tab = 0; filter = ""; vm.selectProfile(p.text("id")) }) } }
                        }
                        IconButton({ taskCenter = true },Modifier.testTag("task-center")) {
                            BadgedBox(badge = { if(active.isNotEmpty()) Badge { Text(active.size.toString()) } }) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.Rounded.PendingActions,tr("后台任务","Traitements en cours","Background tasks"),Modifier.size(25.dp))
                                    if(state.working) CircularProgressIndicator(Modifier.size(34.dp),strokeWidth = 1.5.dp)
                                }
                            }
                        }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                }
            }
        },
        bottomBar = {
            AnimatedVisibility(!keyboard) {
                Column {
                    HorizontalDivider()
                    NavigationBar(containerColor = MaterialTheme.colorScheme.surface.copy(alpha=.92f),tonalElevation = 1.dp) {
                        labels.forEachIndexed { i,label -> NavigationBarItem(modifier=Modifier.testTag("nav-$i"),selected = tab == i,onClick = { tab = i; if(i == 2) filter = "" },icon = { Icon(icons[i],label,Modifier.size(22.dp)) },label = { Text(label,fontSize = 10.sp,maxLines = 1) },colors = NavigationBarItemDefaults.colors(indicatorColor = MaterialTheme.colorScheme.primaryContainer)) }
                    }
                }
            }
        }
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            Column(Modifier.fillMaxSize()) {
                if(state.error != null) Surface(color = MaterialTheme.colorScheme.errorContainer) {
                    Row(Modifier.padding(horizontal = 16.dp,vertical = 6.dp),verticalAlignment = Alignment.CenterVertically) {
                        Text(product(state.error),Modifier.weight(1f),fontSize = 12.sp)
                        IconButton(vm::clearMessage) { Icon(Icons.Rounded.Close,tr("关闭","Fermer","Dismiss"),Modifier.size(18.dp)) }
                    }
                }
                LocalizationNotice(state.snapshot.child("localization"),vm::retryLocalization)
                PullToRefreshBox(isRefreshing = state.loading,onRefresh = { vm.refresh() },modifier = Modifier.fillMaxSize()) {
                    AnimatedContent(targetState = tab,label = "destination",transitionSpec = { fadeIn(tween(160)) togetherWith fadeOut(tween(100)) }) { page ->
                        holder.SaveableStateProvider("${state.profileId}:$page") {
                            when(page) {
                                0 -> OverviewScreen(state,vm,onExplore = { tab = 1 },onPrepare = { tab = 3 },onProfile = { tab = 4 },onFilter = { filter = it; filterRequest++; tab = 2 })
                                1 -> ExploreScreen(state,vm)
                                2 -> ApplicationsScreen(state,vm,filter = filter,onFilter={filter=it},filterRequest = filterRequest)
                                3 -> TrainingScreen(state,vm)
                                else -> ProfileScreen(state,vm)
                            }
                        }
                    }
                }
            }
            AnimatedVisibility(state.notice != null,modifier = Modifier.align(Alignment.BottomCenter).padding(12.dp),enter = fadeIn() + slideInVertically { it/2 },exit = fadeOut() + slideOutVertically { it/2 }) {
                Surface(shape = RoundedCornerShape(10.dp),color = MaterialTheme.colorScheme.inverseSurface.copy(alpha=.96f),border=BorderStroke(.5.dp,MaterialTheme.colorScheme.primary.copy(alpha=.25f)),shadowElevation = 2.dp) {
                    Row(Modifier.padding(start = 14.dp,end = 4.dp,top = 8.dp,bottom = 8.dp),verticalAlignment = Alignment.CenterVertically) {
                        Text(product(state.notice.orEmpty()),Modifier.weight(1f),fontSize = 12.sp,lineHeight = 17.sp,color = MaterialTheme.colorScheme.inverseOnSurface,maxLines = 3)
                        state.noticeTaskId?.takeIf { it.isNotBlank() }?.let { id -> TextButton({ vm.clearNotice(); val t = tasks.find { it.text("id") == id }; if(t?.text("status") == "completed") vm.loadTask(id) else taskCenter = true }) { Text(tr("查看","Voir","View"),color = MaterialTheme.colorScheme.inversePrimary) } }
                    }
                }
            }
        }
    }
    if(taskCenter) ModalBottomSheet(containerColor=MaterialTheme.colorScheme.surface.copy(alpha=.97f),contentColor=MaterialTheme.colorScheme.onSurface,onDismissRequest = { taskCenter = false },sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        val recent = tasks.filter { it.text("status") !in setOf("queued","running","reconciling") }.distinctBy { it.text("kind") + ":" + it.text("inputVersionId") + ":" + it.text("jobId") }.take(3)
        LazyColumn(Modifier.fillMaxWidth().heightIn(max = 570.dp),contentPadding = PaddingValues(horizontal = 20.dp,vertical = 10.dp),verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { SectionTitle(tr("后台任务","Vos traitements","Background tasks"),tr("已完成的结果，直接回到对应页面。","Vos résultats, au bon endroit.","Your results, where they belong.")) }
            item { LocalizationNotice(state.snapshot.child("localization"),vm::retryLocalization) }
            if(active.isEmpty() && recent.isEmpty()) item { Hint(tr("当前没有任务。","Aucun traitement pour ce profil.","No tasks for this profile.")) }
            items(active + recent,key = { it.text("id") }) { task ->
                Column(Modifier.fillMaxWidth().testTag("task-${task.text("id")}").clickable { if(task.text("status") == "completed" || task.text("status") == "failed") { taskCenter = false; vm.loadTask(task.text("id")) } }.padding(vertical = 8.dp),verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically,horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        if(task.text("status") in setOf("queued","running","reconciling")) CircularProgressIndicator(Modifier.size(16.dp),strokeWidth = 2.dp) else Icon(if(task.text("status") == "completed") Icons.Rounded.CheckCircleOutline else Icons.Rounded.ErrorOutline,null,Modifier.size(20.dp),tint = MaterialTheme.colorScheme.primary)
                        Text(task.text("title",taskTitle(task.text("kind"))),Modifier.weight(1f),fontWeight = FontWeight.SemiBold,fontSize = 14.sp)
                        if(task.text("status") in setOf("completed","failed")) Icon(Icons.Rounded.ChevronRight,null,Modifier.size(18.dp))
                    }
                    Hint(task.text("phase"))
                    if(task.text("status") in setOf("queued","running")) Hint(product(task.child("estimate").text("label","Habituellement quelques minutes")))
                    HorizontalDivider(Modifier.padding(top = 6.dp))
                }
            }
            item { Spacer(Modifier.navigationBarsPadding()) }
        }
    }
    if(state.task != null) TaskSheet(state.task,state,vm)
    else state.selectedJob?.let { id -> state.snapshot.objects("jobs").find { it.text("id") == id }?.let { JobDetailSheet(it,state,vm) } }
    if(state.analysisVisible && state.snapshot.has("analysis")) AnalysisSheet(state,vm)
    if(state.cvPreview != null || state.previewLoading) CvPreviewDialog(state,vm)
}

@Composable fun taskTitle(kind: String) = when(kind) {
    "ingest" -> tr("简历导入","Import du CV","CV import")
    "search" -> tr("岗位搜索","Recherche d’offres","Offer search")
    "evaluate" -> tr("岗位评估","Évaluation du poste","Job evaluation")
    "cv" -> tr("定制简历","CV adapté","Tailored CV")
    "rewrite" -> tr("简历草稿","Brouillon du CV","CV draft")
    "report" -> tr("岗位评估报告","Rapport d’évaluation","Evaluation report")
    "analysis" -> tr("简历与能力","CV et compétences","CV and skills")
    "plan" -> tr("面试准备","Préparation de l’entretien","Interview preparation")
    "practice" -> tr("面试练习反馈","Simulation d’entretien","Interview practice")
    "compare" -> tr("岗位对比","Comparaison des offres","Offer comparison")
    else -> tr("职业建议","Conseil de carrière","Career advice")
}
@Composable fun taskState(status: String) = when(status) {
    "completed" -> tr("已完成","Terminé","Completed")
    "failed" -> tr("需处理","À vérifier","Needs attention")
    "interrupted","reconciling" -> tr("核对中","Vérification","Checking")
    "running" -> tr("进行中","En cours","Running")
    else -> tr("排队中","En attente","Queued")
}
@Composable private fun LoginScreen(vm: JobPilotViewModel,state: PilotState) {
    val context = LocalContext.current
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp),verticalArrangement = Arrangement.Center) {
        Image(painterResource(R.drawable.ic_jobpilot),null,Modifier.size(64.dp))
        Spacer(Modifier.height(24.dp))
        Text("JobPilot",fontSize = 34.sp,fontWeight = FontWeight.Bold)
        Text(tr("为下一份工作，做好决定。","Votre prochain poste.\nDes décisions éclairées.","Your next role.\nBetter-informed decisions."),Modifier.padding(vertical = 16.dp),fontSize = 25.sp,lineHeight = 32.sp,fontWeight = FontWeight.SemiBold)
        Hint(tr("你的简历、岗位判断和投递进展。档案保存在电脑上，分析使用你配置的 AI 服务。","Votre CV, vos opportunités et vos candidatures. Dossiers sur votre ordinateur ; analyses via votre service IA configuré.","Your CV, opportunities and applications. Records stay on your computer; analysis uses your configured AI service."))
        Spacer(Modifier.height(30.dp))
        PrimaryButton(if(state.loginPending) tr("等待浏览器确认","Confirmez dans le navigateur","Confirm in your browser") else tr("安全登录","Se connecter","Sign in"),!state.working && !state.loginPending) { vm.beginLogin { context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(it))) } }
        if(state.loginPending || state.working) LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 8.dp))
        state.error?.let { Text(product(it),Modifier.padding(vertical = 12.dp),color = MaterialTheme.colorScheme.error) }
        if(BuildConfig.DEBUG) TextButton(vm::usbLogin,enabled = !state.working) { Icon(Icons.Rounded.Usb,null,Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text(tr("通过 USB 连接电脑","Connexion USB au PC","Connect through USB")) }
        Row { listOf("zh" to "中文","fr" to "Français","en" to "English").forEach { (code,label) -> TextButton({ vm.appearance(language = code) }) { Text(label) } } }
    }
}
