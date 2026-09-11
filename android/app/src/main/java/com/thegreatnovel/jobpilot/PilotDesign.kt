package com.thegreatnovel.jobpilot

import android.app.Activity
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.painterResource
import android.content.res.Configuration
import android.os.LocaleList
import android.provider.Settings
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.Velocity
import androidx.core.view.WindowCompat
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.time.Instant
import kotlin.math.sin
import kotlin.math.exp
import kotlin.math.roundToInt

val OnwardForest = Color(0xFF0A4438)
val OnwardForestDeep = Color(0xFF06372F)
val OnwardIvory = Color(0xFFFAF8F1)
val OnwardPaper = Color(0xFFFFFDF8)
val OnwardSage = Color(0xFFE9EFDB)
val OnwardLeaf = Color(0xFFDDE77E)
val OnwardWarmGray = Color(0xFF6E706A)
val OnwardWarmLine = Color(0xFFDEDDD4)
val OnwardError = Color(0xFF91443E)

// Keep legacy names source-compatible while the visual layer moves to Onward.
val Indigo = OnwardForest
val Apricot = OnwardWarmGray
val LocalPilotLanguage = staticCompositionLocalOf { "fr" }
@Composable fun tr(zh: String, fr: String, en: String = fr): String = when(LocalPilotLanguage.current) { "zh" -> zh; "en" -> en; else -> fr }

private val OnwardSerif = FontFamily(Font(R.font.instrument_serif_regular, weight = FontWeight.Normal))
private val OnwardSans = FontFamily(
    Font(R.font.inter_variable, weight = FontWeight.Normal),
    Font(R.font.inter_variable, weight = FontWeight.Medium),
    Font(R.font.inter_variable, weight = FontWeight.SemiBold),
    Font(R.font.inter_variable, weight = FontWeight.Bold),
)
private val OnwardTypography = Typography(
    displayLarge = TextStyle(fontFamily=OnwardSerif,fontSize=38.sp,lineHeight=41.sp,fontWeight=FontWeight.Medium,letterSpacing=(-1.0).sp),
    displayMedium = TextStyle(fontFamily=OnwardSerif,fontSize=32.sp,lineHeight=36.sp,fontWeight=FontWeight.Medium,letterSpacing=(-.7).sp),
    displaySmall = TextStyle(fontFamily=OnwardSerif,fontSize=28.sp,lineHeight=33.sp,fontWeight=FontWeight.Medium,letterSpacing=(-.45).sp),
    headlineLarge = TextStyle(fontFamily=OnwardSerif,fontSize=30.sp,lineHeight=35.sp,fontWeight=FontWeight.Medium,letterSpacing=(-.55).sp),
    headlineMedium = TextStyle(fontFamily=OnwardSerif,fontSize=25.sp,lineHeight=31.sp,fontWeight=FontWeight.Medium,letterSpacing=(-.35).sp),
    headlineSmall = TextStyle(fontFamily=OnwardSerif,fontSize=21.sp,lineHeight=27.sp,fontWeight=FontWeight.Medium,letterSpacing=(-.2).sp),
    titleLarge = TextStyle(fontFamily=OnwardSerif,fontSize=20.sp,lineHeight=26.sp,fontWeight=FontWeight.Medium),
    titleMedium = TextStyle(fontFamily=OnwardSans,fontSize=16.sp,lineHeight=22.sp,fontWeight=FontWeight.SemiBold),
    titleSmall = TextStyle(fontFamily=OnwardSans,fontSize=14.sp,lineHeight=20.sp,fontWeight=FontWeight.SemiBold),
    bodyLarge = TextStyle(fontFamily=OnwardSans,fontSize=15.sp,lineHeight=22.sp,fontWeight=FontWeight.Normal),
    bodyMedium = TextStyle(fontFamily=OnwardSans,fontSize=14.sp,lineHeight=21.sp,fontWeight=FontWeight.Normal),
    bodySmall = TextStyle(fontFamily=OnwardSans,fontSize=12.sp,lineHeight=18.sp,fontWeight=FontWeight.Normal),
    labelLarge = TextStyle(fontFamily=OnwardSans,fontSize=14.sp,lineHeight=20.sp,fontWeight=FontWeight.SemiBold),
    labelMedium = TextStyle(fontFamily=OnwardSans,fontSize=12.sp,lineHeight=17.sp,fontWeight=FontWeight.Medium),
    labelSmall = TextStyle(fontFamily=OnwardSans,fontSize=11.sp,lineHeight=15.sp,fontWeight=FontWeight.Medium),
)

