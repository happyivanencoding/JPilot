package com.thegreatnovel.jobpilot

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import org.json.JSONObject
import java.time.Instant
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.min
import kotlin.math.sin

internal fun cvWaterFraction(elapsedSeconds: Double, completed: Boolean): Float =
    if (completed) 1f else (.96 * (1 - exp(-3 * elapsedSeconds.coerceAtLeast(0.0) / 55))).coerceIn(.04, .96).toFloat()

/** Estimated progress; server readiness is the only route to 100%. */
@Composable
fun rememberCvWaterLevel(progress: JSONObject, paused: Boolean): Float {
    val started = remember { System.currentTimeMillis() }
    val created = runCatching { Instant.parse(progress.text("createdAt")).toEpochMilli() }.getOrDefault(started)
    val status = progress.text("status", "running")
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(progress.text("id"), created, status, paused) {
        now = System.currentTimeMillis()
        while (isActive && status != "completed" && !paused) {
            delay(80)
            now = System.currentTimeMillis()
        }
    }
    val end = if (paused) runCatching { Instant.parse(progress.text("updatedAt")).toEpochMilli() }.getOrDefault(now) else now
    val target = cvWaterFraction((end - created).coerceAtLeast(0L) / 1000.0, status == "completed")
    val level by animateFloatAsState(target, tween(if (status == "completed") 380 else 160), label = "cv-water-level")
    return level
}

/** Two translucent waves fill the complete viewport, behind readable content. */
@Composable
fun CvAnalysisWater(level: Float, paused: Boolean) {
    val primary = MaterialTheme.colorScheme.primary
    var phase by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(paused) {
        if (!paused) {
            val basePhase = phase
            val start = withFrameNanos { it }
            while (isActive) withFrameNanos { now -> phase = basePhase + ((now - start) / 4_800_000_000.0 * 2 * PI).toFloat() }
        }
    }
    Canvas(Modifier.fillMaxSize()) {
        val amplitude = 12.dp.toPx() * min(1f, level * 12) * (1 - level)
        val waterY = size.height * (1 - level)
        for (layer in 0..1) {
            val wave = Path()
            val offset = if (layer == 0) phase else -phase * .72f + 1.8f
            for (step in 0..80) {
                val x = size.width * step / 80f
                val y = waterY + sin(step / 80.0 * 2 * PI + offset).toFloat() * amplitude
                if (step == 0) wave.moveTo(x, y) else wave.lineTo(x, y)
            }
            wave.lineTo(size.width, size.height)
            wave.lineTo(0f, size.height)
            wave.close()
            drawPath(wave, primary.copy(alpha = if (layer == 0) .10f else .15f))
        }
    }
}
