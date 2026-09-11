package com.thegreatnovel.jobpilot

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

private fun directionIcon(label: String): ImageVector {
    val value = label.lowercase()
    return when {
        Regex("data|anal|insight|bi\\b").containsMatchIn(value) -> Icons.Rounded.BarChart
        Regex("invest|asset|research|market|trading").containsMatchIn(value) -> Icons.Rounded.AccountBalance
        Regex("esg|sustain|climat|impact").containsMatchIn(value) -> Icons.Rounded.Eco
        Regex("market|brand|communicat|growth").containsMatchIn(value) -> Icons.Rounded.Campaign
        Regex("operation|supply|process|project").containsMatchIn(value) -> Icons.Rounded.AccountTree
        Regex("finance|bank|risk|quant").containsMatchIn(value) -> Icons.Rounded.ShowChart
        Regex("product|strategy|stratég|consult").containsMatchIn(value) -> Icons.Rounded.Explore
        Regex("design|ux|tech|engineer").containsMatchIn(value) -> Icons.Rounded.Layers
        else -> Icons.Rounded.TrackChanges
    }
}

@Composable
fun DirectionMedallion(label: String, modifier: Modifier = Modifier) {
    Box(
        modifier.size(38.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer.copy(alpha=.72f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(directionIcon(label), null, Modifier.size(18.dp), tint=MaterialTheme.colorScheme.primary)
    }
}

@Composable
fun CompanyMark(company: String, modifier: Modifier = Modifier, size: Int = 44) {
    val initial = company.firstOrNull { it.isLetterOrDigit() }?.uppercaseChar()?.toString() ?: "O"
    val tone = company.sumOf { it.code } % 4
    val background = when(tone) {
        1 -> Color(0xFFEEF2E7)
        2 -> Color(0xFFF3EEE5)
        3 -> Color(0xFFE7EFEB)
        else -> Color(0xFFF0EFE8)
    }
    Surface(
        modifier.size(size.dp),
        shape=RoundedCornerShape(9.dp),
        color=background,
        border=androidx.compose.foundation.BorderStroke(.6.dp,MaterialTheme.colorScheme.outlineVariant),
        tonalElevation=0.dp,
    ) {
        Box(contentAlignment=Alignment.Center) {
            Text(initial,style=MaterialTheme.typography.headlineSmall,color=OnwardForestDeep)
        }
    }
}

@Composable
fun MatchLabel(score: Int, modifier: Modifier = Modifier) {
    val text = when {
        score < 0 -> tr("待匹配","À explorer","Explore")
        score >= 85 -> tr("非常匹配","Très bon match","Very strong match")
        score >= 70 -> tr("匹配","Pertinent","Relevant")
        else -> tr("可探索","À explorer","Explore")
    }
    Surface(modifier,shape=RoundedCornerShape(999.dp),color=MaterialTheme.colorScheme.primaryContainer.copy(alpha=.82f)) {
        Text(text,Modifier.padding(horizontal=9.dp,vertical=5.dp),style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.SemiBold)
    }
}

@Composable
fun OnwardMeta(location: String, contract: String = "", modifier: Modifier = Modifier) {
    Row(modifier,verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(12.dp)) {
        if(location.isNotBlank()) Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(4.dp)) {
            Icon(Icons.Rounded.LocationOn,null,Modifier.size(13.dp),tint=MaterialTheme.colorScheme.onSurfaceVariant)
            Text(location,style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.onSurfaceVariant,maxLines=1)
        }
        if(contract.isNotBlank()) Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(4.dp)) {
            Icon(Icons.Rounded.Work,null,Modifier.size(13.dp),tint=MaterialTheme.colorScheme.onSurfaceVariant)
            Text(contract,style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.onSurfaceVariant,maxLines=1)
        }
    }
}

@Composable
fun SemanticRow(
    title:String,
    detail:String="",
    kind:String="check",
    chevron:Boolean=false,
    modifier:Modifier=Modifier,
) {
    val icon = when(kind) {
        "gap" -> Icons.Rounded.ShowChart
        "document" -> Icons.Rounded.Description
        "company" -> Icons.Rounded.Business
        "book" -> Icons.Rounded.MenuBook
        else -> Icons.Rounded.Check
    }
    Row(modifier.fillMaxWidth().padding(vertical=7.dp),verticalAlignment=Alignment.Top,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(28.dp).clip(CircleShape).background(if(kind=="gap")MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.primaryContainer.copy(alpha=.86f)),contentAlignment=Alignment.Center) {
            Icon(icon,null,Modifier.size(16.dp),tint=if(kind=="gap")MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary)
        }
        Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(2.dp)) {
            Text(title,style=MaterialTheme.typography.labelLarge,fontWeight=FontWeight.Medium)
            if(detail.isNotBlank()) Text(detail,style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if(chevron) Icon(Icons.Rounded.ChevronRight,null,Modifier.size(17.dp).align(Alignment.CenterVertically),tint=MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun AnimatedMatchScore(value:Int,modifier:Modifier=Modifier) {
    val actual=value.coerceIn(0,100)
    val animated=remember(actual){Animatable(0f)}
    LaunchedEffect(actual) {
        animated.snapTo(0f)
        animated.animateTo(actual.toFloat(),tween(430,easing=FastOutSlowInEasing))
    }
    Column(modifier,horizontalAlignment=Alignment.End,verticalArrangement=Arrangement.spacedBy(5.dp)) {
        Row(verticalAlignment=Alignment.Bottom) {
            Text(animated.value.roundToInt().toString(),style=MaterialTheme.typography.displayLarge,color=MaterialTheme.colorScheme.primary)
            Text("%",style=MaterialTheme.typography.headlineSmall,color=MaterialTheme.colorScheme.primary)
        }
        Box(Modifier.width(60.dp).height(3.dp).background(MaterialTheme.colorScheme.primaryContainer)) {
            Box(Modifier.fillMaxHeight().fillMaxWidth(animated.value.coerceIn(0f,100f)/100f).background(MaterialTheme.colorScheme.primary))
        }
    }
}

@Composable
fun OnwardReveal(delayMs:Int=0,content:@Composable ()->Unit) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible=true }
    AnimatedVisibility(
        visible=visible,
        enter=fadeIn(tween(190,delayMillis=delayMs))+slideInVertically(tween(190,delayMillis=delayMs)){ 7 },
    ) { content() }
}

@Composable
fun Modifier.onwardPress(onClick:()->Unit): Modifier {
    val source=remember {MutableInteractionSource()}
    val pressed by source.collectIsPressedAsState()
    val background by animateColorAsState(if(pressed)MaterialTheme.colorScheme.primaryContainer.copy(alpha=.28f)else Color.Transparent,tween(110),label="row-wash")
    return this.background(background).clickable(interactionSource=source,indication=null,onClick=onClick)
}
