package com.previewjs.intellij.plugin.services

import com.intellij.openapi.Disposable
import com.previewjs.intellij.plugin.api.*
import kotlinx.coroutines.runBlocking

class PreviewServer(
    private val api: PreviewJsApi,
    private val previewId: String,
    val url: String
) : Disposable {
    override fun dispose() {
        runBlocking {
            api.stopPreview(
                StopPreviewRequest(
                    previewId = previewId
                )
            )
        }
    }
}