package com.thegreatnovel.jobpilot

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp

@Composable
fun OnwardBrand(modifier:Modifier=Modifier,large:Boolean=false) {
    Row(modifier,verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(10.dp)) {
        Image(painterResource(R.drawable.ic_onward),null,Modifier.size(if(large)46.dp else 36.dp))
        Icon(painterResource(R.drawable.onward_wordmark),"Onward",Modifier.width(if(large)143.dp else 122.dp).height(if(large)43.dp else 37.dp),tint=MaterialTheme.colorScheme.onSurface)
    }
}
