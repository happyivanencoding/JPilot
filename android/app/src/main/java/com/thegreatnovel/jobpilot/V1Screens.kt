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
import androidx.compose.material.icons.rounded.OpenInNew
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

@Composable
fun V1OverviewScreen(state: PilotState, vm: JobPilotViewModel, onExplore: () -> Unit, onProfile: () -> Unit) {
    val hasCv = state.snapshot.text("cv").isNotBlank()
    val v1 = state.snapshot.child("v1")
    val directions = v1.objects("careerDirections")
    val offers = state.snapshot.child("discovery").objects("offers").take(3)
    val signals = state.snapshot.child("analysis").child("globalLayout").objects("signals")
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
        overscrollEffect = null,
    ) {
        item { SectionTitle(tr("这是你会闪光的地方。", "Voici où votre profil peut vraiment ressortir.", "Here is where you can stand out."), state.snapshot.child("profile").text("name")) }
        if (!hasCv) item {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(tr("上传一份简历，从真实岗位开始判断。", "Importez votre CV et comparez-le à de vraies offres.", "Upload your CV and compare it with real roles."), fontSize = 25.sp, lineHeight = 32.sp, fontWeight = FontWeight.SemiBold)
                Hint(tr("JobPilot 会先理解你的经历，再给出适合探索的职业方向和岗位。", "JobPilot comprend d’abord votre parcours, puis propose des directions et des offres à explorer.", "JobPilot first understands your experience, then suggests directions and roles to explore."))
                PrimaryButton(tr("上传我的简历", "Importer mon CV", "Upload my CV")) { onProfile() }
            }
        } else {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(tr("这些方向可能更适合你发力", "Des directions où votre profil peut ressortir", "Directions where your profile may stand out"), Modifier.weight(1f), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                        TextButton(onProfile) { Text(tr("调整", "Modifier", "Edit")) }
                    }
                    if (directions.isEmpty() && v1.optBoolean("backgroundActive")) {
                        LinearProgressIndicator(Modifier.fillMaxWidth())
                        Hint(tr("正在整理你的经历。", "Analyse de votre parcours…", "Reading your experience…"))
                    } else directions.take(5).forEach { direction ->
                        Surface(
                            onClick = onExplore,
                            shape = RoundedCornerShape(10.dp),
                            color = MaterialTheme.colorScheme.surface,
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                        ) {
                            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(direction.text("title"), Modifier.weight(1f), fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                                    Icon(Icons.Rounded.ArrowForward, null, Modifier.size(17.dp), tint = MaterialTheme.colorScheme.primary)
                                }
                                direction.strings("evidence").take(2).joinToString(" · ").takeIf { it.isNotBlank() }?.let { Hint(it) }
                            }
                        }
                    }
                }
            }
            if (offers.isNotEmpty()) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(tr("先试这几个真实岗位", "Essayez d’abord ces offres", "Try these real roles first"), Modifier.weight(1f), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                        TextButton(onExplore) { Text(tr("全部", "Tout voir", "See all")) }
                    }
                }
                items(offers, key = { it.text("url") }) { offer -> V1OfferCard(offer) { vm.selectOffer(offer.text("url")) } }
            }
            if (signals.isNotEmpty()) item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(tr("你的优势在哪", "Vos points forts", "Where your strengths are"), fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                    signals.take(4).forEach { signal -> GlassCard { Text(signal.text("title"), fontWeight = FontWeight.SemiBold); signal.text("evidence").takeIf { it.isNotBlank() }?.let { Hint(it) } } }
                }
            }
        }
    }
}