private object SheetContentEdgeBlocker : NestedScrollConnection {
    override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset =
        if(available.y != 0f) Offset(0f,available.y) else Offset.Zero
    override suspend fun onPostFling(consumed: Velocity, available: Velocity): Velocity =
        if(available.y != 0f) Velocity(0f,available.y) else Velocity.Zero
}

/** Keep an inner sheet scroller's unconsumed edge motion out of ModalBottomSheet.
 * Direct dragging on the sheet/handle still dismisses normally. */
fun Modifier.blockSheetEdgeMotion(): Modifier = nestedScroll(SheetContentEdgeBlocker)

@Composable fun PilotTheme(state: PilotState, content: @Composable () -> Unit) {
    val dark = state.theme == "dark" || (state.theme == "system" && isSystemInDarkTheme())
    val colors = if (dark) darkColorScheme(
        primary = Color(0xFFB8D7C7), onPrimary = Color(0xFF082D27), primaryContainer = Color(0xFF203E35), onPrimaryContainer=Color(0xFFE7F0E8),
        secondary = Color(0xFFD4DEA3), secondaryContainer = Color(0xFF344234), onSecondaryContainer = Color(0xFFF2F2E6),
        background = Color(0xFF101A17), surface = Color(0xFF17231F), surfaceVariant = Color(0xFF23312C),
        surfaceContainerLowest=Color(0xFF0C1512),surfaceContainerLow=Color(0xFF15201D),surfaceContainer=Color(0xFF1A2723),surfaceContainerHigh=Color(0xFF23332D),surfaceContainerHighest=Color(0xFF2C3B35),
        onSurface = Color(0xFFF4F2E9), onSurfaceVariant = Color(0xFFB9BDB4), outline = Color(0xFF718078), outlineVariant = Color(0xFF35453E),
        error=Color(0xFFE3A49D),errorContainer=Color(0xFF4A2926),onErrorContainer=Color(0xFFFFDAD5)
    ) else lightColorScheme(
        primary = OnwardForest, onPrimary = OnwardIvory, primaryContainer = OnwardSage, onPrimaryContainer = OnwardForestDeep,
        secondary = Color(0xFF7A845E), secondaryContainer = Color(0xFFF0EFDF), onSecondaryContainer = Color(0xFF33372D),
        background = OnwardIvory, surface = OnwardPaper, surfaceVariant = Color(0xFFF0EFE8),
        surfaceContainerLowest=OnwardPaper,surfaceContainerLow=Color(0xFFF7F5ED),surfaceContainer=Color(0xFFF1F0E8),surfaceContainerHigh=Color(0xFFEAE9E0),surfaceContainerHighest=Color(0xFFE3E2D9),
        onSurface = Color(0xFF15352F), onSurfaceVariant = OnwardWarmGray, outline = Color(0xFF94978E), outlineVariant = OnwardWarmLine,
        error=OnwardError,errorContainer=Color(0xFFF6E3DF),onErrorContainer=Color(0xFF5D2420)
    )
    val view = LocalView.current
    SideEffect { (view.context as? Activity)?.window?.let { WindowCompat.getInsetsController(it,view).let { controller -> controller.isAppearanceLightStatusBars = !dark; controller.isAppearanceLightNavigationBars = !dark } } }
    val context=LocalContext.current
    val configuration=LocalConfiguration.current
    val localeConfiguration=remember(configuration,state.language) { Configuration(configuration).apply { setLocales(LocaleList.forLanguageTags(if(state.language=="zh") "zh-CN" else state.language)) } }
    // Keep the Activity in the ContextWrapper chain. createConfigurationContext
    // returns a ContextImpl and breaks file pickers / ActivityResult ownership.
    val localizedContext=remember(context,localeConfiguration) { android.view.ContextThemeWrapper(context,context.theme).apply { applyOverrideConfiguration(localeConfiguration) } }
    CompositionLocalProvider(LocalPilotLanguage provides state.language,LocalContext provides localizedContext,LocalConfiguration provides localeConfiguration) {
        MaterialTheme(
            colorScheme = colors,
            typography = OnwardTypography,
            shapes = Shapes(extraSmall = RoundedCornerShape(3.dp), small = RoundedCornerShape(6.dp), medium = RoundedCornerShape(8.dp), large = RoundedCornerShape(10.dp), extraLarge = RoundedCornerShape(14.dp)),
            content = content,
        )
    }
}

