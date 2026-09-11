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
import android.content.res.Configuration
import android.os.LocaleList
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
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

val Indigo = Color(0xFF293F68)
val Apricot = Color(0xFF64748B)
val LocalPilotLanguage = staticCompositionLocalOf { "fr" }
@Composable fun tr(zh: String, fr: String, en: String = fr): String = when(LocalPilotLanguage.current) { "zh" -> zh; "en" -> en; else -> fr }

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
        primary = Color(0xFFBBC9EB), onPrimary = Color(0xFF17253F), primaryContainer = Color(0xFF263B60),
        secondary = Color(0xFFB6C4D3), secondaryContainer = Color(0xFF2C3946), onSecondaryContainer = Color(0xFFE6EDF3),
        background = Color(0xFF111722), surface = Color(0xFF1B2433), surfaceVariant = Color(0xFF263347),
        surfaceContainerLowest=Color(0xFF111722),surfaceContainerLow=Color(0xFF1B2433),surfaceContainer=Color(0xFF202C3C),surfaceContainerHigh=Color(0xFF29394E),surfaceContainerHighest=Color(0xFF35465C),
        onSurface = Color(0xFFE6EDF3), onSurfaceVariant = Color(0xFFAFBCC9), outlineVariant = Color(0xFF344452)
    ) else lightColorScheme(
        primary = Indigo, onPrimary = Color.White, primaryContainer = Color(0xFFE8EDF6), onPrimaryContainer = Color(0xFF243854),
        secondary = Color(0xFF526575), secondaryContainer = Color(0xFFE7EDF2), onSecondaryContainer = Color(0xFF202D43),
        background = Color(0xFFF7F6F2), surface = Color.White, surfaceVariant = Color(0xFFEBEFF3),
        surfaceContainerLowest=Color.White,surfaceContainerLow=Color(0xFFF7F6F2),surfaceContainer=Color(0xFFF0F0ED),surfaceContainerHigh=Color(0xFFE9ECEF),surfaceContainerHighest=Color(0xFFE1E5EC),
        onSurface = Color(0xFF202D43), onSurfaceVariant = Color(0xFF5C687B), outlineVariant = Color(0xFFDEE2E8)
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
        MaterialTheme(colorScheme = colors, shapes = Shapes(extraSmall = RoundedCornerShape(4.dp), small = RoundedCornerShape(8.dp), medium = RoundedCornerShape(10.dp), large = RoundedCornerShape(12.dp), extraLarge = RoundedCornerShape(16.dp)), content = content)
    }
}

@Composable fun GlassCard(modifier: Modifier = Modifier, accent: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.surface, shadowElevation = 0.dp) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    }
}
@Composable fun SectionTitle(title: String, subtitle: String = "") {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, fontSize = 25.sp, lineHeight = 31.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.3).sp)
        if (subtitle.isNotEmpty()) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
@Composable fun Pill(text: String, warm: Boolean = false, modifier: Modifier = Modifier) {
    Surface(modifier, shape = RoundedCornerShape(4.dp), color = if(warm) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.primaryContainer) {
        Text(text, Modifier.padding(horizontal = 8.dp, vertical = 4.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurface)
    }
}
@Composable fun Hint(text: String) { Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
@Composable fun EmptyCard(title: String, text: String) { GlassCard { Text(title, fontWeight = FontWeight.SemiBold); Hint(text) } }
@Composable fun PrimaryButton(label: String, enabled: Boolean = true, onClick: () -> Unit) {
    Button(onClick, Modifier.fillMaxWidth().heightIn(min = 48.dp), enabled = enabled, shape = RoundedCornerShape(8.dp)) { Text(label, fontWeight = FontWeight.SemiBold) }
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
    val foreground=if(visible||outlined)tint else MaterialTheme.colorScheme.onPrimary
    val caption=when {
        completed&&visible -> tr("已完成","Terminé","Completed")+" 100%"
        failed&&visible -> tr("未完成，请重试","Réessayez","Please retry")
        active -> (if(taskKind=="search")task?.text("label")?.ifBlank {label}?:label else label)+"  ${(progress*100).roundToInt()}%"
        else -> label
    }
    Button(onClick={clickedAt=System.currentTimeMillis();finishedAt=0;now=clickedAt;onClick()},modifier=modifier.fillMaxWidth().heightIn(min=48.dp),enabled=enabled&&!active,shape=RoundedCornerShape(8.dp),
        colors=ButtonDefaults.buttonColors(containerColor=if(visible)tint.copy(alpha=.10f)else if(outlined)Color.Transparent else primary,contentColor=foreground,
            disabledContainerColor=if(visible)tint.copy(alpha=.10f)else primary.copy(alpha=.10f),disabledContentColor=if(visible)foreground else primary.copy(alpha=.65f)),
        border=if(visible||outlined)BorderStroke(1.dp,tint.copy(alpha=.25f))else null,contentPadding=PaddingValues(0.dp)) {
        Box(Modifier.fillMaxWidth().height(52.dp),contentAlignment=Alignment.Center) {
            if(visible)Canvas(Modifier.matchParentSize()) {
                for(layer in 0..1) {
                    val edge=size.width*progress
                    val wave=Path().apply {moveTo(0f,0f);lineTo(edge,0f);for(i in 0..24){val y=size.height*i/24f;val x=edge+sin(y/14f+now/600f+layer*2)*if(completed)0f else 4.dp.toPx();lineTo(x,y)};lineTo(0f,size.height);close()}
                    drawPath(wave,tint.copy(alpha=if(layer==0).16f else .10f))
                }
            }
            Text(caption,Modifier.padding(horizontal=12.dp),fontWeight=FontWeight.SemiBold,fontSize=14.sp)
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
    Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.primaryContainer) {
        Column(Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
            Text(value?.let { "%.1f".format(it) } ?: "—", fontSize = 23.sp, fontWeight = FontWeight.SemiBold)
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
                    Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .55f)) {
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
    Surface(modifier, color = MaterialTheme.colorScheme.surface.copy(alpha = .93f), contentColor=MaterialTheme.colorScheme.onSurface,
        border = BorderStroke(.5.dp,MaterialTheme.colorScheme.primary.copy(alpha = .13f)), tonalElevation = 0.dp) { content() }
}