@Composable
fun V1ExploreScreen(state: PilotState, vm: JobPilotViewModel) {
    val v1 = state.snapshot.child("v1")
    val config = state.snapshot.child("config")
    val directions = v1.objects("careerDirections")
    val keywords = v1.strings("searchKeywords")
    val explicit = config.child("target_roles").strings("primary").firstOrNull().orEmpty()
    val suggested = explicit.ifBlank { directions.firstOrNull()?.text("searchQuery")?.ifBlank { directions.firstOrNull()?.text("title") }.orEmpty() }
        .ifBlank { keywords.take(3).joinToString(" ") }
        .ifBlank { tr("适合我当前经历的初级岗位", "postes junior adaptés à mon parcours", "junior roles suited to my experience") }
    var query by rememberSaveable(state.profileId) { mutableStateOf(suggested) }
    var priorSuggested by rememberSaveable(state.profileId) { mutableStateOf(suggested) }
    LaunchedEffect(suggested) { if (query == priorSuggested) query = suggested; priorSuggested = suggested }
    val searchState = v1.text("searchState")
    val searching = searchState in setOf("queued", "running", "reconciling")
    val discovery = state.snapshot.child("discovery")
    val offers = discovery.objects("offers").take(5)
    val history = discovery.objects("history")
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        overscrollEffect = null,
    ) {
        item { SectionTitle(tr("机会", "Opportunités", "Opportunities"), tr("先快速看分，再点开理解为什么。", "Un score immédiat, puis l’explication si vous ouvrez l’offre.", "See the score first, then open a role to understand why.")) }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), label = { Text(tr("我想看看什么工作", "Quel type de poste voulez-vous explorer ?", "What roles do you want to explore?")) }, singleLine = true, shape = RoundedCornerShape(10.dp))
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    (directions.map { it.text("title") } + keywords).filter { it.isNotBlank() }.distinct().take(8).forEach { item ->
                        FilterChip(selected = query == item, onClick = { query = item }, label = { Text(item, maxLines = 1) })
                    }
                }
                Hint(tr("你可以直接改关键词；明确写下的意图会优先于 AI 推断。", "Vous pouvez modifier les mots-clés ; votre intention explicite reste prioritaire.", "Edit the keywords freely; your explicit intent takes priority over AI inference."))
                PrimaryButton(if (searching) tr("正在找岗位…", "Recherche en cours…", "Finding roles…") else tr("搜索这个方向", "Rechercher cette direction", "Search this direction"), query.isNotBlank() && !searching) {
                    vm.startTask(json("kind" to "search", "query" to query, "silent" to true))
                }
            }
        }
        item { Row(verticalAlignment = Alignment.CenterVertically) { Text(tr("最值得先看的岗位", "À regarder en premier", "Best roles to inspect first"), Modifier.weight(1f), fontWeight = FontWeight.SemiBold); Hint(discovery.text("searchedAt").take(10)) } }
        if (offers.isEmpty()) item {
            EmptyCard(
                if (v1.optBoolean("backgroundActive")) tr("正在准备第一批岗位", "Premières offres en préparation", "Preparing your first roles") else tr("还没有岗位", "Aucune offre pour l’instant", "No roles yet"),
                tr("确认简历后 JobPilot 会自动准备第一批结果；你也可以在上方换一个方向。", "Après confirmation du CV, JobPilot prépare automatiquement une première sélection. Vous pouvez aussi changer de direction ci-dessus.", "After you confirm your CV, JobPilot prepares an initial set automatically. You can also change direction above."),
            )
        }
        items(offers, key = { it.text("url") }) { offer -> V1OfferCard(offer) { vm.selectOffer(offer.text("url")) } }
        if (history.isNotEmpty()) item {
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(tr("之前看过的方向", "Recherches précédentes", "Previously explored"), fontWeight = FontWeight.SemiBold)
                Hint(tr("换方向不会清掉这里的岗位", "Vos anciennes recherches restent ici", "Changing direction keeps these roles here"))
            }
        }
        history.forEach { group ->
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(group.text("query").ifBlank { tr("之前的搜索", "Recherche précédente", "Previous search") }, Modifier.weight(1f), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Hint(group.text("searchedAt").take(10))
                }
            }
            items(group.objects("offers"), key = { it.text("url") }) { offer -> V1OfferCard(offer) { vm.selectOffer(offer.text("url")) } }
        }
    }
}

