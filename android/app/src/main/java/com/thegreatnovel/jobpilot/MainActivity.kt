package com.thegreatnovel.jobpilot

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.*
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val vm: JobPilotViewModel = viewModel()
            val state by vm.state.collectAsStateWithLifecycle()
            DisposableEffect(vm) {
                val observer = LifecycleEventObserver { _, event ->
                    if(event == Lifecycle.Event.ON_START) vm.setForeground(true)
                    if(event == Lifecycle.Event.ON_STOP) vm.setForeground(false)
                }
                lifecycle.addObserver(observer)
                onDispose { lifecycle.removeObserver(observer) }
            }
            PilotTheme(state) { PilotApp(vm, state) }
        }
    }
}
