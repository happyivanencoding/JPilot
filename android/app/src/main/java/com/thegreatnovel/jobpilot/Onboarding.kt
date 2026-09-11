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
    val context=LocalContext.current
    val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let { vm.upload(it) } }
    var languageChosen by rememberSaveable { mutableStateOf(false) }
    var invite by rememberSaveable { mutableStateOf("V1TEST") }
    var chosenQuery by rememberSaveable(state.profileId) { mutableStateOf("") }
    var customQuery by rememberSaveable(state.profileId) { mutableStateOf("") }
    var chooseAgain by rememberSaveable(state.profileId) { mutableStateOf(false) }
    val v1=state.snapshot.child("v1")
    val journey=v1.child("journey")
    val analysis=state.snapshot.child("analysis")
    val directions=v1.objects("careerDirections")
    val discovery=state.snapshot.child("discovery")
    val offers=discovery.objects("offers").take(4)
    val importFailed=v1.text("importState")=="failed"
    val stage=when {
        !state.loggedIn -> if(!languageChosen) 0 else 1
        state.working || state.loading || v1.text("importState") in setOf("queued","running","reconciling") -> 3
        importFailed || state.snapshot.text("cv").isBlank() -> 2
        !v1.optBoolean("analysisReady") -> 3
        chooseAgain || journey.text("query").isBlank() -> 4
        !v1.optBoolean("offersReady") -> 5
        else -> 6
    }
    val displayName=state.snapshot.child("profile").text("name")
    Surface(Modifier.fillMaxSize(),color=MaterialTheme.colorScheme.background) {
        AnimatedContent(targetState=stage,transitionSpec={fadeIn() togetherWith fadeOut()},label="first-steps") { page ->
            Column(Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp),verticalArrangement=Arrangement.spacedBy(18.dp)) {
                Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                    Surface(Modifier.size(42.dp),shape=RoundedCornerShape(10.dp),color=MaterialTheme.colorScheme.primary) { Box(contentAlignment=Alignment.Center) {Text("J",fontSize=23.sp,color=MaterialTheme.colorScheme.onPrimary,fontWeight=FontWeight.Bold)} }
                    Text("JobPilot",fontSize=22.sp,fontWeight=FontWeight.SemiBold)
                }
                Spacer(Modifier.height(12.dp))
                when(page) {
                    0 -> {
                        Text(tr("让你的下一步更清晰。","Votre prochaine étape, plus claire.","Make your next move clearer."),fontSize=30.sp,lineHeight=37.sp,fontWeight=FontWeight.SemiBold)
                        Hint(tr("你的优势，值得尝试的方向，还有下一份工作。","Vos forces, vos pistes et votre prochain poste.","Your strengths, your possibilities, your next role."))
                        Text(tr("选择语言","Choisissez votre langue","Choose your language"),fontWeight=FontWeight.SemiBold)
                        JourneyLanguageChoices(state.language) { vm.appearance(language=it) }
                        PrimaryButton(tr("开始","Commencer","Get started"),!state.working) { languageChosen=true }
                    }
                    1 -> {
                        Text(tr("找到属于你的机会","Trouvez votre prochaine opportunité","Find your next opportunity"),fontSize=29.sp,lineHeight=36.sp,fontWeight=FontWeight.SemiBold)
                        OutlinedTextField(invite,{invite=it},Modifier.fillMaxWidth(),label={Text(tr("邀请码","Code d’invitation","Invitation code"))},singleLine=true,shape=RoundedCornerShape(12.dp))
                        Hint(tr("预览账号 · 邀请码 V1TEST","Compte d’aperçu · code V1TEST","Preview account · code V1TEST"))
                        PrimaryButton(tr("使用 Google 继续（模拟）","Continuer avec Google (simulation)","Continue with Google (preview)"),!state.working&&invite.isNotBlank()) { vm.previewLogin(invite) }
                        TextButton({languageChosen=false}) {Text(tr("更换语言","Changer de langue","Change language"))}
                    }
                    2 -> {
                        Text(tr("从你的简历开始","Tout commence avec votre CV","It starts with your CV"),fontSize=29.sp,lineHeight=36.sp,fontWeight=FontWeight.SemiBold)
                        Hint(tr("看看你擅长什么，以及哪些工作值得一试。","Découvrez vos atouts et les postes à explorer.","See what you bring and which roles are worth exploring."))
                        Text(tr("简历语言","Langue du CV","CV language"),fontWeight=FontWeight.SemiBold)
                        JourneyLanguageChoices(state.cvLanguage,false) {vm.journeyLanguages(cvLanguage=it)}
                        Text(tr("我希望用这种语言看分析","Langue de mes conseils","My insights in"),fontWeight=FontWeight.SemiBold)
                        JourneyLanguageChoices(state.analysisLanguage) {vm.journeyLanguages(analysisLanguage=it)}
                        if(importFailed) Text(tr("这份文件暂时打不开，请换一份 PDF 或 Word。","Ce fichier ne s’ouvre pas. Essayez un autre PDF ou Word.","This file could not be opened. Try another PDF or Word file."),color=MaterialTheme.colorScheme.error)
                        PrimaryButton(tr("选择简历","Choisir mon CV","Choose my CV"),!state.working) {picker.launch(arrayOf("application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain","text/markdown"))}
                        Hint("PDF · Word · TXT · 12 MB")
                    }
                    3 -> {
                        if(!v1.optBoolean("presentationFailed")&&state.error==null) CircularProgressIndicator(Modifier.size(48.dp))
                        Text(tr("你的下一步，可以有哪些可能？","Quelles possibilités pour la suite ?","What could your next step look like?"),fontSize=29.sp,lineHeight=36.sp,fontWeight=FontWeight.SemiBold)
                        Hint(tr("即将为你呈现优势、提升空间和可探索的方向。","Vos atouts, vos pistes de progrès et des directions à explorer.","Your strengths, room to grow and directions to explore."))
                        if(v1.optBoolean("presentationFailed")) PrimaryButton(tr("再试一次","Réessayer","Try again"),!state.working) {vm.retryV1()}
                    }
                    4 -> {
                        Text(if(displayName.isBlank()) tr("这是你会闪光的地方。","Voici vos atouts.","Here is where you stand out.") else tr("你好，$displayName。","Bonjour $displayName.","Hi, $displayName."),fontSize=29.sp,lineHeight=36.sp,fontWeight=FontWeight.SemiBold)
                        analysis.objects("strengths").take(3).forEach { strength ->
                            Surface(shape=RoundedCornerShape(12.dp),color=MaterialTheme.colorScheme.surface) { Column(Modifier.fillMaxWidth().padding(16.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {Text(strength.text("title"),fontWeight=FontWeight.SemiBold);Hint(strength.text("evidence"))} }
                        }
                        analysis.objects("growthAreas").take(1).forEach { gap -> Text(gap.text("nextAction"),fontSize=15.sp,lineHeight=23.sp) }
                        Text(tr("你想先看看哪个方向？","Quelle piste vous attire ?","Which direction interests you?"),fontSize=21.sp,fontWeight=FontWeight.SemiBold)
                        directions.forEach { direction ->
                            val query=direction.text("searchQuery")
                            FilterChip(selected=chosenQuery==query&&customQuery.isBlank(),onClick={chosenQuery=query;customQuery=""},label={Text(direction.text("title"))})
                        }
                        OutlinedTextField(customQuery,{customQuery=it},Modifier.fillMaxWidth(),label={Text(tr("我有其他想法","J’ai une autre idée","I have something else in mind"))},shape=RoundedCornerShape(12.dp))
                        PrimaryButton(tr("看看这些工作","Voir les offres","Show me the roles"),(customQuery.trim().ifBlank {chosenQuery}).isNotBlank()&&!state.working) {
                            val query=customQuery.trim().ifBlank {chosenQuery};chooseAgain=false
                            vm.startTask(json("kind" to "search","query" to query,"silent" to true,"source" to "v1-onboarding"))
                        }
                    }
                    5 -> {
                        val empty=v1.text("searchState")=="completed"&&discovery.optInt("availableCount")==0
                        AiProgressButton(state,"search",label=tr("搜索这个方向","Rechercher cette direction","Search this direction")){vm.retryV1()}
                        Text(if(empty)tr("这个方向暂时没有合适的岗位","Pas encore d’offre adaptée à cette piste","No suitable roles for this direction yet") else tr("为你挑选值得一试的工作","Une sélection qui vous correspond","Finding roles worth your time"),fontSize=29.sp,lineHeight=36.sp,fontWeight=FontWeight.SemiBold)
                        if(!empty) Hint(tr("每份工作都会带上匹配分、你的优势和提升建议。","Chaque offre avec son match, vos atouts et vos prochaines actions.","Each role comes with your match, strengths and ways to improve."))
                        if(v1.optBoolean("presentationFailed")) PrimaryButton(tr("再试一次","Réessayer","Try again"),!state.working) {vm.retryV1()}
                        TextButton({chooseAgain=true}) {Text(tr("换个方向看看","Explorer une autre piste","Explore another direction"))}
                        if(empty) TextButton({vm.completeV1FirstRun()}) {Text(tr("先进入首页","Aller à l’accueil","Go to Home"))}
                    }
                    else -> {
                        Text(tr("这几份工作，值得你看看。","Ces offres méritent votre attention.","These roles are worth a look."),fontSize=29.sp,lineHeight=36.sp,fontWeight=FontWeight.SemiBold)
                        LazyRow(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp),contentPadding=PaddingValues(end=24.dp)) {
                            items(offers,key={it.text("url")}) {offer->FirstRunOfferCard(offer) {vm.completeV1FirstRun();vm.selectOffer(offer.text("url"))}}
                        }
                        PrimaryButton(tr("继续探索","Continuer à explorer","Keep exploring")) {vm.completeV1FirstRun()}
                    }
                }
                state.error?.let {message->Text(message,color=MaterialTheme.colorScheme.error,fontSize=14.sp);if(page==3) TextButton({vm.retryV1()}) {Text(tr("重试","Réessayer","Retry"))}}
                if(state.loggedIn) TextButton({languageChosen=false;vm.logout()},enabled=!state.working) {Text(tr("登出","Se déconnecter","Sign out"))}
            }
        }
    }
}
@Composable private fun JourneyLanguageChoices(selected:String, chinese:Boolean=true, onSelect:(String)->Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
        (if(chinese) listOf("en" to "English","fr" to "Français","zh" to "中文") else listOf("en" to "English","fr" to "Français")).forEach {(code,label)->FilterChip(selected=selected==code,onClick={onSelect(code)},label={Text(label)})}
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
    Surface(onClick = onClick, modifier = Modifier.width(292.dp).heightIn(min = 330.dp), shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.surface, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), shadowElevation = 3.dp) {
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
            if (potential > score && score >= 0) Hint(tr("简历优化：$score → 预计 $potential/100", "CV : $score → ~$potential/100", "CV edits: $score → ~$potential/100"))
            Spacer(Modifier.height(4.dp))
            Text(tr("点开看为什么适合、哪里还差一点", "Ouvrez pour voir le match et les écarts", "Open to see why it fits and what is missing"), fontSize = 13.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
        }
    }
}
