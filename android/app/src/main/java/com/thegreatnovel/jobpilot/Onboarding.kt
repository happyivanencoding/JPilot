package com.thegreatnovel.jobpilot

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.PersonOutline
import androidx.compose.material.icons.rounded.School
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.WorkOutline
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
    GuideTab(Icons.Rounded.Home, tr("首页", "Accueil", "Home"), tr("先看今天最值得推进的事。", "Commencez par l’action la plus utile aujourd’hui.", "Start with the most useful next action today."), listOf(
        tr("查看待决定岗位、待跟进事项和最近回复。", "Voir les postes à décider, les relances et les réponses récentes.", "Review roles waiting for a decision, follow-ups and recent replies."),
        tr("从首页快捷进入机会、投递和面试准备。", "Accéder rapidement aux offres, candidatures et préparations.", "Jump quickly to opportunities, applications and interview preparation.")
    )),
    GuideTab(Icons.Rounded.Search, tr("机会", "Offres", "Offers"), tr("发现更适合你的岗位。", "Trouvez les opportunités qui vous correspondent.", "Find opportunities that fit you."), listOf(
        tr("根据你的简历、目标和地点搜索岗位。", "Rechercher selon votre CV, vos objectifs et votre localisation.", "Search using your CV, goals and location."),
        tr("保存岗位，或打开职位链接进行评估。", "Enregistrer une offre ou évaluer son annonce.", "Save a role or evaluate its job posting.")
    )),
    GuideTab(Icons.Rounded.WorkOutline, tr("投递", "Candidatures", "Applications"), tr("集中管理求职进展。", "Suivez toute votre recherche au même endroit.", "Keep your job search in one place."), listOf(
        tr("查看已保存、已申请、面试和 Offer 中的岗位。", "Voir les offres enregistrées, postulées, en entretien ou avec offre.", "Track saved roles, applications, interviews and offers."),
        tr("筛选待决定和待跟进事项，明确下一步。", "Filtrer les décisions et relances pour savoir quoi faire ensuite.", "Filter decisions and follow-ups to know what to do next.")
    )),
    GuideTab(Icons.Rounded.School, tr("准备", "Préparer", "Prepare"), tr("围绕真实岗位练习和准备。", "Préparez-vous autour d’un poste réel.", "Prepare around a real target role."), listOf(
        tr("为具体岗位生成面试准备计划。", "Créer un plan de préparation pour une offre précise.", "Create a preparation plan for a specific role."),
        tr("练习回答，获得逐项反馈，并查看你的优势。", "Pratiquer vos réponses, recevoir un retour précis et revoir vos forces.", "Practice answers, get detailed feedback and review your strengths.")
    )),
    GuideTab(Icons.Rounded.PersonOutline, tr("档案", "Dossier", "Profile"), tr("维护简历和求职偏好。", "Gérez votre CV et vos critères.", "Maintain your CV and job preferences."), listOf(
        tr("导入、编辑和预览你的主简历。", "Importer, modifier et prévisualiser votre CV de référence.", "Import, edit and preview your master CV."),
        tr("设置目标岗位、地点、合同类型和界面语言。", "Définir vos rôles, lieux, contrats et langue d’interface.", "Set target roles, locations, contract types and interface language.")
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