@Composable
private fun V1OfferCard(offer: JSONObject, onClick: () -> Unit) {
    val deep = offer.child("deepMatch")
    val fast = offer.child("fastMatch")
    val score = if (deep.has("currentScore")) deep.optInt("currentScore") else fast.optInt("score", -1)
    val strengths = if (deep.objects("strengths").isNotEmpty()) deep.objects("strengths").map { it.text("title") } else fast.objects("strengths").map { it.text("title") }
    val gaps = if (deep.objects("capabilityGaps").isNotEmpty()) deep.objects("capabilityGaps").map { it.text("title") } else fast.objects("gaps").map { it.text("title") }
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().testTag("offer-${offer.text("url").hashCode()}"),
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(offer.text("company"), fontSize = 13.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                    Text(offer.text("title"), fontSize = 19.sp, lineHeight = 25.sp, fontWeight = FontWeight.SemiBold)
                }
                V1MatchBadge(score)
            }
            Hint(listOf(offer.text("location"), product(offer.text("contractType"))).filter { it.isNotBlank() && it != "unknown" }.joinToString(" · "))
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                strengths.take(2).forEach { Pill("+ $it") }
                gaps.take(2).forEach { Pill("− $it", warm = true) }
            }
            val potential = deep.optInt("cvPotentialScore", score)
            Hint(when {
                offer.text("deepMatchState") == "loading" -> tr("正在补充岗位匹配…", "Match détaillé en cours…", "Adding detailed match…")
                potential > score && score >= 0 -> tr("简历表达优化空间：约 $potential/100", "Potentiel CV : ~$potential/100", "CV presentation potential: ~$potential/100")
                else -> tr("点开看详细匹配", "Ouvrez pour voir le match détaillé", "Open for the detailed match")
            })
        }
    }
}

