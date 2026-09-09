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
import kotlin.math.exp
import kotlin.math.roundToInt

val Indigo = Color(0xFF166568)
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
        primary = Color(0xFF9AD9D1), onPrimary = Color(0xFF103D3E), primaryContainer = Color(0xFF1A4145),
        secondary = Color(0xFFB6C4D3), secondaryContainer = Color(0xFF2C3946), onSecondaryContainer = Color(0xFFE6EDF3),
        background = Color(0xFF10191D), surface = Color(0xFF19262C), surfaceVariant = Color(0xFF25323E),
        surfaceContainerLowest=Color(0xFF10191D),surfaceContainerLow=Color(0xFF19262C),surfaceContainer=Color(0xFF1D2C32),surfaceContainerHigh=Color(0xFF25343A),surfaceContainerHighest=Color(0xFF304148),
        onSurface = Color(0xFFE6EDF3), onSurfaceVariant = Color(0xFFAFBCC9), outlineVariant = Color(0xFF344452)
    ) else lightColorScheme(
        primary = Indigo, onPrimary = Color.White, primaryContainer = Color(0xFFE3EFEC), onPrimaryContainer = Color(0xFF17474A),
        secondary = Color(0xFF526575), secondaryContainer = Color(0xFFE7EDF2), onSecondaryContainer = Color(0xFF1C3037),
        background = Color(0xFFF3F5F3), surface = Color.White, surfaceVariant = Color(0xFFEBEFF3),
        surfaceContainerLowest=Color.White,surfaceContainerLow=Color(0xFFF3F5F3),surfaceContainer=Color(0xFFEDF1EF),surfaceContainerHigh=Color(0xFFE6ECE9),surfaceContainerHighest=Color(0xFFDEE6E2),
        onSurface = Color(0xFF1C3037), onSurfaceVariant = Color(0xFF566675), outlineVariant = Color(0xFFDAE1E7)
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
        ?.takeIf { task ->
            val status = task.text("status")
            status in aiProgressActiveStates || status in aiProgressTerminalStates && now - epoch(task.text("updatedAt", task.text("createdAt"))) <= 3200L
        }
}

/**
 * Estimated progress for model-backed actions. This is intentionally an ETA curve,
 * not model-reported completion: it advances quickly at first, slows near the end,
 * stays below 100% while active, then snaps to 100% only on a real completed state.
 */
@Composable fun AiProgressButton(
    state: PilotState,
    taskKind: String,
    jobId: String? = null,
    label: String,
    enabled: Boolean = true,
    outlined: Boolean = false,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val task = aiProgressTask(state, taskKind, jobId)
    val status = task?.text("status").orEmpty()
    val active = status in aiProgressActiveStates
    val completed = status == "completed"
    val failed = status == "failed" || status == "interrupted"
    val estimate = task?.child("estimate")
    val target = estimate?.optDouble("targetSeconds", estimate.optDouble("maxSeconds", 0.0)) ?: 0.0
    val started = remember(task?.text("id"), task?.text("createdAt")) {
        runCatching { Instant.parse(task?.text("createdAt").orEmpty()).toEpochMilli() }.getOrDefault(System.currentTimeMillis())
    }
    var now by remember(task?.text("id")) { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(task?.text("id"), status, target) {
        if(task != null && (active || status in aiProgressTerminalStates)) {
            while(true) {
                now = System.currentTimeMillis()
                val updated = runCatching { Instant.parse(task.text("updatedAt", task.text("createdAt"))).toEpochMilli() }.getOrDefault(now)
                if(!active && now - updated > 3200L) break
                delay(250)
            }
        }
    }
    val elapsed = ((now - started).coerceAtLeast(0L) / 1000.0)
    val estimated = when {
        completed -> 1f
        failed -> 1f
        !active -> 0f
        target <= 0.0 -> .18f
        else -> (0.96 * (1.0 - exp(-3.0 * elapsed / target))).coerceIn(.04, .96).toFloat()
    }
    val animated by animateFloatAsState(estimated, tween(if(completed || failed) 260 else 450), label = "ai-inline-progress")
    val primary = MaterialTheme.colorScheme.primary
    val foreground = if(outlined) primary else MaterialTheme.colorScheme.onPrimary
    val fill = when {
        failed -> MaterialTheme.colorScheme.error.copy(alpha = .24f)
        outlined -> primary.copy(alpha = .15f)
        else -> MaterialTheme.colorScheme.onPrimary.copy(alpha = .18f)
    }
    val display = when {
        completed -> tr("已完成", "Terminé", "Completed")
        failed -> tr("处理失败", "Échec du traitement", "Processing failed")
        active -> "$label  ≈${(animated * 100).roundToInt()}%"
        else -> label
    }
    Button(
        onClick,
        modifier.fillMaxWidth().heightIn(min = 48.dp),
        enabled = enabled && !active,
        shape = RoundedCornerShape(8.dp),
        border = if(outlined) BorderStroke(1.dp, primary) else null,
        colors = ButtonDefaults.buttonColors(
            containerColor = if(outlined) Color.Transparent else primary,
            contentColor = foreground,
            disabledContainerColor = if(outlined) Color.Transparent else primary.copy(alpha = .72f),
            disabledContentColor = foreground.copy(alpha = .92f),
        ),
        contentPadding = PaddingValues(0.dp),
    ) {
        Box(Modifier.fillMaxWidth().heightIn(min = 48.dp), contentAlignment = Alignment.Center) {
            if(task != null) Box(Modifier.align(Alignment.CenterStart).fillMaxHeight().fillMaxWidth(animated.coerceIn(0f, 1f)).background(fill))
            Text(display, Modifier.padding(horizontal = 14.dp), fontWeight = FontWeight.SemiBold)
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
