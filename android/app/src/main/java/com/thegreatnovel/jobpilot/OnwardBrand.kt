package com.thegreatnovel.jobpilot

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp

/** Canonical Onward lockup. The wordmark is vector geometry, never live text. */
@Composable
fun OnwardBrand(modifier: Modifier = Modifier, large: Boolean = false) {
    val width = if (large) 174.dp else 142.dp
    val height = if (large) 30.dp else 25.dp
    Image(
        painter = painterResource(R.drawable.ic_onward_lockup),
        contentDescription = "Onward",
        modifier = modifier.width(width).height(height),
    )
}