@Composable fun GlassCard(modifier: Modifier = Modifier, accent: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val bg=if(accent) MaterialTheme.colorScheme.primaryContainer.copy(alpha=.48f) else Color.Transparent
    Column(
        modifier.fillMaxWidth().background(bg, RoundedCornerShape(if(accent)8.dp else 0.dp)).padding(horizontal=if(accent)14.dp else 0.dp,vertical=12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        content()
        if(!accent) HorizontalDivider(Modifier.padding(top=4.dp),thickness=.6.dp,color=MaterialTheme.colorScheme.outlineVariant)
    }
}
@Composable fun SectionTitle(title: String, subtitle: String = "") {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.headlineLarge)
        if (subtitle.isNotEmpty()) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
@Composable fun EditorialTitle(text:String,modifier:Modifier=Modifier,large:Boolean=false) {
    Text(text,modifier,style=if(large) MaterialTheme.typography.displayMedium else MaterialTheme.typography.headlineMedium)
}
@Composable fun EditorialSection(title:String,modifier:Modifier=Modifier,content:@Composable ColumnScope.()->Unit) {
    Column(modifier.fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Text(title,style=MaterialTheme.typography.headlineSmall)
        content()
        HorizontalDivider(Modifier.padding(top=4.dp),thickness=.6.dp,color=MaterialTheme.colorScheme.outlineVariant)
    }
}
@Composable fun OnwardHalo(modifier:Modifier=Modifier) {
    Image(
        painter=painterResource(R.drawable.ic_onward),
        contentDescription=null,
        modifier=modifier,
        alpha=.075f,
    )
}
@Composable fun Pill(text: String, warm: Boolean = false, modifier: Modifier = Modifier) {
    Surface(modifier, shape = RoundedCornerShape(999.dp), color = if(warm) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.primaryContainer) {
        Text(text, Modifier.padding(horizontal = 9.dp, vertical = 4.dp), style = MaterialTheme.typography.labelMedium, color = if(warm) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onPrimaryContainer)
    }
}
@Composable fun Hint(text: String) { Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
@Composable fun EmptyCard(title: String, text: String) { GlassCard { Text(title, fontWeight = FontWeight.SemiBold); Hint(text) } }
@Composable fun PrimaryButton(label: String, enabled: Boolean = true, onClick: () -> Unit) {
    Button(onClick, Modifier.fillMaxWidth().heightIn(min = 50.dp), enabled = enabled, shape = RoundedCornerShape(999.dp),contentPadding=PaddingValues(horizontal=20.dp,vertical=12.dp)) { Text(label, style=MaterialTheme.typography.labelLarge) }
}

private val aiProgressActiveStates = setOf("queued", "running", "reconciling")
private val aiProgressTerminalStates = setOf("completed", "failed", "interrupted")

private fun aiProgressTask(state: PilotState, kind: String, jobId: String?): JSONObject? {
    val now = System.currentTimeMillis()
    fun epoch(value: String): Long = runCatching { Instant.parse(value).toEpochMilli() }.getOrDefault(0L)
    return state.snapshot.objects("tasks")
        .asSequence()
        .filter { it.text("kind") == kind && (jobId.isNullOrBlank() || it.text("jobId") == jobId) }
        .maxByOrNull { epoch(it.text("createdAt")) }

}

/**
 * Estimated progress for model-backed actions. This is intentionally an ETA curve,
 * not model-reported completion: it advances quickly at first, slows near the end,
 * stays below 100% while active, then snaps to 100% only on a real completed state.
 */
@Composable fun AiProgressButton(
    state:PilotState,taskKind:String,jobId:String?=null,label:String,enabled:Boolean=true,
    outlined:Boolean=false,modifier:Modifier=Modifier,offerUrl:String?=null,onClick:()->Unit,
) {
    val context=LocalContext.current
    val reducedMotion=remember(context) {Settings.Global.getFloat(context.contentResolver,Settings.Global.ANIMATOR_DURATION_SCALE,1f)==0f}
    var clickedAt by remember(state.profileId,taskKind,jobId,offerUrl) { mutableLongStateOf(0L) }
    var now by remember {mutableLongStateOf(System.currentTimeMillis())}
    var finishedAt by remember(state.profileId,taskKind,jobId,offerUrl) {mutableLongStateOf(0L)}
    val candidate=if(taskKind=="search") state.snapshot.child("v1").child("searchProgress").takeIf {it.text("id").isNotBlank()}
        else if(offerUrl!=null)state.snapshot.objects("tasks").firstOrNull {it.text("kind")==taskKind&&it.text("url")==offerUrl}
        else aiProgressTask(state,taskKind,jobId)
    fun epoch(value:String)=runCatching {Instant.parse(value).toEpochMilli()}.getOrDefault(0L)
    val fresh=candidate!=null&&(clickedAt==0L||epoch(candidate.text("createdAt"))>=clickedAt-1500L||candidate.text("id")==state.noticeTaskId&&!state.working)
    val task=if(fresh)candidate else null
    val status=when {
        clickedAt>0&&state.error!=null&&!state.working -> "failed"
        task!=null -> task.text("status")
        clickedAt>0 -> "queued"
        else -> ""
    }
    val active=status in aiProgressActiveStates
    val completed=status=="completed"
    val failed=status=="failed"||status=="interrupted"
    val taskIdentity=task?.text("id").orEmpty()+":"+task?.text("createdAt").orEmpty()
    var observedActive by remember(taskIdentity) {mutableStateOf(false)}
    LaunchedEffect(taskIdentity,status,clickedAt) {
        if(active){observedActive=true;finishedAt=0L}
        else if((completed||failed)&&(observedActive||clickedAt>0)&&finishedAt==0L)finishedAt=System.currentTimeMillis()
        while(active || finishedAt>0L&&System.currentTimeMillis()-finishedAt<1600L){now=System.currentTimeMillis();delay(80)}
        now=System.currentTimeMillis()
    }
    val visible=active||failed&&clickedAt>0||(completed&&finishedAt>0&&now-finishedAt<1600L)
    val start=if(clickedAt>0)clickedAt else epoch(task?.text("createdAt").orEmpty()).takeIf {it>0}?:now
    val target=task?.child("estimate")?.optDouble("targetSeconds",90.0)?.coerceAtLeast(1.0)?:90.0
    val elapsed=((if(finishedAt>0)finishedAt else now)-start).coerceAtLeast(0)/1000.0
    val estimated=if(completed&&visible)1f else if(visible)(.96*(1-exp(-3*elapsed/target))).coerceIn(.04,.96).toFloat()else 0f
    val progress by animateFloatAsState(estimated,tween(if(completed)220 else 350),label="liquid-progress")
    val primary=MaterialTheme.colorScheme.primary
    val tint=if(failed)MaterialTheme.colorScheme.error else primary
    val errorColor=MaterialTheme.colorScheme.error
    val foreground=when { failed&&visible -> MaterialTheme.colorScheme.error; visible -> MaterialTheme.colorScheme.onPrimary; outlined -> primary; else -> MaterialTheme.colorScheme.onPrimary }
    val caption=when {
        completed&&visible -> tr("已完成","Terminé","Completed")+" 100%"
        failed&&visible -> tr("未完成，请重试","Réessayez","Please retry")
        active -> (if(taskKind=="search")task?.text("label")?.ifBlank {label}?:label else label)+"  ${(progress*100).roundToInt()}%"
        else -> label
    }
    Button(onClick={clickedAt=System.currentTimeMillis();finishedAt=0;now=clickedAt;onClick()},modifier=modifier.fillMaxWidth().heightIn(min=50.dp),enabled=enabled&&!active,shape=RoundedCornerShape(999.dp),
        colors=ButtonDefaults.buttonColors(containerColor=if(visible&&!failed)primary.copy(alpha=.92f)else if(failed&&visible)MaterialTheme.colorScheme.errorContainer else if(outlined)Color.Transparent else primary,contentColor=foreground,
            disabledContainerColor=if(visible&&!failed)primary.copy(alpha=.92f)else if(failed&&visible)MaterialTheme.colorScheme.errorContainer else primary.copy(alpha=.10f),disabledContentColor=if(visible)foreground else primary.copy(alpha=.65f)),
        border=if(failed&&visible||outlined)BorderStroke(1.dp,tint.copy(alpha=.34f))else null,contentPadding=PaddingValues(0.dp)) {
        Box(Modifier.fillMaxWidth().height(52.dp),contentAlignment=Alignment.Center) {
            if(visible)Canvas(Modifier.matchParentSize()) {
                for(layer in 0..1) {
                    val liquidTop=size.height*(1f-progress)
                    val amplitude=if(completed||reducedMotion)0f else (1.7f+layer*.8f).dp.toPx()
                    val wave=Path().apply {
                        for(i in 0..32){
                            val x=size.width*i/32f
                            val y=liquidTop+sin(i/32f*6.28318f+now/(1600f+layer*480f)+layer*1.7f)*amplitude
                            if(i==0)moveTo(x,y)else lineTo(x,y)
                        }
                        lineTo(size.width,size.height);lineTo(0f,size.height);close()
                    }
                    val liquid=if(failed)errorColor else if(layer==0)OnwardSage else OnwardLeaf
                    drawPath(wave,liquid.copy(alpha=if(layer==0).18f else .09f))
                }
            }
            Text(caption,Modifier.padding(horizontal=16.dp),style=MaterialTheme.typography.labelLarge)
        }
    }
}
@Composable fun Bullet(text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("•", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
        Text(text, style = MaterialTheme.typography.bodyMedium, lineHeight = 22.sp)
    }
}
@Composable fun ScoreBadge(score: Double?) {
    val value = score?.takeIf { it.isFinite() && it >= 0 && it <= 5 }
    Surface(shape = RoundedCornerShape(6.dp), color = MaterialTheme.colorScheme.primaryContainer.copy(alpha=.72f)) {
        Column(Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
            Text(value?.let { "%.1f".format(it) } ?: "—", style=MaterialTheme.typography.headlineMedium,color=MaterialTheme.colorScheme.primary)
            Text(if(value == null) tr("待评估","À évaluer","Unrated") else tr("匹配 / 5","Match / 5","Fit / 5"), fontSize = 10.sp)
        }
    }
}

private fun inlineText(raw: String) = buildAnnotatedString {
    var cursor = 0
    Regex("\\*\\*(.+?)\\*\\*").findAll(raw).forEach { m ->
        append(raw.substring(cursor,m.range.first))
        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(m.groupValues[1]) }
        cursor = m.range.last + 1
    }
    append(raw.substring(cursor))
}
/** A lightweight native renderer: headings, emphasis, lists and horizontally-scrollable tables. */
@Composable fun Markdown(text: String, modifier: Modifier = Modifier) {
    SelectionContainer(modifier) {
        Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
            val lines = text.replace("\r", "").split("\n")
            var index = 0
            while (index < lines.size) {
                val line = lines[index].trim()
                if (line.startsWith("|") && line.endsWith("|")) {
                    val rows = mutableListOf<List<String>>()
                    while (index < lines.size && lines[index].trim().startsWith("|")) {
                        val row = lines[index].trim().trim('|').split('|').map { it.trim() }
                        if (row.any { !it.matches(Regex("[-: ]+")) }) rows.add(row)
                        index++
                    }
                    Surface(shape = RoundedCornerShape(6.dp), color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .55f)) {
                        Column(Modifier.horizontalScroll(rememberScrollState()).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            rows.forEachIndexed { r, cells -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) { cells.forEach { cell -> Text(inlineText(cell), Modifier.width(175.dp), fontSize = 13.sp, fontWeight = if(r == 0) FontWeight.SemiBold else FontWeight.Normal) } } }
                        }
                    }
                    continue
                }
                when {
                    line.isBlank() -> Spacer(Modifier.height(3.dp))
                    line.startsWith("```") -> {}
                    line.startsWith("#") -> Text(line.trimStart('#',' '), Modifier.padding(top = 9.dp), fontSize = if(line.startsWith("###")) 17.sp else 20.sp, fontWeight = FontWeight.SemiBold)
                    line.startsWith("- ") || line.startsWith("* ") -> Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) { Text("•", color = MaterialTheme.colorScheme.primary); Text(inlineText(line.drop(2)), fontSize = 15.sp, lineHeight = 23.sp) }
                    line.matches(Regex("[-_*]{3,}")) -> HorizontalDivider(Modifier.padding(vertical=6.dp))
                    else -> Text(inlineText(line), fontSize = 15.sp, lineHeight = 23.sp)
                }
                index++
            }
        }
    }
}

// Restrained translucent chrome. No per-frame background blur or blurred document text.
@Composable fun PilotChrome(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Surface(modifier, color = MaterialTheme.colorScheme.background.copy(alpha = .96f), contentColor=MaterialTheme.colorScheme.onSurface,
        border = BorderStroke(.5.dp,MaterialTheme.colorScheme.outlineVariant.copy(alpha=.7f)), tonalElevation = 0.dp) { content() }
}
