package com.thegreatnovel.jobpilot

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.PersonOutline
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

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
