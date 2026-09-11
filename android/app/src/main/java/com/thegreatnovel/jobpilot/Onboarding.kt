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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.PersonOutline
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.*
import androidx.compose.runtime.key
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import org.json.JSONObject
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

private data class GuideTab(val icon: ImageVector, val title: String, val summary: String, val details: List<String>)

@Composable private fun guideTabs(): List<GuideTab> = listOf(
    GuideTab(Icons.Rounded.Home, tr("首页", "Accueil", "Home"), tr("先看你适合什么，而不是先学会操作软件。", "Commencez par comprendre où votre profil peut aller.", "Start by seeing where your profile can go."), listOf(
        tr("确认简历后，Onward 会自动理解你的经历并给出 3–5 个可探索方向。", "Après confirmation du CV, Onward comprend votre parcours et propose 3–5 directions à explorer.", "After you confirm your CV, Onward understands your experience and suggests 3–5 directions."),
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
        Surface(Modifier.fillMaxSize().safeDrawingPadding().padding(20.dp), shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.background, border=BorderStroke(.6.dp,MaterialTheme.colorScheme.outlineVariant), tonalElevation = 0.dp) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (welcome) {
                    OnwardBrand(large=true)
                    Text(tr("欢迎使用 Onward", "Bienvenue dans Onward", "Welcome to Onward"), style=MaterialTheme.typography.headlineMedium)
                    Text(tr("用几步了解你的求职工作台。", "Découvrez votre espace de recherche en quelques étapes.", "Learn your job-search workspace in a few steps."), style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(vertical = 6.dp)) {
                        tabs.forEach { item -> Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
                            Surface(Modifier.size(38.dp), shape = RoundedCornerShape(7.dp), color = MaterialTheme.colorScheme.primaryContainer) { Box(contentAlignment = Alignment.Center) { Icon(item.icon, item.title, tint = MaterialTheme.colorScheme.primary) } }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) { Text(item.title, fontWeight = FontWeight.SemiBold); Hint(item.summary) }
                        } }
                    }
                    PrimaryButton(tr("开始使用", "Commencer", "Get started"), onClick = onDismiss)
                    TextButton(onClick = onSkip, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text(tr("跳过引导", "Passer le guide", "Skip guide")) }
                } else if (selected != null) {
                    Surface(Modifier.size(54.dp), shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.primaryContainer) { Box(contentAlignment = Alignment.Center) { Icon(selected.icon, selected.title, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp)) } }
                    Text(tr("第一次查看这个 Tab", "Première découverte de cet onglet", "First look at this tab"), color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Text(selected.title, style=MaterialTheme.typography.headlineMedium)
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
    var contracts by rememberSaveable(state.profileId) { mutableStateOf(state.snapshot.child("config").child("target_roles").strings("contract_types")) }
    var areaScope by rememberSaveable(state.profileId) {mutableStateOf("city")}
    var city by rememberSaveable(state.profileId) {mutableStateOf("Paris")}
    val areaValid=areaScope=="france"||city.isNotBlank()
    val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let { vm.upload(it, contracts,json("scope" to areaScope,"city" to city)) } }
    var showPrivacy by remember { mutableStateOf(false) }
    if(showPrivacy) CvPrivacyDialog(vm,state,{showPrivacy=false},if(contracts.isNotEmpty()&&areaValid)({picker.launch(arrayOf("application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain","text/markdown"))})else null)
    var showLanguageSettings by rememberSaveable {mutableStateOf(false)}
    var languageChosen by rememberSaveable { mutableStateOf(true) }
    var email by rememberSaveable(state.loggedIn) { mutableStateOf("") }
    val focus=LocalFocusManager.current
    val validEmail=android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches()
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
    val targetStage=when {
        !state.loggedIn -> if(!languageChosen) 0 else 1
        (state.working || state.loading) && !state.snapshot.has("cv") || v1.text("importState") in setOf("queued","running","reconciling") -> 3
        importFailed || state.snapshot.text("cv").isBlank() -> 2
        !v1.optBoolean("analysisReady") -> 3
        chooseAgain || journey.text("query").isBlank() -> 4
        !v1.optBoolean("offersReady") -> 5
        else -> 6
    }
    var stage by remember(state.profileId) { mutableStateOf(targetStage) }
    LaunchedEffect(targetStage) {
        if((stage==3 && targetStage==4 && v1.optBoolean("analysisReady")) || (stage==5 && targetStage==6 && v1.optBoolean("offersReady"))) delay(650)
        stage=targetStage
    }
    LaunchedEffect(stage) {vm.analytics.navigate(when(stage){0,1->"login";2->"upload";3->"analysis_wait";4->"directions";5->"search_wait";else->"first_results"},if(stage==6)"view_jobs" else null)}
    val journeyScroll=rememberScrollState()
    LaunchedEffect(journeyScroll) {snapshotFlow {if(journeyScroll.maxValue>0)journeyScroll.value*100/journeyScroll.maxValue else 0}.collect {vm.analytics.scroll(it)}}
    val progress=if(stage==5) v1.child("searchProgress") else v1.child("cvProgress")
    val cvFailed=progress.text("status")=="failed" || (!v1.optBoolean("analysisReady") && v1.optBoolean("presentationFailed"))
    val waveFailed=if(stage==5) progress.text("status")=="failed" || v1.optBoolean("presentationFailed") else cvFailed
    val waterLevel=if(stage==3 || stage==5) key(stage) { rememberCvWaterLevel(progress,waveFailed||state.error!=null) } else 0f
    val displayName=state.snapshot.child("profile").text("name")
    Surface(Modifier.fillMaxSize(),color=MaterialTheme.colorScheme.background) {
        Box(Modifier.fillMaxSize()) {
        if(stage==3 || stage==5) CvAnalysisWater(waterLevel,waveFailed||state.error!=null||progress.text("status")=="completed")
        AnimatedContent(targetState=stage,transitionSpec={fadeIn() togetherWith fadeOut()},label="first-steps") { page ->
            Column(Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(journeyScroll).padding(24.dp),verticalArrangement=Arrangement.spacedBy(18.dp)) {
                Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                    OnwardBrand(large=true)
                }
                Spacer(Modifier.height(12.dp))
                when(page) {
                    0 -> {
                        EditorialTitle(tr("让你的下一步更清晰。","Votre prochaine étape, plus claire.","Make your next move clearer."),large=true)
                        Hint(tr("你的优势，值得尝试的方向，还有下一份工作。","Vos forces, vos pistes et votre prochain poste.","Your strengths, your possibilities, your next role."))
                        Text(tr("选择语言","Choisissez votre langue","Choose your language"),fontWeight=FontWeight.SemiBold)
                        JourneyLanguageChoices(state.language) { vm.appearance(language=it) }
                        PrimaryButton(tr("开始","Commencer","Get started"),!state.working) { languageChosen=true }
                    }
                    1 -> {
                        EditorialTitle(tr("找到属于你的机会","Trouvez votre prochaine opportunité","Find your next opportunity"),large=true)
                        Hint(tr("输入邮箱，开始探索或回到你的空间。","Votre e-mail pour commencer ou retrouver votre espace.","Enter your email to begin or return to your space."))
                        OutlinedTextField(email,{email=it},Modifier.fillMaxWidth(),label={Text(tr("邮箱","E-mail","Email"))},placeholder={Text("name@example.com")},singleLine=true,shape=RoundedCornerShape(7.dp),keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Email,imeAction=ImeAction.Done),keyboardActions=KeyboardActions(onDone={if(validEmail&&!state.working){focus.clearFocus();vm.previewLogin(email.trim())}}))
                        PrimaryButton(tr("继续","Continuer","Continue"),!state.working&&validEmail) { focus.clearFocus();vm.previewLogin(email.trim()) }
                        Hint(tr("V1 测试入口 · 暂不验证邮箱，请使用测试简历。","Accès test V1 · e-mail non vérifié, CV de test uniquement.","V1 test access · email is not verified; use test CVs."))
                        TextButton({languageChosen=false}) {Text(tr("更换语言","Changer de langue","Change language"))}
                    }
                    2 -> {
                        EditorialTitle(tr("你的下一章，从这里开始。","Votre prochain chapitre commence ici.","Your next chapter starts here."),large=true)
                        Hint(tr("上传简历，让 Onward 从你的真实经历出发找到与你匹配的机会。","Importez votre CV et laissez Onward trouver des opportunités en accord avec votre profil et vos ambitions.","Upload your CV and let Onward find opportunities aligned with your experience and ambitions."))
                        Text(tr("你想找哪类机会？","Quel type d’opportunité ?","What are you looking for?"),fontWeight=FontWeight.SemiBold)
                        listOf("Stage","Alternance","CDI","CDD").chunked(2).forEach { row ->
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                                row.forEach { type -> FilterChip(selected=type in contracts,onClick={contracts=if(type in contracts)contracts-type else contracts+type},modifier=Modifier.weight(1f),label={Text(product(type))}) }
                            }
                        }
                        if(contracts.isEmpty()) Hint(tr("至少选择一项，可以多选。","Choisissez au moins une option, plusieurs sont possibles.","Select at least one. You can choose several."))
                        SearchAreaFields(areaScope,city,{areaScope=it},{city=it})
                        TextButton({showLanguageSettings=!showLanguageSettings}) {Text(tr("语言设置","Langues","Language settings"))}
                        if(showLanguageSettings) {
                            Hint(tr("原简历语言自动识别","Langue du CV original détectée automatiquement","Original CV language detected automatically"))
                            Text(tr("求职简历语言","Langue du CV de candidature","Application CV language"),fontWeight=FontWeight.SemiBold)
                            JourneyLanguageChoices(state.cvLanguage,false) {vm.journeyLanguages(cvLanguage=it)}
                            Hint(tr("分析、岗位详情和公司信息跟随界面语言。","Les analyses, les offres et les informations sur les entreprises suivent la langue de l’application.","Analysis, role details and company information follow the app language."))
                        }
                        if(importFailed) Text(tr("这份文件暂时打不开，请换一份 PDF 或 Word。","Ce fichier ne s’ouvre pas. Essayez un autre PDF ou Word.","This file could not be opened. Try another PDF or Word file."),color=MaterialTheme.colorScheme.error)
                        Surface(
                            Modifier.fillMaxWidth(),
                            shape=RoundedCornerShape(8.dp),
                            color=MaterialTheme.colorScheme.surface.copy(alpha=.54f),
                            border=BorderStroke(.8.dp,MaterialTheme.colorScheme.outlineVariant),
                            tonalElevation=0.dp,
                        ) {
                            Column(Modifier.fillMaxWidth().padding(18.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(5.dp)) {
                                Surface(shape=androidx.compose.foundation.shape.CircleShape,color=MaterialTheme.colorScheme.primaryContainer) {
                                    Box(Modifier.size(58.dp),contentAlignment=Alignment.Center) {Icon(Icons.Rounded.Description,null,Modifier.size(23.dp),tint=MaterialTheme.colorScheme.primary)}
                                }
                                Text(tr("把 CV 放在这里","Déposez votre CV ici","Drop your CV here"),style=MaterialTheme.typography.titleMedium)
                                Hint(tr("或从你的文件中选择","ou choisissez-le dans vos fichiers","or choose it from your files"))
                                PrimaryButton(tr("选择文件","Choisir un fichier","Choose a file"),!state.working&&contracts.isNotEmpty()) {showPrivacy=true}
                                Hint("PDF · Word · TXT · 12 MB")
                            }
                        }
                        Surface(
                            onClick={showPrivacy=true},
                            modifier=Modifier.fillMaxWidth(),
                            shape=RoundedCornerShape(8.dp),
                            color=MaterialTheme.colorScheme.primaryContainer.copy(alpha=.48f),
                            tonalElevation=0.dp,
                        ) {
                            Row(Modifier.padding(13.dp),horizontalArrangement=Arrangement.spacedBy(10.dp),verticalAlignment=Alignment.Top) {
                                Icon(Icons.Rounded.Lock,null,Modifier.size(18.dp),tint=MaterialTheme.colorScheme.primary)
                                Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(2.dp)) {
                                    Text(tr("你的数据会受到保护","Vos données sont sécurisées","Your data is protected"),style=MaterialTheme.typography.labelLarge,color=MaterialTheme.colorScheme.primary)
                                    Text(tr("CV 只用于为当前档案提供匹配与建议。","Votre CV est utilisé uniquement pour les correspondances et conseils de ce profil.","Your CV is used only to provide matches and guidance for this profile."),style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    3 -> {
                        EditorialTitle(tr("你的下一步，可以有哪些可能？","Quelles possibilités pour la suite ?","What could your next step look like?"),large=true)
                        if(cvFailed) {
                            Text(progress.child("failure").text("message").ifBlank {tr("简历已保存，分析暂未完成。可以直接继续，无需重新上传。","Votre CV est enregistré. Reprenez l’analyse sans renvoyer le fichier.","Your CV is saved. Continue the analysis without uploading it again.")},color=MaterialTheme.colorScheme.onSurfaceVariant,lineHeight=24.sp)
                            PrimaryButton(tr("继续分析","Reprendre l’analyse","Continue analysis"),!state.working) {vm.retryV1()}
                        } else {
                            Hint(progress.text("label").ifBlank {tr("正在读取简历","Lecture de votre CV","Reading your CV")})
                            Spacer(Modifier.height(28.dp))
                            Text(if(progress.text("status")=="completed") "100%" else "${(waterLevel*100).roundToInt()}%",style=MaterialTheme.typography.displayLarge,color=MaterialTheme.colorScheme.primary,modifier=Modifier.semantics {progressBarRangeInfo=ProgressBarRangeInfo(waterLevel,0f..1f)})
                            Hint(tr("你的优势与方向，即将浮现。","Vos atouts et vos pistes prennent forme.","Your strengths and directions are taking shape."))
                        }
                    }
                    4 -> {
                        EditorialTitle(if(displayName.isBlank()) tr("这是你会闪光的地方。","Voici vos atouts.","Here is where you stand out.") else tr("你好，$displayName。","Bonjour $displayName.","Hi, $displayName."),large=true)
                        analysis.objects("strengths").take(3).forEach { strength ->
                            Column(Modifier.fillMaxWidth().padding(vertical=6.dp),verticalArrangement=Arrangement.spacedBy(5.dp)) {Text(strength.text("title"),style=MaterialTheme.typography.titleMedium);Hint(strength.text("evidence"));HorizontalDivider(Modifier.padding(top=5.dp),thickness=.6.dp,color=MaterialTheme.colorScheme.outlineVariant)}
                        }
                        analysis.objects("growthAreas").take(1).forEach { gap -> Text(gap.text("nextAction"),fontSize=15.sp,lineHeight=23.sp) }
                        Text(tr("你想先看看哪个方向？","Quelle piste vous attire ?","Which direction interests you?"),style=MaterialTheme.typography.headlineSmall)
                        directions.forEach { direction ->
                            val query=direction.text("searchQuery")
                            FilterChip(selected=chosenQuery==query&&customQuery.isBlank(),onClick={chosenQuery=query;customQuery=""},label={Text(direction.text("title"))})
                        }
                        OutlinedTextField(customQuery,{customQuery=it},Modifier.fillMaxWidth(),label={Text(tr("我有其他想法","J’ai une autre idée","I have something else in mind"))},shape=RoundedCornerShape(7.dp))
                        PrimaryButton(tr("看看这些工作","Voir les offres","Show me the roles"),(customQuery.trim().ifBlank {chosenQuery}).isNotBlank()&&!state.working) {
                            val query=customQuery.trim().ifBlank {chosenQuery};chooseAgain=false
                            vm.startTask(json("kind" to "search","query" to query,"silent" to true,"source" to "v1-onboarding"))
                        }
                    }
                    5 -> {
                        val empty=v1.text("searchState")=="completed"&&discovery.optInt("availableCount")==0
                        EditorialTitle(if(empty)tr("这个方向暂时没有合适的岗位","Pas encore d’offre adaptée à cette piste","No suitable roles for this direction yet") else tr("为你挑选值得一试的工作","Une sélection qui vous correspond","Finding roles worth your time"),large=true)
                        if(!empty && !waveFailed) {
                            Hint(progress.text("label").ifBlank {tr("正在找岗位","Recherche des offres","Finding roles")})
                            Spacer(Modifier.height(28.dp))
                            Text(if(progress.text("status")=="completed") "100%" else "${(waterLevel*100).roundToInt()}%",style=MaterialTheme.typography.displayLarge,color=MaterialTheme.colorScheme.primary,modifier=Modifier.semantics {progressBarRangeInfo=ProgressBarRangeInfo(waterLevel,0f..1f)})
                            Hint(tr("匹配、优势和建议，准备好后一起呈现。","Match, atouts et conseils arrivent ensemble.","Your match, strengths and insights arrive together."))
                        }
                        if(waveFailed) PrimaryButton(tr("再试一次","Réessayer","Try again"),!state.working) {vm.retryV1()}
                        if(empty || waveFailed) TextButton({chooseAgain=true}) {Text(tr("换个方向看看","Explorer une autre piste","Explore another direction"))}
                        if(empty) TextButton({vm.completeV1FirstRun()}) {Text(tr("先进入首页","Aller à l’accueil","Go to Home"))}
                    }
                    else -> {
                        EditorialTitle(tr("这几份工作，值得你看看。","Ces offres méritent votre attention.","These roles are worth a look."),large=true)
                        Hint(tr("左右滑动，点开查看匹配与提升建议。","Faites défiler, puis ouvrez une offre pour voir le match.","Swipe, then open a role to explore your fit."))
                        LazyRow(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(12.dp),contentPadding=PaddingValues(end=24.dp)) {
                            items(offers,key={it.text("url")}) {offer->FirstRunOfferCard(offer) {vm.completeV1FirstRun();vm.selectOffer(offer.text("url"))}}
                        }
                    }
                }
                state.error?.let {message->Text(message,color=MaterialTheme.colorScheme.error,fontSize=14.sp);if(page==3) TextButton({vm.retryV1()}) {Text(tr("重试","Réessayer","Retry"))}}
            }
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
    val score = if(offer.child("matchScore").has("current")) offer.child("matchScore").optInt("current") else if (deep.has("currentScore")) deep.optInt("currentScore") else fast.optInt("score", -1)
    val strengths = if (deep.objects("strengths").isNotEmpty()) deep.objects("strengths").map { it.text("title") } else fast.objects("strengths").map { it.text("title") }
    val gaps = if (deep.objects("capabilityGaps").isNotEmpty()) deep.objects("capabilityGaps").map { it.text("title") } else fast.objects("gaps").map { it.text("title") }
    val potential = deep.optInt("cvPotentialScore", score).coerceAtLeast(score)
    Surface(onClick = onClick, modifier = Modifier.width(292.dp).heightIn(min = 330.dp), shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.surface, border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), shadowElevation = 0.dp) {
        Column(Modifier.fillMaxWidth().padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(offer.text("company"), color = MaterialTheme.colorScheme.primary, style=MaterialTheme.typography.labelMedium)
                    Text(offer.text("title"), style=MaterialTheme.typography.headlineSmall)
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
            OnwardCvOutcome(offer)
            Spacer(Modifier.height(4.dp))
        }
    }
}
