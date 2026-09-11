package com.thegreatnovel.jobpilot

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.PersonOutline
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import org.json.JSONObject

private data class GuideTab(val icon: ImageVector, val title: String, val summary: String, val details: List<String>)

@Composable private fun guideTabs(): List<GuideTab> = listOf(
    GuideTab(Icons.Rounded.Home, tr("首页", "Accueil", "Home"), tr("先看你适合什么，而不是先学会操作软件。", "Commencez par comprendre où votre profil peut aller.", "Start by seeing where your profile can go."), listOf(
        tr("确认简历后，JobPilot 会自动理解你的经历并给出 3–5 个可探索方向。", "Après confirmation du CV, JobPilot comprend votre parcours et propose 3–5 directions à explorer.", "After you confirm your CV, JobPilot understands your experience and suggests 3–5 directions."),
        tr("首页直接展示最值得先看的真实岗位和当前能力信号。", "L’accueil montre directement les offres les plus pertinentes et vos principaux signaux.", "Home shows the most useful real roles and your main profile signals.")
    )),
    GuideTab(Icons.Rounded.Search, tr("机会", "Offres", "Offers"), tr("先看即时匹配分，再决定要不要深入。", "Voyez d’abord le score de match, puis choisissez quoi approfondir.", "See the match score first, then decide what deserves a closer look."), listOf(
        tr("所有结果先用快速 0–100 匹配排序，不需要逐个等待 AI。", "Toutes les offres reçoivent d’abord un score rapide sur 100, sans attente IA offre par offre.", "Every result gets an immediate 0–100 match before any deep AI work."),
        tr("前几条岗位会在后台补充职责、要求、加分点、真实缺口和 CV 提升空间。", "Les premières offres sont enrichies en arrière-plan avec missions, exigences, forces, écarts réels et potentiel du CV.", "Top roles are enriched in the background with responsibilities, requirements, strengths, real gaps and CV upside.")
    )),
    GuideTab(Icons.Rounded.PersonOutline, tr("我的", "Moi", "My"), tr("管理你的事实来源和每个岗位的独立简历版本。", "Gérez votre source de vérité et vos versions de CV par offre.", "Manage your source of truth and independent role-specific CVs."), listOf(
        tr("Master Profile 是所有匹配与新简历的共同事实来源。", "Le Master Profile est la source commune de tous les matchs et nouveaux CV.", "The Master Profile is the shared fact source for every match and new CV."),
        tr("每个岗位版本都独立从 Master 分叉，不会把上一份定制 CV 当作下一份输入。", "Chaque CV ciblé repart du Master ; une version d’offre ne devient jamais la source de la suivante.", "Every tailored CV branches from Master; one role CV never becomes the next role's input.")
    ))
)

@Composable fun OnboardingDialog(welcome: Boolean, tab: Int?, onDismiss: () -> Unit, onSkip: () -> Unit) {
    val tabs = guideTabs()
    val selected = tab?.let { tabs.getOrNull(it) }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = false, dismissOnClickOutside = false)) {
        Surface(Modifier.fillMaxSize().safeDrawingPadding().padding(20.dp), shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface, tonalElevation = 4.dp) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (welcome) {
                    Surface(Modifier.size(48.dp), shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.primary) { Box(contentAlignment = Alignment.Center) { Text("J", color = MaterialTheme.colorScheme.onPrimary, fontSize = 26.sp, fontWeight = FontWeight.Bold) } }
                    Text("JobPilot", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Text(tr("欢迎使用 JobPilot", "Bienvenue dans JobPilot", "Welcome to JobPilot"), fontSize = 25.sp, lineHeight = 31.sp, fontWeight = FontWeight.SemiBold)
                    Text(tr("用几步了解你的求职工作台。", "Découvrez votre espace de recherche en quelques étapes.", "Learn your job-search workspace in a few steps."), style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(vertical = 6.dp)) {
                        tabs.forEach { item -> Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                            Surface(Modifier.size(38.dp), shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.primaryContainer) { Box(contentAlignment = Alignment.Center) { Icon(item.icon, item.title, tint = MaterialTheme.colorScheme.primary) } }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) { Text(item.title, fontWeight = FontWeight.SemiBold); Hint(item.summary) }
                        } }
                    }
                    PrimaryButton(tr("开始使用", "Commencer", "Get started"), onClick = onDismiss)
                    TextButton(onClick = onSkip, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text(tr("跳过引导", "Passer le guide", "Skip guide")) }
                } else if (selected != null) {
                    Surface(Modifier.size(54.dp), shape = RoundedCornerShape(15.dp), color = MaterialTheme.colorScheme.primaryContainer) { Box(contentAlignment = Alignment.Center) { Icon(selected.icon, selected.title, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp)) } }
                    Text(tr("第一次查看这个 Tab", "Première découverte de cet onglet", "First look at this tab"), color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Text(selected.title, fontSize = 25.sp, lineHeight = 31.sp, fontWeight = FontWeight.SemiBold)
                    Text(selected.summary, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(vertical = 8.dp)) { selected.details.forEach { detail -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) { Text("✓", color = MaterialTheme.colorScheme.primary, fontSize = 17.sp, fontWeight = FontWeight.Bold); Text(detail, style = MaterialTheme.typography.bodyLarge, lineHeight = 22.sp) } } }
                    PrimaryButton(tr("知道了，开始使用", "Compris, commencer", "Got it, start exploring"), onClick = onDismiss)
                    TextButton(onClick = onSkip, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text(tr("跳过引导", "Passer le guide", "Skip guide")) }
                }
            }
        }
    }
}

