package com.thegreatnovel.jobpilot

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

fun onwardSystemLanguage(tag:String):String=when(tag.lowercase().substringBefore('-').substringBefore('_')){"fr"->"fr";"zh"->"zh";else->"en"}

@Composable
fun SearchAreaFields(scope:String,city:String,onScope:(String)->Unit,onCity:(String)->Unit) {
    Column(verticalArrangement=Arrangement.spacedBy(10.dp)) {
        Text(tr("你想在哪儿工作？","Où souhaitez-vous travailler ?","Where would you like to work?"),fontWeight=FontWeight.SemiBold)
        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
            FilterChip(scope=="city",{onScope("city")},label={Text(tr("选择城市","Une ville","Choose a city"))})
            FilterChip(scope=="france",{onScope("france")},label={Text(tr("全法国","Toute la France","All of France"))})
        }
        if(scope=="city")OutlinedTextField(city,{onCity(it.take(80))},Modifier.fillMaxWidth().testTag("search-city"),singleLine=true,label={Text(tr("城市","Ville","City"))},placeholder={Text("Paris")})
    }
}
@Composable
fun SearchAreaSettings(state:PilotState,vm:JobPilotViewModel) {
    val stored=state.snapshot.child("config").child("target_roles").child("search_area")
    var scope by rememberSaveable(state.profileId) {mutableStateOf(stored.text("scope","city"))}
    var city by rememberSaveable(state.profileId) {mutableStateOf(stored.text("city","Paris"))}
    GlassCard {
        SearchAreaFields(scope,city,{scope=it},{city=it})
        PrimaryButton(tr("应用搜索范围","Appliquer la zone","Apply search area"),!state.working&&(scope=="france"||city.isNotBlank())) {vm.saveProfile(json("searchArea" to json("scope" to scope,"city" to city)))}
    }
}
@Composable
fun TrackingSaveState(state:String?,retry:()->Unit) {
    Hint(when(state){"saving"->tr("保存中…","Enregistrement…","Saving…");"saved"->tr("已自动保存","Enregistré automatiquement","Saved automatically");"failed"->tr("未保存，请重试","Non enregistré, réessayez","Not saved. Please retry");else->tr("改动会自动保存","Modifications enregistrées automatiquement","Changes save automatically")})
    if(state=="failed")TextButton(retry){Text(tr("重试保存","Réessayer","Retry save"))}
}
