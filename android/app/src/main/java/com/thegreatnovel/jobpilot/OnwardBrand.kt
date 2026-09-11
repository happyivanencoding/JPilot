package com.thegreatnovel.jobpilot

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun OnwardBrand(modifier:Modifier=Modifier,large:Boolean=false) {
    Row(modifier,verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.spacedBy(if(large)9.dp else 7.dp)) {
        Image(painterResource(R.drawable.ic_onward),null,Modifier.size(if(large)42.dp else 31.dp))
        Text(
            "Onward",
            color=MaterialTheme.colorScheme.primary,
            fontFamily=FontFamily.Serif,
            fontWeight=FontWeight.Medium,
            fontSize=if(large)31.sp else 24.sp,
            letterSpacing=(-.9).sp,
        )
    }
}