@Composable
fun V1FirstRunOnboarding(state: PilotState, vm: JobPilotViewModel) {
    val context = LocalContext.current
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let {
            runCatching { context.contentResolver.takePersistableUriPermission(it, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
            vm.upload(it)
        }
    }
    var authStep by rememberSaveable { mutableStateOf(0) }
    var invite by rememberSaveable { mutableStateOf("") }
    var cvConfirmed by rememberSaveable { mutableStateOf(false) }
    var chosenTitle by rememberSaveable { mutableStateOf("") }
    var chosenQuery by rememberSaveable { mutableStateOf("") }
    var customQuery by rememberSaveable { mutableStateOf("") }
    var submittedQuery by rememberSaveable { mutableStateOf("") }
    val ingest = state.task?.takeIf { it.text("kind") == "ingest" }
    val proposal = ingest?.child("result")?.text("proposal").orEmpty()
    var cvPreview by remember(ingest?.text("id"), proposal) { mutableStateOf(proposal) }
    val v1 = state.snapshot.child("v1")
    val directions = v1.objects("careerDirections")
    val discovery = state.snapshot.child("discovery")
    val offers = discovery.objects("offers").take(4)
    val searchReady = submittedQuery.isNotBlank() && discovery.text("query").equals(submittedQuery, ignoreCase = true) && offers.isNotEmpty() && v1.text("searchState") !in setOf("queued", "running", "reconciling")
    val analysisReady = v1.text("analysisState") == "completed" && directions.isNotEmpty()
    val stage = when {
        authStep < 2 -> authStep
        !cvConfirmed -> 2
        !analysisReady -> 3
        submittedQuery.isBlank() -> 4
        !searchReady -> 5
        else -> 6
    }
    val extractedName = cvPreview.lineSequence().map { it.trim().trimStart('#').trim() }.firstOrNull { it.length in 2..60 && !it.contains('@') && !it.startsWith("cv", true) }
    val displayName = extractedName?.takeIf { it.isNotBlank() } ?: state.snapshot.child("profile").text("name").substringBefore('—').trim().ifBlank { tr("你好", "Bonjour", "Hi") }

    Dialog(onDismissRequest = {}, properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = false, dismissOnClickOutside = false)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            AnimatedContent(targetState = stage, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "v1-first-run") { page ->
                Column(
                    Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 28.dp),
                    verticalArrangement = Arrangement.spacedBy(18.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Surface(Modifier.size(42.dp), shape = RoundedCornerShape(11.dp), color = MaterialTheme.colorScheme.primary) { Box(contentAlignment = Alignment.Center) { Text("J", color = MaterialTheme.colorScheme.onPrimary, fontSize = 23.sp, fontWeight = FontWeight.Bold) } }
                        Text("JobPilot", fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.weight(1f))
                        Text("${(page + 1).coerceAtMost(7)}/7", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    when (page) {
                        0 -> {
                            Text(tr("先验证你的邀请", "Validez d’abord votre invitation", "First, verify your invitation"), fontSize = 29.sp, lineHeight = 35.sp, fontWeight = FontWeight.SemiBold)
                            Hint(tr("这是 V1 测试入口。输入邀请码后继续。", "Entrée de test V1. Saisissez votre code d’invitation.", "This is the V1 test entry. Enter your invite code to continue."))
                            OutlinedTextField(invite, { invite = it }, Modifier.fillMaxWidth(), label = { Text(tr("邀请码", "Code d’invitation", "Invite code")) }, singleLine = true, shape = RoundedCornerShape(14.dp))
                            PrimaryButton(tr("继续", "Continuer", "Continue"), invite.isNotBlank()) { authStep = 1 }
                        }
                        1 -> {
                            Text(tr("用 Google 账号继续", "Continuez avec Google", "Continue with Google"), fontSize = 29.sp, lineHeight = 35.sp, fontWeight = FontWeight.SemiBold)
                            Hint(tr("当前 V1 预览使用模拟登录，不会打开或读取真实 Google 账号。", "Cet aperçu V1 simule la connexion et n’accède à aucun compte Google réel.", "This V1 preview simulates sign-in and does not access a real Google account."))
                            Surface(shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), color = MaterialTheme.colorScheme.surface) {
                                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("Google", fontWeight = FontWeight.SemiBold)
                                    Text("jobpilot.v1.test@gmail.com", fontSize = 14.sp)
                                    Hint(tr("测试账号", "Compte de test", "Test account"))
                                }
                            }
                            PrimaryButton(tr("模拟 Google 登录", "Simuler la connexion Google", "Simulate Google sign-in")) { authStep = 2 }
                        }
                        2 -> {
                            Text(tr("先把你的简历交给我们", "Commencez par votre CV", "Start with your CV"), fontSize = 29.sp, lineHeight = 35.sp, fontWeight = FontWeight.SemiBold)
                            Hint(tr("我们先提取事实，再给方向和职位。不会先替你改写简历。", "Nous extrayons d’abord les faits, avant de proposer des directions et des postes.", "We extract the facts first, then suggest directions and roles."))
                            when {
                                ingest == null -> {
                                    Surface(shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                                        Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                            Icon(Icons.Rounded.Description, null, Modifier.size(42.dp), tint = MaterialTheme.colorScheme.primary)
                                            Text(tr("PDF / DOCX / TXT / MD", "PDF / DOCX / TXT / MD", "PDF / DOCX / TXT / MD"), fontWeight = FontWeight.SemiBold)
                                            Hint(tr("最大 12 MB", "12 Mo maximum", "Up to 12 MB"))
                                        }
                                    }
                                    PrimaryButton(tr("上传我的简历", "Importer mon CV", "Upload my CV"), !state.working) { picker.launch(arrayOf("application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown")) }
                                }
                                ingest.text("status") in setOf("queued", "running", "reconciling") -> {
                                    LinearProgressIndicator(Modifier.fillMaxWidth())
                                    Text(tr("正在读取你的简历…", "Lecture de votre CV…", "Reading your CV…"), fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                                    Hint(tr("提取姓名、教育、经历、技能和项目。", "Extraction du nom, de la formation, des expériences, compétences et projets.", "Extracting name, education, experience, skills and projects."))
                                }
                                ingest.text("status") == "completed" && cvPreview.isNotBlank() -> {
                                    Text(tr("信息提取完成", "Extraction terminée", "CV extracted"), fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                                    Hint(ingest.child("result").text("filename"))
                                    OutlinedTextField(cvPreview, { cvPreview = it }, Modifier.fillMaxWidth().heightIn(min = 220.dp, max = 360.dp), label = { Text(tr("提取内容", "Contenu extrait", "Extracted content")) }, shape = RoundedCornerShape(14.dp))
                                    PrimaryButton(tr("确认，开始分析", "Confirmer et analyser", "Confirm and analyze"), !state.working && cvPreview.isNotBlank()) {
                                        cvConfirmed = true
                                        vm.confirmCv(ingest.text("id"), cvPreview)
                                    }
                                }
                                else -> {
                                    Text(tr("这份简历没有成功读取", "Ce CV n’a pas pu être lu", "This CV could not be read"), fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                                    state.error?.let { Hint(it) }
                                    OutlinedButton({ vm.dismissTask() }, Modifier.fillMaxWidth()) { Text(tr("重新选择文件", "Choisir un autre fichier", "Choose another file")) }
                                }
                            }
                        }
                        3 -> {
                            CircularProgressIndicator(Modifier.size(46.dp))
                            Text(tr("简历读完了。正在找你的闪光点。", "CV lu. Nous cherchons maintenant vos points forts.", "CV read. Now finding where you stand out."), fontSize = 27.sp, lineHeight = 34.sp, fontWeight = FontWeight.SemiBold)
                            Hint(tr("我们会把经历和可能的职业方向放在一起看。", "Nous rapprochons votre parcours de plusieurs directions possibles.", "We are matching your experience with possible career directions."))
                            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
                            if(state.error!=null) OutlinedButton({ cvConfirmed=false },Modifier.fillMaxWidth()) { Text(tr("返回检查简历", "Revenir au CV", "Back to CV")) }
                        }
                        4 -> {
                            Text(tr("你好，$displayName。", "Bonjour $displayName.", "Hi, $displayName."), fontSize = 29.sp, lineHeight = 35.sp, fontWeight = FontWeight.SemiBold)
                            Text(tr("我们看了你的简历，这几个方向可能会让你更有优势。", "Après lecture de votre CV, voici quelques directions où votre profil peut ressortir.", "We read your CV. These directions may let your profile stand out."), fontSize = 17.sp, lineHeight = 24.sp)
                            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                                directions.take(5).forEach { direction ->
                                    val title = direction.text("title")
                                    val query = direction.text("searchQuery").ifBlank { title }
                                    FilterChip(selected = chosenQuery == query, onClick = { chosenTitle = title; chosenQuery = query; customQuery = "" }, label = { Text(title) })
                                }
                            }
                            OutlinedTextField(customQuery, { customQuery = it; if (it.isNotBlank()) { chosenTitle = it; chosenQuery = it } }, Modifier.fillMaxWidth(), label = { Text(tr("或者告诉我你更想看什么", "Ou dites-nous ce que vous voulez explorer", "Or tell us what you want to explore")) }, shape = RoundedCornerShape(14.dp))
                            PrimaryButton(tr("就看这个方向", "Explorer cette direction", "Explore this direction"), chosenQuery.isNotBlank()) {
                                val query = customQuery.trim().ifBlank { chosenQuery }
                                submittedQuery = query
                                vm.startTask(json("kind" to "search", "query" to query, "silent" to true))
                            }
                        }
                        5 -> {
                            CircularProgressIndicator(Modifier.size(46.dp))
                            Text(tr("好，我们正在找 $chosenTitle 的职位。", "Très bien. Nous cherchons des postes en $chosenTitle.", "Got it. We’re finding $chosenTitle roles."), fontSize = 27.sp, lineHeight = 34.sp, fontWeight = FontWeight.SemiBold)
                            Hint(tr("先找真实岗位，再给每个岗位快速评分。", "D’abord de vraies offres, puis un score rapide pour chacune.", "First real roles, then a quick score for each one."))
                        }
                        else -> {
                            Text(tr("找到了。先滑一滑。", "Voici une première sélection.", "Found them. Swipe through."), fontSize = 29.sp, lineHeight = 35.sp, fontWeight = FontWeight.SemiBold)
                            Hint(tr("左右滑动看 3–4 个职位；点卡片就进入正常职位详情。", "Faites glisser pour parcourir 3–4 offres ; touchez une carte pour ouvrir le détail.", "Swipe through 3–4 roles; tap a card to open the normal role detail."))
                            LazyRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(end = 28.dp)) {
                                items(offers, key = { it.text("url") }) { offer -> FirstRunOfferCard(offer) { vm.completeV1FirstRun(); vm.selectOffer(offer.text("url")) } }
                            }
                            PrimaryButton(tr("进入 JobPilot", "Entrer dans JobPilot", "Enter JobPilot")) { vm.completeV1FirstRun() }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FirstRunOfferCard(offer: JSONObject, onClick: () -> Unit) {
    val deep = offer.child("deepMatch")
    val fast = offer.child("fastMatch")
    val score = if (deep.has("currentScore")) deep.optInt("currentScore") else fast.optInt("score", -1)
    val strengths = if (deep.objects("strengths").isNotEmpty()) deep.objects("strengths").map { it.text("title") } else fast.objects("strengths").map { it.text("title") }
    val gaps = if (deep.objects("capabilityGaps").isNotEmpty()) deep.objects("capabilityGaps").map { it.text("title") } else fast.objects("gaps").map { it.text("title") }
    val potential = deep.optInt("cvPotentialScore", score).coerceAtLeast(score)
    Surface(onClick = onClick, modifier = Modifier.width(292.dp).heightIn(min = 330.dp), shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surface, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), shadowElevation = 3.dp) {
        Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(offer.text("company"), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Text(offer.text("title"), fontSize = 21.sp, lineHeight = 27.sp, fontWeight = FontWeight.SemiBold)
                }
                V1MatchBadge(score)
            }
            Hint(listOf(offer.text("location"), product(offer.text("contractType"))).filter { it.isNotBlank() && it != "unknown" }.joinToString(" · "))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                strengths.take(2).forEach { Pill("+ $it") }
            }
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                gaps.take(2).forEach { Pill("− $it", warm = true) }
            }
            if (potential > score && score >= 0) Hint(tr("简历表达优化空间：约 $potential/100", "Potentiel CV : ~$potential/100", "CV presentation potential: ~$potential/100"))
            Spacer(Modifier.height(4.dp))
            Text(tr("点开看为什么适合、哪里还差一点", "Ouvrez pour voir le match et les écarts", "Open to see why it fits and what is missing"), fontSize = 13.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
        }
    }
}