@Composable
fun V1MatchBadge(score: Int) {
    Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.primaryContainer) {
        Column(Modifier.padding(horizontal = 9.dp, vertical = 7.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (score >= 0) score.toString() else "—", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text("/100", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun V1OfferDetailSheet(offer: JSONObject, state: PilotState, vm: JobPilotViewModel) {
    val context = LocalContext.current
    val deep = offer.child("deepMatch")
    val fast = offer.child("fastMatch")
    val current = if (deep.has("currentScore")) deep.optInt("currentScore") else fast.optInt("score", -1)
    val cvPotential = deep.optInt("cvPotentialScore", current).coerceAtLeast(current)
    val capabilityPotential = deep.optInt("capabilityPotentialScore", cvPotential).coerceAtLeast(cvPotential)
    val savedJob = state.snapshot.objects("jobs").find { it.text("url") == offer.text("url") }
    val cvActive = savedJob?.let { job -> state.snapshot.objects("tasks").any { it.text("kind") == "cv" && it.text("jobId") == job.text("id") && it.text("status") in setOf("queued", "running", "reconciling") } } == true
    val strengths = if (deep.objects("strengths").isNotEmpty()) deep.objects("strengths") else fast.objects("strengths")
    val capabilityGaps = if (deep.objects("capabilityGaps").isNotEmpty()) deep.objects("capabilityGaps") else fast.objects("gaps")
    ModalBottomSheet(onDismissRequest = { vm.selectOffer(null) }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        LazyColumn(
            Modifier.fillMaxWidth().fillMaxHeight(.94f).blockSheetEdgeMotion().testTag("v1-offer-detail"),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            overscrollEffect = null,
        ) {
            item {
                Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) { Text(offer.text("company"), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold); Text(offer.text("title"), fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold); Hint(listOf(offer.text("location"), product(offer.text("contractType"))).filter { it.isNotBlank() && it != "unknown" }.joinToString(" · ")) }
                    V1MatchBadge(current)
                }
            }
            item { GlassCard { Text(tr("你现在离这个岗位多远？", "Où en êtes-vous pour ce poste ?", "How close are you to this role?"), fontSize = 18.sp, fontWeight = FontWeight.SemiBold); V1PotentialRow(current, cvPotential, capabilityPotential); Hint(tr("后两个分数是近似潜力，不是录用概率；CV 优化不会假装你掌握了不存在的技能。", "Les deux scores suivants sont un potentiel indicatif, pas une probabilité d’embauche. Le CV n’invente aucune compétence.", "The next two scores are approximate potential, not hiring probability. CV changes never invent skills.")) } }
            item { GlassCard { Text(tr("这个岗位到底做什么？", "Que fait-on concrètement dans ce poste ?", "What does this role actually do?"), fontSize = 18.sp, fontWeight = FontWeight.SemiBold); Text(deep.text("roleSummary").ifBlank { offer.text("why") }, fontSize = 14.sp, lineHeight = 21.sp); if (offer.text("deepMatchState") == "loading") Hint(tr("正在后台补充更具体的职责和要求，你可以继续看。", "Les responsabilités détaillées arrivent en arrière-plan.", "Detailed responsibilities are being added in the background.")); deep.strings("responsibilities").forEach { Text("• $it", fontSize = 14.sp, lineHeight = 21.sp) } } }
            if (strengths.isNotEmpty()) item { GlassCard { Text(tr("你的加分点", "Vos points forts", "Your strengths"), fontSize = 18.sp, fontWeight = FontWeight.SemiBold); strengths.take(5).forEach { item -> Text("+ ${item.text("title")}", fontWeight = FontWeight.SemiBold); Hint(item.text("evidence")) } } }
            if (deep.objects("presentationGaps").isNotEmpty()) item { GlassCard { Text(tr("只是没有写清楚的部分", "Ce que votre CV montre mal", "What your CV underplays"), fontSize = 18.sp, fontWeight = FontWeight.SemiBold); deep.objects("presentationGaps").take(5).forEach { item -> Text("+${item.optInt("potential")} · ${item.text("title")}", fontWeight = FontWeight.SemiBold); Text(item.text("why"), fontSize = 14.sp, lineHeight = 21.sp) }; deep.text("cvPotentialReason").takeIf { it.isNotBlank() }?.let { Hint(it) } } }
            if (capabilityGaps.isNotEmpty()) item { GlassCard { Text(tr("需要真的补齐的能力", "Ce qu’il faut réellement acquérir", "What you actually need to build"), fontSize = 18.sp, fontWeight = FontWeight.SemiBold); capabilityGaps.take(6).forEach { item -> Text("− ${item.text("title")}", fontWeight = FontWeight.SemiBold); Text(item.text("why", item.text("reason")), fontSize = 14.sp, lineHeight = 21.sp); item.text("nextAction").takeIf { it.isNotBlank() }?.let { Hint(it) } } } }
            if (deep.objects("requirements").isNotEmpty()) item { GlassCard { Text(tr("岗位要求", "Exigences du poste", "Role requirements"), fontSize = 18.sp, fontWeight = FontWeight.SemiBold); deep.objects("requirements").take(7).forEach { item -> Row { Text(item.text("title"), Modifier.weight(1f), fontWeight = FontWeight.SemiBold); Pill(if (item.text("kind") == "must") tr("核心", "Essentiel", "Core") else tr("加分", "Bonus", "Nice to have")) }; Text(item.text("why"), fontSize = 13.sp, lineHeight = 20.sp) }; if (deep.strings("tools").isNotEmpty()) Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) { deep.strings("tools").forEach { Pill(it) } } } }
            item { TextButton({ runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(offer.text("url")))) } }, contentPadding = PaddingValues(0.dp)) { Text(tr("打开原始职位页", "Ouvrir l’annonce officielle", "Open original posting")); Icon(Icons.Rounded.OpenInNew, null, Modifier.padding(start = 6.dp).size(15.dp)) } }
            item {
                val hasVersion = savedJob?.child("cvDraft")?.text("id")?.isNotBlank() == true || savedJob?.child("cv")?.text("file")?.isNotBlank() == true
                val label = when {
                    hasVersion -> tr("查看我的岗位版本", "Voir ma version ciblée", "View my role version")
                    cvActive -> tr("正在准备，可以继续浏览", "Préparation en cours · continuez à naviguer", "Preparing · keep browsing")
                    cvPotential > current -> tr("查看我的 $cvPotential 分版本", "Voir ma version ~$cvPotential/100", "See my ~$cvPotential/100 version")
                    else -> tr("看看这份岗位版简历", "Voir mon CV adapté à ce poste", "See my tailored CV for this role")
                }
                Button(
                    onClick = { if (hasVersion && savedJob != null) { vm.selectOffer(null); vm.selectJob(savedJob.text("id"), 1) } else vm.tailorOffer(offer) },
                    modifier = Modifier.fillMaxWidth().testTag("tailor-offer"),
                    enabled = !state.working && !cvActive,
                ) { Text(label) }
                Hint(tr("只有点击这里，JobPilot 才会把这条岗位加入“我的”并生成独立版本；浏览本身不会创建投递记录。", "Cette action seule enregistre l’offre dans « Moi » et crée une version indépendante ; consulter l’offre ne crée aucune candidature.", "Only this action adds the role to My and creates an independent CV version; browsing alone never creates an application record."))
            }
            item { Spacer(Modifier.navigationBarsPadding()) }
        }
    }
}

@Composable
private fun V1PotentialRow(current: Int, cvPotential: Int, capabilityPotential: Int) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        V1PotentialCell(tr("现在", "Maintenant", "Now"), current, Modifier.weight(1f)); Text("→", color = MaterialTheme.colorScheme.onSurfaceVariant)
        V1PotentialCell(tr("只优化 CV", "CV mieux présenté", "Better CV"), cvPotential, Modifier.weight(1f)); Text("→", color = MaterialTheme.colorScheme.onSurfaceVariant)
        V1PotentialCell(tr("补真实能力", "Compétences", "Build skills"), capabilityPotential, Modifier.weight(1f))
    }
}

@Composable
private fun V1PotentialCell(label: String, score: Int, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) { Text(label, fontSize = 10.sp, lineHeight = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant); Text(if (score >= 0) score.toString() else "—", fontSize = 23.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun V1SavedJobDetailSheet(job: JSONObject, state: PilotState, vm: JobPilotViewModel) {
    val context = LocalContext.current
    var tab by rememberSaveable(job.text("id"), state.selectedJobTab) { mutableIntStateOf(state.selectedJobTab.coerceIn(0, 2)) }
    val match = job.child("v1Match")
    val deep = match.child("deepMatch")
    val current = match.optInt("currentScore", match.optInt("displayScore", -1))
    val display = match.optInt("displayScore", current)
    val cvPotential = match.optInt("cvPotentialScore", current).coerceAtLeast(current)
    val capabilityPotential = match.optInt("capabilityPotentialScore", cvPotential).coerceAtLeast(cvPotential)
    var status by rememberSaveable(job.text("id")) { mutableStateOf(job.text("status")) }
    var statusMenu by remember { mutableStateOf(false) }
    var nextAction by rememberSaveable(job.text("id")) { mutableStateOf(job.child("followup").text("nextAction")) }
    var date by rememberSaveable(job.text("id")) { mutableStateOf(job.child("followup").text("dueDate")) }
    var note by rememberSaveable(job.text("id")) { mutableStateOf(job.child("followup").text("note")) }
    ModalBottomSheet(onDismissRequest = { vm.selectJob(null) }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), modifier = Modifier.imePadding()) {
        Column(Modifier.fillMaxWidth().fillMaxHeight(.92f).blockSheetEdgeMotion().testTag("v1-saved-job-detail")) {
            Row(Modifier.padding(horizontal = 22.dp, vertical = 8.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(job.text("company"), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                    Text(job.text("role"), fontSize = 21.sp, lineHeight = 27.sp, fontWeight = FontWeight.SemiBold, maxLines = 3)
                }
                if (display >= 0) V1MatchBadge(display)
            }
            val labels = listOf(tr("匹配", "Match", "Fit"), "CV", tr("跟踪", "Suivi", "Tracking"))
            TabRow(tab, containerColor = androidx.compose.ui.graphics.Color.Transparent) {
                labels.forEachIndexed { index, label -> Tab(tab == index, { tab = index }, modifier = Modifier.testTag("job-tab-$index"), text = { Text(label, fontSize = 13.sp) }) }
            }
            LazyColumn(Modifier.weight(1f).fillMaxWidth().testTag("job-content"), contentPadding = PaddingValues(22.dp), verticalArrangement = Arrangement.spacedBy(16.dp), overscrollEffect = null) {
                item { LocalizationNotice(job.child("localization"), vm::retryLocalization) }
                when (tab) {
                    0 -> {
                        if (current >= 0) item {
                            GlassCard {
                                Text(tr("这个岗位与你的距离", "Votre distance à ce poste", "Your distance from this role"), fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                                V1PotentialRow(current, cvPotential, capabilityPotential)
                                if (display > current) Hint(tr("你已采用岗位版 CV，当前展示分已包含真实的呈现改善。", "Votre score affiché inclut déjà l’amélioration du CV adopté.", "Your displayed score already includes the presentation gain from the accepted role CV."))
                                Hint(tr("0–100 用于探索和行动规划，不是录用概率。", "Le score 0–100 sert à explorer et planifier, pas à prédire une embauche.", "The 0–100 score is for exploration and planning, not hiring probability."))
                            }
                        }
                        item { TextButton({ runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(job.text("url")))) } }) { Icon(Icons.Rounded.OpenInNew, null, Modifier.size(17.dp)); Spacer(Modifier.width(7.dp)); Text(tr("打开原始职位页", "Ouvrir l’annonce officielle", "Open original posting")) } }
                        if (deep.text("roleSummary").isNotBlank()) item { GlassCard { Text(tr("这个岗位做什么", "Ce que fait ce poste", "What this role does"), fontWeight = FontWeight.SemiBold, fontSize = 18.sp); Text(deep.text("roleSummary"), fontSize = 14.sp, lineHeight = 21.sp); deep.strings("responsibilities").take(6).forEach { Text("• $it", fontSize = 14.sp, lineHeight = 21.sp) } } }
                        val strengths = deep.objects("strengths")
                        if (strengths.isNotEmpty()) item { GlassCard { Text(tr("你的加分点", "Vos points forts", "Your strengths"), fontWeight = FontWeight.SemiBold, fontSize = 18.sp); strengths.take(6).forEach { item -> Text("+ ${item.text("title")}", fontWeight = FontWeight.SemiBold); Hint(item.text("evidence")) } } }
                        val presentation = deep.objects("presentationGaps")
                        if (presentation.isNotEmpty()) item { GlassCard { Text(tr("可以通过简历表达改善", "À améliorer dans la présentation du CV", "Can improve through CV presentation"), fontWeight = FontWeight.SemiBold, fontSize = 18.sp); presentation.take(6).forEach { item -> Text("+${item.optInt("potential")} · ${item.text("title")}", fontWeight = FontWeight.SemiBold); Text(item.text("why"), fontSize = 14.sp, lineHeight = 21.sp) } } }
                        val gaps = deep.objects("capabilityGaps")
                        if (gaps.isNotEmpty()) item { GlassCard { Text(tr("需要真的补齐的能力", "Ce qu’il faut réellement acquérir", "What you actually need to build"), fontWeight = FontWeight.SemiBold, fontSize = 18.sp); gaps.take(7).forEach { item -> Text("− ${item.text("title")}", fontWeight = FontWeight.SemiBold); Text(item.text("why"), fontSize = 14.sp, lineHeight = 21.sp); item.text("nextAction").takeIf(String::isNotBlank)?.let { Hint(it) } } } }
                        if (deep.length() == 0 && job.text("summary").isNotBlank()) item { GlassCard { Text(tr("历史岗位判断", "Lecture historique du poste", "Historical role assessment"), fontWeight = FontWeight.SemiBold); Markdown(job.text("summary")) } }
                        if (job.text("reportNum").isNotBlank()) item { TextButton({ vm.openReport(job) }) { Text(tr("查看历史正式报告", "Lire le rapport historique", "Read historical formal report")) } }
                    }
                    1 -> {
                        val cv = job.child("cv")
                        val draft = job.child("cvDraft")
                        val pending = draft.text("status") == "pending"
                        val masterId = state.snapshot.child("cvState").text("versionId")
                        item {
                            GlassCard {
                                Text(tr("这个岗位的独立简历版本", "Votre version de CV pour cette offre", "Your independent CV version for this role"), fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                                Hint(tr("每次都从当前 Master Profile / 主简历的已确认事实生成，不会拿其他岗位的定制 CV 当输入。", "Chaque version repart des faits confirmés du Master Profile ; aucun CV ciblé précédent n’est utilisé comme source.", "Every version starts from confirmed Master Profile facts; another tailored CV is never used as its source."))
                                if (cv.text("file").isNotBlank()) OutlinedButton({ vm.openCvPreview(job = job) }, Modifier.fillMaxWidth()) { Text(tr("查看已保留的岗位版 CV", "Voir le CV ciblé conservé", "View saved role CV")) }
                                if (!pending && cv.text("inputVersionId").isNotBlank() && cv.text("inputVersionId") != masterId) {
                                    Hint(tr("你的 Master CV 已更新。这个岗位版本仍保留旧事实版本；需要时可从最新 Master 重新生成。", "Votre Master CV a changé. Cette version conserve son ancienne base ; vous pouvez en générer une nouvelle depuis le Master actuel.", "Your Master CV changed. This role version keeps its old base; generate a new one from the current Master when needed."))
                                    OutlinedButton({ vm.startTask(json("kind" to "cv", "jobId" to job.text("id"), "retry" to true)) }, Modifier.fillMaxWidth()) { Text(tr("从最新 Master 生成新版本", "Créer depuis le Master actuel", "Generate from latest Master")) }
                                }
                            }
                        }
                        if (draft.length() > 0) item { TailoredCvDraftCard(job, state, vm) }
                    }
                    else -> item {
                        GlassCard {
                            Text(tr("投递状态", "Statut de candidature", "Application status"), fontWeight = FontWeight.SemiBold)
                            Box {
                                OutlinedButton({ statusMenu = true }, Modifier.fillMaxWidth()) { Text(product(status), Modifier.weight(1f)); Icon(Icons.Rounded.ExpandMore, null) }
                                DropdownMenu(statusMenu, { statusMenu = false }) { state.snapshot.strings("statuses").forEach { value -> DropdownMenuItem(text = { Text(product(value)) }, onClick = { status = value; statusMenu = false }) } }
                            }
                            OutlinedTextField(nextAction, { nextAction = it }, Modifier.fillMaxWidth(), label = { Text(tr("下一步行动", "Prochaine action", "Next action")) }, shape = RoundedCornerShape(14.dp))
                            DateField(date, { date = it }, tr("跟进日期", "Date de relance", "Follow-up date"))
                            OutlinedTextField(note, { note = it }, Modifier.fillMaxWidth(), label = { Text(tr("我的备注", "Mes notes", "My notes")) }, minLines = 3, shape = RoundedCornerShape(14.dp))
                            PrimaryButton(tr("保存跟踪状态", "Enregistrer le suivi", "Save tracking"), !state.working) { vm.updateJob(job.text("id"), json("status" to status, "nextAction" to nextAction, "dueDate" to date, "note" to note)) }
                        }
                    }
                }
                item { Spacer(Modifier.navigationBarsPadding()) }
            }
        }
    }
}
